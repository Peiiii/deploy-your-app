"""Capture recent public apps that do not yet have a thumbnail in R2."""

import base64
import io
import os
import re
import sys
import urllib.error
import urllib.request

import boto3
from PIL import Image
from playwright.sync_api import sync_playwright


API_URL = "https://gemigo.io/api/v1/projects/explore?sort=recent&page=1&pageSize=50"
THUMBNAIL_URL = "https://assets.gemigo.app/thumbnails/{}.webp"
CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
MAX_IMAGES_PER_RUN = 20
MAX_BYTES = 300 * 1024


def request_json(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        import json

        return json.load(response)


def thumbnail_ready(slug):
    request = urllib.request.Request(THUMBNAIL_URL.format(slug), method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status == 200
    except urllib.error.HTTPError as error:
        if error.code == 202:
            return False
        raise


def capture(page, slug):
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
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing R2 configuration: {', '.join(missing)}")

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    items = request_json(API_URL)["items"]
    saved = 0
    failed = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for item in items:
                slug = item.get("slug", "")
                if not SLUG.fullmatch(slug) or thumbnail_ready(slug):
                    continue
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

    print(f"completed: saved={saved} failed={failed} scanned={len(items)}")
    if failed:
        raise RuntimeError(f"{failed} screenshot(s) failed")


if __name__ == "__main__":
    main()
