# R2 Gateway Worker (`gemigo-apps-r2-gateway`)

This Worker serves deployed apps from a Cloudflare R2 bucket behind a wildcard domain, and provides per-app thumbnails:

- Origin for `https://<slug>.gemigo.app/*`
- Reads static assets from an R2 bucket (binding `ASSETS`)
- Serves optimized screenshots from R2 and a temporary SVG until the GitHub capture workflow writes a real image
- Serves legacy `__thumbnail.png` from R2, falling back to the optimized WebP object
- Supplements missing browser-tab icons using the current page's logo (images, inline SVG with computed colors, CSS backgrounds, or short brand text), falling back to its title initial. Existing valid icons are retained. This runs on new and existing apps without changing their R2 source objects.
- Redirects the exact `gemigo.app` hostname to `https://gemigo.io/` with HTTP 301, preserving query parameters; all apex paths enter the homepage. This branch reads no R2 objects.

It is used together with the Node backend (`server`) and API Worker (`workers/api`) when `DEPLOY_TARGET = r2`.

---

## Local development

You typically do not need a special dev mode for this Worker; it is mostly a thin R2 gateway.

If you want to run it locally:

```bash
cd workers/r2-gateway
pnpm install      # if not already installed at repo root
pnpm exec wrangler dev
```

Make sure you have a test R2 bucket and DNS/hosts entry that resolves a test subdomain to the local dev URL.

---

## Production configuration

Defined by `workers/r2-gateway/wrangler.toml`:

```toml
name = "gemigo-apps-r2-gateway"
main = "worker.ts"
compatibility_date = "2026-09-18"

routes = [
  { pattern = "*.gemigo.app/*", zone_name = "gemigo.app" },
  { pattern = "gemigo.app", custom_domain = true }
]

[vars]
APPS_ROOT_DOMAIN = "gemigo.app"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gemigo-apps"

```

### Required pieces

1. **R2 bucket**
   - Create an R2 bucket, e.g. `gemigo-apps`.
   - In this Worker, bind it as:
     - `binding = "ASSETS"`
     - `bucket_name = "gemigo-apps"`
   - The Node backend will upload builds under:
     - `apps/<slug>/current/...`

2. **Domain and route**
   - DNS: configure `*.gemigo.app` to point at this Worker (via Cloudflare Routes).
   - `APPS_ROOT_DOMAIN` must match the root domain in DNS, e.g. `gemigo.app`.
   - The API Worker and backend use the same `APPS_ROOT_DOMAIN` to generate project URLs.
   - The apex Custom Domain lets Cloudflare manage DNS and certificates for `gemigo.app`. Only the exact root hostname redirects; `www` remains reserved and returns 404. Redirect responses use a five-minute cache lifetime.

3. **Screenshot capture**

The [Cloudflare trigger](../thumbnail-trigger/README.md) checks the indexed D1 queue every two minutes and invokes `.github/workflows/capture-thumbnails.yml` only when work is due and no automatic capture is active. The workflow captures missing covers for queued public apps in Chromium and conditionally writes `apps/<slug>/thumbnail.webp` to R2. Historical catalog repair is manual through `.github/workflows/repair-thumbnails.yml`; it runs independently and uses the same capture/upload implementation. There is no scheduled catalog scan. The gateway reports `202` on a pending HEAD request and `200` once a cover exists.

The legacy PNG route still works independently:

- On `https://<slug>.gemigo.app/__thumbnail.png`:
  - Check R2 for `apps/<slug>/thumbnail.png`.
  - If missing, serve `apps/<slug>/thumbnail.webp` when available.

---

## Deploy

### Browser-tab icons

The gateway injects a same-origin async script from `/__gemigo/favicon-runtime.v1.js` and a title-based SVG when an HTML page has no icon declaration. Downloading the helper does not postpone the app's DOMContentLoaded event. The script checks valid author/root icons first, then nonstandard declarations, touch icons, same-origin web manifests and visible logo/brand elements. A single graphic paired with the app title in a short navigation/header group also qualifies, covering React brands with no semantic logo class. Starting after document readiness, it waits up to ten seconds for dynamic DOM and slow image loads, then disconnects; manifest reads stop at 64 KiB and blank SVGs are rejected. Generated PNGs are local data URLs; cross-origin logos that cannot be exported from canvas retain their original image URL. No server-side arbitrary-URL fetch, browser job, database field or customer-source rewrite is involved.

Missing `/favicon.ico` serves an SVG instead of the SPA homepage. Original icons come only from the active publication, so deleting an icon on redeploy does not resurrect its previous version. Pages with CSP metadata or response headers receive no icon script/head injection; their existing policies remain authoritative. They can still receive the root default icon if their browser requests it and the policy allows it. Smart extraction has been verified in Chromium; other browsers and exceptionally slow dynamic rendering are compatibility boundaries.

