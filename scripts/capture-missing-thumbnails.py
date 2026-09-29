"""Capture recent public apps that do not yet have a thumbnail in R2."""

import base64
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

THUMBNAIL_URL = "https://assets.gemigo.app/thumbnails/{}.webp"
CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
MAX_IMAGES_PER_RUN = 20
MAX_BYTES = 300 * 1024


def recent_public_slugs():
    account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    database_id = os.environ["CLOUDFLARE_D1_DATABASE_ID"]
    token = os.environ["CLOUDFLARE_D1_API_TOKEN"]
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query"
    sql = """SELECT slug FROM projects
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
          AND is_public = 1 AND status = 'Live'
          AND url IS NOT NULL AND TRIM(url) != ''
        ORDER BY datetime(last_deployed) DESC LIMIT 50"""
    request = urllib.request.Request(
        url,
        data=json.dumps({"sql": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 GemiGoThumbnailCapture/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if not data.get("success") or not data.get("result") or not data["result"][0].get("success"):
        raise RuntimeError("D1 project query failed")
    return [row["slug"] for row in data["result"][0]["results"] if row.get("slug")]


def thumbnail_ready(slug):
    request = urllib.request.Request(
        THUMBNAIL_URL.format(slug),
        method="HEAD",
        headers={"User-Agent": "Mozilla/5.0", "Accept": "image/webp,*/*"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:
        if error.code == 202:
            return False
        raise


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


def main():
    required = (
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_D1_DATABASE_ID",
        "CLOUDFLARE_D1_API_TOKEN",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing D1 configuration: {', '.join(missing)}")

    slugs = recent_public_slugs()
    valid_slugs = [slug for slug in slugs if SLUG.fullmatch(slug)]
    with ThreadPoolExecutor(max_workers=10) as pool:
        ready = list(pool.map(thumbnail_ready, valid_slugs))
    pending = [slug for slug, is_ready in zip(valid_slugs, ready) if not is_ready]
    print(f"scanned={len(slugs)} pending={len(pending)}", flush=True)
    if "--check-only" in sys.argv:
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                output.write(f"pending={'true' if pending else 'false'}\n")
        return
    if not pending:
        return

    required = (
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing R2 configuration: {', '.join(missing)}")

    import boto3
    from playwright.sync_api import sync_playwright

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    saved = 0
    failed = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for slug in pending:
                if saved + failed >= MAX_IMAGES_PER_RUN:
                    break
                page = browser.new_page(viewport={"width": 960, "height": 540})
                try:
                    image = capture(page, slug)
                    s3.put_object(
                        Bucket=os.environ["R2_BUCKET_NAME"],
                        Key=f"apps/{slug}/thumbnail.webp",
                        Body=image,
                        ContentType="image/webp",
                        CacheControl=CACHE_CONTROL,
                    )
                    saved += 1
                    print(f"saved {slug}: {len(image)} bytes", flush=True)
                except Exception as error:
                    failed += 1
                    print(f"failed {slug}: {error}", file=sys.stderr, flush=True)
                finally:
                    page.close()
        finally:
            browser.close()

    print(f"completed: saved={saved} failed={failed} scanned={len(slugs)}")
    if failed:
        raise RuntimeError(f"{failed} screenshot(s) failed")


if __name__ == "__main__":
    main()
