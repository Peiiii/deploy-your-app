"""Regression tests for missing-cover scans and the production worker loop."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import MagicMock, patch
import urllib.error

spec = importlib.util.spec_from_file_location(
    "capture_thumbnails", Path(__file__).with_name("capture-missing-thumbnails.py")
)
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


class ClientError(Exception):
    def __init__(self, status):
        self.response = {"ResponseMetadata": {"HTTPStatusCode": status}}


class CaptureTests(unittest.TestCase):
    def setUp(self):
        names = (
            "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID",
            "CLOUDFLARE_D1_API_TOKEN", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME",
        )
        self.enterContext(patch.dict(os.environ, dict.fromkeys(names, "test"), clear=True))
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))
        self.enterContext(contextlib.redirect_stderr(io.StringIO()))
        self.s3 = MagicMock()
        self.browser = MagicMock()
        playwright = MagicMock()
        playwright.__enter__.return_value.chromium.launch.return_value = self.browser
        self.enterContext(patch.dict(sys.modules, {
            "boto3": types.SimpleNamespace(client=lambda *a, **k: self.s3),
            "botocore.exceptions": types.SimpleNamespace(ClientError=ClientError),
            "playwright.sync_api": types.SimpleNamespace(sync_playwright=lambda: playwright),
        }))
        self.slugs = self.enterContext(patch.object(capture, "recent_public_slugs", return_value=["new-app"]))
        self.ready = self.enterContext(patch.object(capture, "thumbnail_ready", return_value=False))
        self.screenshot = self.enterContext(patch.object(capture, "capture", return_value=b"webp"))

    def test_existing_cover_is_never_captured(self):
        self.ready.return_value = True
        self.assertEqual(capture.run_once(), 0)
        self.screenshot.assert_not_called()
        self.s3.put_object.assert_not_called()

    def test_missing_cover_is_saved_conditionally(self):
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.s3.put_object.call_args.kwargs["Key"], "apps/new-app/thumbnail.webp")
        self.assertEqual(self.s3.put_object.call_args.kwargs["IfNoneMatch"], "*")
        self.browser.new_page.return_value.close.assert_called_once()
        self.browser.close.assert_called_once()

    def test_cover_uploaded_during_capture_is_preserved(self):
        self.ready.side_effect = [False, True]
        self.assertEqual(capture.run_once(), 0)
        self.s3.put_object.assert_not_called()

    def test_concurrent_capture_conflict_is_not_failure(self):
        self.s3.put_object.side_effect = ClientError(412)
        self.assertEqual(capture.run_once(), 0)

    def test_app_capture_failure_does_not_block_next_app(self):
        self.slugs.return_value = ["broken-app", "new-app"]
        self.screenshot.side_effect = [RuntimeError("HTTP 404"), b"webp"]
        self.assertEqual(capture.run_once(), 1)
        self.assertEqual(self.s3.put_object.call_args.kwargs["Key"], "apps/new-app/thumbnail.webp")
        self.assertEqual(self.browser.new_page.return_value.close.call_count, 2)

    def test_readiness_failure_does_not_block_other_missing_apps(self):
        self.slugs.return_value = ["broken-app", "new-app"]
        self.ready.side_effect = lambda slug: None if slug == "broken-app" else False
        self.assertEqual(capture.run_once(), 1)
        self.screenshot.assert_called_once()
        self.assertEqual(self.s3.put_object.call_args.kwargs["Key"], "apps/new-app/thumbnail.webp")

    def test_all_readiness_failures_are_scan_failure(self):
        self.ready.return_value = None
        with self.assertRaisesRegex(RuntimeError, "All thumbnail readiness"):
            capture.run_once()

    def test_per_run_capture_limit_is_bounded(self):
        self.slugs.return_value = [f"app-{i}" for i in range(25)]
        self.assertEqual(capture.run_once(), 0)
        self.assertEqual(self.screenshot.call_count, 20)

class ReadinessTests(unittest.TestCase):
    def test_http_failure_does_not_escape_per_app_boundary(self):
        error = urllib.error.HTTPError("https://test", 503, "unavailable", {}, None)
        with contextlib.redirect_stderr(io.StringIO()):
            with patch.object(capture.urllib.request, "urlopen", side_effect=error):
                self.assertIsNone(capture.thumbnail_ready("bad-app"))


if __name__ == "__main__":
    unittest.main()
