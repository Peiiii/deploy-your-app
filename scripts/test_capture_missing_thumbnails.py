"""Assembled SQLite queue lifecycle and capture/R2 contract regressions."""
import contextlib
import importlib.util
import io
import os
from pathlib import Path
import sqlite3
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location(
    "capture_thumbnails", Path(__file__).with_name("capture-missing-thumbnails.py"))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
MIGRATION = Path(__file__).parents[1] / "workers/api/migrations/0003_thumbnail_jobs.sql"


class ClientError(Exception):
    def __init__(self, status):
        self.response = {"ResponseMetadata": {"HTTPStatusCode": status}}


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.db.executescript("""PRAGMA foreign_keys=ON;
            CREATE TABLE projects(id TEXT PRIMARY KEY, slug TEXT, is_public INTEGER,
              status TEXT, is_deleted INTEGER, url TEXT, last_deployed TEXT, name TEXT);
            CREATE INDEX idx_projects_public_sort ON projects(is_deleted, is_public, status, last_deployed);
        """)
        self.db.executescript(MIGRATION.read_text())
        self.enterContext(patch.object(capture, "query_d1", side_effect=self.query))
        self.enterContext(patch.dict(os.environ, dict.fromkeys((
            "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_API_TOKEN",
            "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"), "test"), clear=True))
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.enterContext(contextlib.redirect_stderr(io.StringIO()))
        self.s3 = MagicMock()
        self.client = self.enterContext(patch.object(capture, "r2_client", return_value=self.s3))
        self.ready = self.enterContext(patch.object(capture, "thumbnail_ready", return_value=False))
        self.screenshot = self.enterContext(patch.object(capture, "capture", return_value=b"webp"))
        self.browser = MagicMock()
        playwright = MagicMock()
        playwright.__enter__.return_value.chromium.launch.return_value = self.browser
        self.enterContext(patch.dict(sys.modules, {
            "botocore.exceptions": types.SimpleNamespace(ClientError=ClientError),
            "playwright.sync_api": types.SimpleNamespace(sync_playwright=lambda: playwright),
        }))

    def query(self, sql, params=()):
        return [dict(row) for row in self.db.execute(sql, params).fetchall()]

    def insert(self, slug="new-app", public=1, status="Live", deleted=0, url="https://app"):
        self.db.execute("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (slug, slug, public, status, deleted, url, "2026-10-02T12:00:00.000Z", slug))

    def jobs(self):
        return self.query("SELECT * FROM thumbnail_jobs")

    def test_publish_and_visibility_changes_enqueue_once(self):
        self.insert(public=0, status="Deploying")
        self.assertEqual(self.jobs(), [])
        self.db.execute("UPDATE projects SET status='Live'")
        self.assertEqual(self.jobs(), [])
        self.db.execute("UPDATE projects SET is_public=1")
        original = self.jobs()[0]
        self.db.execute("UPDATE projects SET name='renamed', status='Live'")
        self.assertEqual(self.jobs()[0], original)
        self.db.execute("UPDATE projects SET last_deployed='2026-10-02T13:00:00.000Z'")
        self.assertNotEqual(self.jobs()[0]["generation"], original["generation"])
        self.assertEqual(len(self.jobs()), 1)

    def test_ineligible_and_deleted_projects_cancel_work(self):
        for column, value in (("is_public", 0), ("is_public", None), ("status", "Failed"),
                              ("is_deleted", 1), ("url", ""), ("slug", "")):
            with self.subTest(column=column, value=value):
                self.db.execute("DELETE FROM projects")
                self.insert()
                self.db.execute(f"UPDATE projects SET {column}=?", (value,))
                self.assertEqual(self.jobs(), [])
        self.insert("delete-app")
        self.db.execute("DELETE FROM projects")
        self.assertEqual(self.jobs(), [])
        self.insert("null-deleted", deleted=None)
        self.assertEqual(len(self.jobs()), 1)

    def test_old_task_cannot_clear_or_defer_new_generation(self):
        self.insert()
        old = self.jobs()[0]
        self.db.execute("UPDATE projects SET is_public=0")
        self.db.execute("UPDATE projects SET is_public=1")
        fresh = self.jobs()[0]
        capture.complete_job(old)
        capture.defer_job(old, RuntimeError("secret-body"))
        self.assertEqual(self.jobs()[0], fresh)

    def test_empty_queue_has_no_r2_client_or_checks(self):
        self.assertEqual(capture.run_once(), 0)
        self.client.assert_not_called()
        self.ready.assert_not_called()
        self.screenshot.assert_not_called()

    def test_existing_cover_finishes_and_next_tick_does_no_work(self):
        self.insert()
        self.ready.return_value = True
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.jobs(), [])
        self.ready.reset_mock()
        self.client.reset_mock()
        self.assertEqual(capture.run_once(), 0)
        self.ready.assert_not_called()
        self.client.assert_not_called()
        self.s3.put_object.assert_not_called()

    def test_missing_cover_saved_conditionally_and_completed(self):
        self.insert()
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.jobs(), [])
        self.assertEqual(self.s3.put_object.call_args.kwargs["IfNoneMatch"], "*")
        self.assertEqual(self.s3.put_object.call_args.kwargs["Key"], "apps/new-app/thumbnail.webp")
        self.browser.new_page.return_value.close.assert_called_once()
        self.browser.close.assert_called_once()

    def test_cover_uploaded_during_capture_is_preserved(self):
        self.insert()
        self.ready.side_effect = [False, True]
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.jobs(), [])
        self.s3.put_object.assert_not_called()

    def test_concurrent_webp_conflict_completes_work(self):
        self.insert()
        self.s3.put_object.side_effect = ClientError(412)
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.jobs(), [])

    def test_republish_during_capture_preserves_new_work(self):
        self.insert()
        def republish(*_):
            self.db.execute("UPDATE projects SET last_deployed='2026-10-02T14:00:00.000Z'")
            return b"webp"
        self.screenshot.side_effect = republish
        old = self.jobs()[0]
        self.assertEqual(capture.run_once(), 0)
        self.assertNotEqual(self.jobs()[0]["generation"], old["generation"])
        self.s3.put_object.assert_not_called()

    def test_failure_isolated_and_backoff_prevents_immediate_retry(self):
        self.insert("broken-app")
        self.insert("new-app")
        self.screenshot.side_effect = [RuntimeError("sensitive upstream body"), b"webp"]
        self.assertEqual(capture.run_once(), 1)
        job = self.jobs()[0]
        self.assertEqual(job["slug"], "broken-app")
        self.assertEqual(job["attempts"], 1)
        self.assertGreater(job["next_attempt_at"], capture.now_iso())
        self.assertEqual(job["last_error"], "RuntimeError")
        self.screenshot.reset_mock()
        self.assertEqual(capture.run_once(), 0)
        self.screenshot.assert_not_called()

    def test_preflight_failure_does_not_block_capture_of_other_apps(self):
        self.insert("broken-app")
        self.insert("new-app")
        self.ready.side_effect = lambda s3, slug: (_ for _ in ()).throw(ClientError(503)) if slug == "broken-app" else False
        self.assertEqual(capture.run_once(check_only=True), 0)
        self.assertEqual(capture.run_once(), 0)
        self.screenshot.assert_called_once()
        self.assertEqual(self.jobs()[0]["attempts"], 1)

    def test_queue_batch_limit_and_index(self):
        for i in range(25):
            self.insert(f"app-{i}")
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.screenshot.call_count, 20)
        self.assertEqual(len(self.jobs()), 5)
        plan = self.query("EXPLAIN QUERY PLAN SELECT project_id FROM thumbnail_jobs WHERE next_attempt_at <= ? ORDER BY next_attempt_at, project_id LIMIT 1", (capture.now_iso(),))
        self.assertTrue(any("idx_thumbnail_jobs_due" in row["detail"] for row in plan))

    def test_hourly_repair_bounded_and_does_not_reset_backoff(self):
        for i in range(80):
            self.insert(f"app-{i}")
        old = self.jobs()[0]
        capture.defer_job(old, ClientError(503))
        before = self.jobs()[0]
        capture.reconcile_recent(self.s3)
        self.assertEqual(self.ready.call_count, 50)
        self.assertEqual(self.jobs()[0], before)
        self.db.execute("DELETE FROM thumbnail_jobs")
        self.ready.return_value = True
        self.ready.reset_mock()
        self.assertEqual(capture.run_once(check_only=True, reconcile=True), 0)
        self.assertEqual(self.ready.call_count, 50)
        self.assertEqual(self.jobs(), [])
        self.screenshot.assert_not_called()

    def test_hourly_repair_rechecks_visibility_before_enqueue(self):
        self.insert()
        self.db.execute("DELETE FROM thumbnail_jobs")
        def became_private(*_):
            self.db.execute("UPDATE projects SET is_public=0")
            return [False]
        with patch.object(capture, "check_covers", side_effect=became_private):
            capture.reconcile_recent(self.s3)
        self.assertEqual(self.jobs(), [])