Tests: `node scripts/test-app-delivery-runtime.mjs`, `./server/node_modules/.bin/tsx scripts/test-app-delivery-cache.ts`, and `node scripts/test-smart-favicon.mjs` (requires Playwright/Chromium; `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` can point to the installed desktop dependencies). The last test serves the actual Miniflare Worker over local HTTP without network interception, because Playwright's request routing aborts `/favicon.ico`. It checks both DOM output and Chrome's stored favicon bitmaps.

From repo root:

```bash
cd workers/r2-gateway
pnpm exec wrangler deploy
```

After deploy:

- Visiting `https://<some-existing-slug>.gemigo.app/` should serve the app.
- Visiting `https://gemigo.app/` should redirect to the homepage at `https://gemigo.io/`.
- `https://<slug>.gemigo.app/__thumbnail.png` should return a PNG or WebP when a cover is available.

### Product-built app analytics

HTML delivery includes `/__gemigo/analytics.v2.js`. Visible browser page loads, reloads and pathname/hash changes POST one small same-origin event to `/__gemigo/page-view`; document GETs, HEADs, resources and scanner fallback requests never write analytics. Known automation and `navigator.webdriver` are excluded. The gateway hashes an app-scoped anonymous browser UUID and event UUID before forwarding authenticated v2 pings. It does not forward IPs, full user agents, URLs or localStorage UUIDs to D1. Storage-blocked visits still contribute PV and are explicitly counted as unidentified, without inflating UV.

`project_page_views` in the existing API analytics repository is the atomic event owner; its trigger updates existing daily/hourly/unique/dimension projections. Event identities retain 35 days and cleanup runs daily at 03:00 UTC. Calendar-day 7/30-day UV is computed across the selected range, not by adding daily UV. The API reads `project_analytics_collection.started_at` to distinguish missing history from genuine zero visits. Set the collection start once, after enabling production gateway v2; do not recreate it on redeploy or infer it from a first visitor. Disable/rollback v2 should be accompanied by an explicit coverage boundary, since lack of browser events cannot prove zero traffic. CSP, script blockers, offline visits and old service-worker HTML may undercount; policies remain authoritative.

Developers use `/projects/<id>?tab=analytics` in GemiGo. Stats reads require the application's owner session and are private/no-store. `pnpm build:frontend` then `./server/node_modules/.bin/tsx scripts/test-app-analytics.ts` exercises actual browser, Worker, R2, API, D1 and settings UI boundaries (with Playwright installed, or the same runtime overrides as favicon tests).

### Google Fonts delivery

Small HTML pages (up to 1 MiB) receive delivery-only URL substitutions for Google Fonts stylesheet links, inline CSS imports and `fonts.gstatic.com` files. Same-origin `.css` stylesheet links receive `__gemigo_fonts=v1`; only those marked CSS responses and their same-origin CSS imports are transformed. Other relative resource paths retain their original directory. Original R2 objects, publication and rollback remain unchanged.

The fixed `assets.gemigo.app/__gemigo/google-fonts/v3/css[2]` and `file/s/...` endpoints allow GET/HEAD only, never forward visitor credentials, and refuse upstream redirects and incorrect or oversized content. CSS uses a fixed modern Chrome UA for WOFF2 and a one-day cache; versioned font files have a one-year cache. Both upstream connection and body reads share a 2.5-second deadline. CSS failure returns an uncached empty stylesheet so the author's fallback fonts can render; file failure returns uncached 503. `x-gemigo-font-cache` reports HIT, MISS, BYPASS or FALLBACK. No new service or R2 writes are involved; Worker requests and cold upstream subrequests still cost resources.

CSP policies are detected across the complete buffered HTML before substitutions. Restricted pages, SRI/use-credentials links, documents over the size limit, escaped CSS URL tokens and dynamically inserted links retain their original references. This is a bounded font optimization, not an arbitrary API proxy or a guarantee about every mainland carrier route. Tests: `node scripts/test-google-fonts.mjs` and existing app-delivery regression tests.

Google font styles are loaded without delaying the visual CSS: direct font links start with inactive media, and unconditional font imports become instantaneous data styles carrying a platform reference. An async helper restores loaded font links and discovers font references in same-origin CSSOM imports after document readiness. Conditional imports retain their original conditions. When JavaScript is unavailable or the helper cannot load, system fallback fonts remain readable. The previous font URL namespaces remain routable for already cached stylesheets. Browser regression uses `scripts/test-google-fonts-browser.mjs`, `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` and `GOOGLE_FONT_FIXTURE` (a real WOFF2 file).
