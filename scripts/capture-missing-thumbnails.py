"""Process queued covers, or manually repair historical public-app covers."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import re
import sys
import urllib.request

CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
MAX_IMAGES_PER_RUN = 20
MAX_BYTES = 300 * 1024
REPAIR_PAGE_SIZE = 100
ELIGIBLE = """is_public = 1 AND status = 'Live'
    AND (is_deleted = 0 OR is_deleted IS NULL)
    AND COALESCE(TRIM(url), '') != '' AND COALESCE(TRIM(slug), '') != ''"""


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def query_d1(sql, params=()):
    url = ("https://api.cloudflare.com/client/v4/accounts/"
           f"{os.environ['CLOUDFLARE_ACCOUNT_ID']}/d1/database/"
           f"{os.environ['CLOUDFLARE_D1_DATABASE_ID']}/query")
    request = urllib.request.Request(
        url, data=json.dumps({"sql": sql, "params": list(params)}).encode(),
        headers={"Authorization": f"Bearer {os.environ['CLOUDFLARE_D1_API_TOKEN']}",
                 "Content-Type": "application/json", "User-Agent": "GemiGoThumbnailCapture/1.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not data.get("success") or not data.get("result") or not data["result"][0].get("success"):
        raise RuntimeError("D1 thumbnail query failed")
    result = data["result"][0]
    print(f"d1 rows_read={result.get('meta', {}).get('rows_read', 'unknown')}", flush=True)
    return result["results"]


def due_jobs():
    return query_d1("""SELECT project_id, slug, generation, attempts FROM thumbnail_jobs
        WHERE next_attempt_at <= ? ORDER BY next_attempt_at, project_id LIMIT ?""",
        (now_iso(), MAX_IMAGES_PER_RUN))


def complete_job(job):
    query_d1("DELETE FROM thumbnail_jobs WHERE project_id = ? AND generation = ?",
             (job["project_id"], job["generation"]))


def job_current(job):
    return bool(query_d1("SELECT project_id FROM thumbnail_jobs WHERE project_id = ? AND generation = ?",
                         (job["project_id"], job["generation"])))


def safe_error(error):
    status = getattr(error, "status", None) or getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")
    return f"HTTP {status}" if status else type(error).__name__


def defer_job(job, error):
    minutes = min(60, 2 ** min(job["attempts"] + 1, 6))
    next_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat(
        timespec="milliseconds").replace("+00:00", "Z")
    reason = safe_error(error)
    query_d1("""UPDATE thumbnail_jobs SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?
        WHERE project_id = ? AND generation = ?""",
        (next_at, reason, job["project_id"], job["generation"]))
    print(f"deferred {job['slug']}: {reason}, retry_in={minutes}m", file=sys.stderr, flush=True)


def r2_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto",
        config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
    )


def thumbnail_ready(s3, slug):
    from botocore.exceptions import ClientError

    for extension in ("webp", "png"):
        key = f"apps/{slug}/thumbnail.{extension}"
        print(f"r2-head {key}", flush=True)
        try:
            obj = s3.head_object(Bucket=os.environ["R2_BUCKET_NAME"], Key=key)
            # The gateway accepts every WebP and only non-placeholder legacy PNGs.
            return extension == "webp" or obj["ContentLength"] > 80
        except ClientError as error:
            if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                raise
    return False


def check_covers(s3, slugs):
    def check(slug):
        try:
            if not SLUG.fullmatch(slug):
                raise ValueError("Invalid app slug")
            return thumbnail_ready(s3, slug)
        except Exception as error:
            return error
    with ThreadPoolExecutor(max_workers=10) as pool:
        return list(pool.map(check, slugs))


def reconcile_recent(s3):
    # Separate null/zero branches let the existing public-sort index supply time order.
    projects = query_d1(f"""SELECT id, slug, last_deployed FROM projects
        WHERE {ELIGIBLE} AND is_deleted = 0
        UNION ALL SELECT id, slug, last_deployed FROM projects
        WHERE {ELIGIBLE} AND is_deleted IS NULL
        ORDER BY last_deployed DESC LIMIT 50""")
    ready = check_covers(s3, [p["slug"] for p in projects])
    missing = errors = 0
    for project, result in zip(projects, ready):
        if result is False:
            # Recheck eligibility atomically; don't reset existing retry backoff.
            query_d1(f"""INSERT INTO thumbnail_jobs(project_id, slug)
                SELECT id, slug FROM projects WHERE id = ? AND {ELIGIBLE}
                ON CONFLICT(project_id) DO NOTHING""", (project["id"],))
            missing += 1
        elif isinstance(result, Exception):
            errors += 1
            print(f"repair-check failed {project['slug']}: {safe_error(result)}", file=sys.stderr)
    print(f"reconciled={len(projects)} missing={missing} errors={errors}", flush=True)
    if projects and errors == len(projects):
        raise RuntimeError("All repair readiness checks failed")


class AppHTTPError(RuntimeError):
    def __init__(self, status):
        super().__init__(f"App returned HTTP {status}")
        self.status = status


def capture(page, slug):
    from PIL import Image

    target = f"https://{slug}.gemigo.app/"
    response = page.goto(target, wait_until="domcontentloaded", timeout=15000)
    if response is None or response.status >= 400:
        raise AppHTTPError(response.status if response else 'unknown')
    page.wait_for_timeout(1200)
    cdp = page.context.new_cdp_session(page)
    screenshot = cdp.send(
        "Page.captureScreenshot",
        {"format": "png", "captureBeyondViewport": False, "fromSurface": True},
    )
    image = Image.open(io.BytesIO(base64.b64decode(screenshot["data"]))).convert("RGB")
    for width, quality in ((960, 72), (800, 58), (640, 44), (480, 30)):
        resized = image if width == 960 else image.resize((width, round(width * 540 / 960)))
        output = io.BytesIO()
        resized.save(output, format="WEBP", quality=quality, method=6)
        if output.tell() <= MAX_BYTES:
            return output.getvalue()
    raise RuntimeError("Screenshot is over 300 KiB after compression")


def capture_and_store(s3, page, slug, is_current):
    """One conditional writer shared by queued and manual captures."""
    from botocore.exceptions import ClientError

    if not is_current():
        return "changed"
    image = capture(page, slug)
    if not is_current():
        return "changed"
    if thumbnail_ready(s3, slug):
        return "existing"
    try:
        s3.put_object(
            Bucket=os.environ["R2_BUCKET_NAME"], Key=f"apps/{slug}/thumbnail.webp",
            Body=image, ContentType="image/webp", CacheControl=CACHE_CONTROL,
            IfNoneMatch="*",
        )
    except ClientError as error:
        if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
            raise
        return "existing"
    print(f"saved {slug}: {len(image)} bytes", flush=True)
    return "saved"


def require_configuration():
    required = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_API_TOKEN",
                "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing configuration: {', '.join(missing)}")


def run_once(check_only=False, reconcile=False):
    require_configuration()
    s3 = r2_client() if reconcile else None
    if reconcile:
        reconcile_recent(s3)
    jobs = due_jobs()
    if jobs and s3 is None:
        s3 = r2_client()
    ready = check_covers(s3, [job["slug"] for job in jobs])
    pending = []
    failed = 0
    for job, result in zip(jobs, ready):
        if result is True:
            complete_job(job)
        elif result is False:
            pending.append(job)
        else:
            defer_job(job, result)
            failed += 1
    print(f"queued={len(jobs)} pending={len(pending)} readiness_errors={failed}", flush=True)
    if check_only:
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                output.write(f"pending={'true' if pending else 'false'}\n")
                output.write(f"readiness_errors={failed}\n")
        # Mixed failures must not prevent capture of other apps. The workflow
        # reports these after the capture step, while failed jobs stay deferred.
        return 0
    if not pending:
        return failed

    from playwright.sync_api import sync_playwright

    saved = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for job in pending:
                slug = job["slug"]
                page = browser.new_page(viewport={"width": 960, "height": 540})
                try:
                    result = capture_and_store(s3, page, slug, lambda: job_current(job))
                    if result == "changed":
                        print(f"skipped {slug}: task changed during capture", flush=True)
                        continue
                    if result == "saved":
                        saved += 1
                    complete_job(job)
                except Exception as error:
                    defer_job(job, error)
                    failed += 1
                finally:
                    page.close()
        finally:
            browser.close()
    print(f"completed: saved={saved} failed={failed} queued={len(jobs)}", flush=True)
    return failed


def project_current(project):
    return bool(query_d1(f"""SELECT id FROM projects
        WHERE id = ? AND slug = ? AND url = ? AND last_deployed IS ? AND {ELIGIBLE}""",
        (project["id"], project["slug"], project["url"], project["last_deployed"])))


def write_repair_report(report, path):
    if path:
        target = Path(path)
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)


def repair_all(start_after="", max_projects=1000, report_path=None):
    """Finite manual scan; never creates or changes automatic queue jobs."""
    if max_projects < 1:
        raise ValueError("max-projects must be positive")
    require_configuration()
    from playwright.sync_api import sync_playwright

    report = {"checked": 0, "saved": 0, "existing": 0, "changed": 0, "failed": 0,
              "complete": False, "next_cursor": start_after, "results": []}
    browser = None
    try:
        upper = query_d1("SELECT MAX(id) AS upper_id FROM projects")[0]["upper_id"]
        s3 = r2_client() if upper else None
        with sync_playwright() as playwright, ExitStack() as resources:
            cursor = start_after
            while upper and report["checked"] < max_projects:
                limit = min(REPAIR_PAGE_SIZE, max_projects - report["checked"])
                projects = query_d1(f"""SELECT id, slug, url, last_deployed FROM projects
                    WHERE id > ? AND id <= ? AND {ELIGIBLE} ORDER BY id LIMIT ?""",
                    (cursor, upper, limit + 1))
                has_more = len(projects) > limit
                projects = projects[:limit]
                readiness = check_covers(s3, [project["slug"] for project in projects])
                for project, ready in zip(projects, readiness):
                    slug = project["slug"]
                    entry = {"slug": slug}
                    page = None
                    try:
                        if isinstance(ready, Exception):
                            raise ready
                        result = "existing"
                        if not ready:
                            if browser is None:
                                browser = playwright.chromium.launch()
                                resources.callback(browser.close)
                            page = browser.new_page(viewport={"width": 960, "height": 540})
                            result = capture_and_store(s3, page, slug, lambda: project_current(project))
                        report[result] += 1
                        entry["status"] = result
                    except Exception as error:
                        report["failed"] += 1
                        entry.update(status="failed", error=safe_error(error))
                    finally:
                        if page is not None:
                            page.close()
                    report["checked"] += 1
                    cursor = project["id"]
                    report["next_cursor"] = cursor
                    report["results"].append(entry)
                    write_repair_report(report, report_path)
                    print(f"repair {slug}: {entry['status']} {entry.get('error', '')} start_after={cursor}", flush=True)
                if not has_more:
                    report["complete"] = True
                    break
            if not upper:
                report["complete"] = True
    except Exception as error:
        report["error"] = safe_error(error)
        raise
    finally:
        write_repair_report(report, report_path)
        print("repair-summary " + json.dumps({k: v for k, v in report.items() if k != "results"}), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--reconcile", action="store_true")
    parser.add_argument("--repair-all", action="store_true")
    parser.add_argument("--start-after", default="")
    parser.add_argument("--max-projects", type=int, default=1000)
    parser.add_argument("--report")
    args = parser.parse_args()
    if args.repair_all:
        if args.check_only or args.reconcile:
            parser.error("--repair-all cannot be combined with queue flags")
        report = repair_all(args.start_after, args.max_projects, args.report)
        if report["failed"] or not report["complete"]:
            raise RuntimeError("Manual repair has failures or more pages; inspect the report")
        return
    if run_once(check_only=args.check_only, reconcile=args.reconcile):
        raise RuntimeError("Thumbnail capture completed with failures")


if __name__ == "__main__":
    main()