class R2Tests(unittest.TestCase):
    def setUp(self):
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.enterContext(patch.dict(os.environ, {"R2_BUCKET_NAME": "test"}))
        self.enterContext(patch.dict(sys.modules, {
            "botocore.exceptions": types.SimpleNamespace(ClientError=ClientError),
        }))
        self.s3 = MagicMock()

    def test_existing_webp_uses_one_head(self):
        self.s3.head_object.return_value = {"ContentLength": 42}
        self.assertTrue(capture.thumbnail_ready(self.s3, "app"))
        self.s3.head_object.assert_called_once()

    def test_legacy_png_matches_gateway_placeholder_boundary(self):
        for size, ready in ((80, False), (81, True)):
            with self.subTest(size=size):
                self.s3.head_object.side_effect = [ClientError(404), {"ContentLength": size}]
                self.assertIs(capture.thumbnail_ready(self.s3, "app"), ready)

    def test_missing_both_is_pending_and_upstream_errors_are_not_missing(self):
        self.s3.head_object.side_effect = ClientError(404)
        self.assertFalse(capture.thumbnail_ready(self.s3, "app"))
        self.s3.head_object.side_effect = ClientError(403)
        with self.assertRaises(ClientError):
            capture.thumbnail_ready(self.s3, "app")


if __name__ == "__main__":
    unittest.main()
