"""Process pending public-app covers; optionally repair the latest 50 apps."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import io
import json
import os
import re
import sys
import urllib.request

CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
MAX_IMAGES_PER_RUN = 20
MAX_BYTES = 300 * 1024
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
    status = getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")
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


def capture(page, slug):
    from PIL import Image

    target = f"https://{slug}.gemigo.app/"
    response = page.goto(target, wait_until="domcontentloaded", timeout=15000)
    if response is None or response.status >= 400:
        raise RuntimeError(f"App returned HTTP {response.status if response else 'unknown'}")
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


def run_once(check_only=False, reconcile=False):
    required = ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_D1_DATABASE_ID", "CLOUDFLARE_D1_API_TOKEN",
                "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing configuration: {', '.join(missing)}")

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

    from botocore.exceptions import ClientError
    from playwright.sync_api import sync_playwright

    saved = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for job in pending:
                slug = job["slug"]
                page = browser.new_page(viewport={"width": 960, "height": 540})
                try:
                    if not job_current(job):
                        continue
                    image = capture(page, slug)
                    if not job_current(job):
                        print(f"skipped {slug}: task changed during capture", flush=True)
                        continue
                    if thumbnail_ready(s3, slug):
                        complete_job(job)
                        continue
                    try:
                        s3.put_object(
                            Bucket=os.environ["R2_BUCKET_NAME"], Key=f"apps/{slug}/thumbnail.webp",
                            Body=image, ContentType="image/webp", CacheControl=CACHE_CONTROL,
                            IfNoneMatch="*",
                        )
                    except ClientError as error:
                        if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
                            raise
                        print(f"skipped {slug}: cover already saved", flush=True)
                    else:
                        saved += 1
                        print(f"saved {slug}: {len(image)} bytes", flush=True)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--reconcile", action="store_true")
    args = parser.parse_args()
    if run_once(check_only=args.check_only, reconcile=args.reconcile):
        raise RuntimeError("Thumbnail capture completed with failures")


if __name__ == "__main__":
    main()
