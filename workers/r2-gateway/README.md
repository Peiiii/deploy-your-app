# R2 Gateway Worker (`gemigo-apps-r2-gateway`)

This Worker serves deployed apps from a Cloudflare R2 bucket behind a wildcard domain, and provides per-app thumbnails:

- Origin for `https://<slug>.gemigo.app/*`
- Reads static assets from an R2 bucket (binding `ASSETS`)
- Serves optimized screenshots from R2 and a temporary SVG until the scheduled capture workflow writes a real image
- Serves legacy `__thumbnail.png` from R2, falling back to the optimized WebP object

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
compatibility_date = "2025-01-01"

routes = [
  "*.gemigo.app/*"
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

3. **Screenshot capture**

The scheduled `.github/workflows/capture-thumbnails.yml` workflow reads recent public apps from D1, checks which thumbnails are missing, captures real pages in Chromium, and writes `apps/<slug>/thumbnail.webp` to R2. The gateway reports `202` on a pending HEAD request and `200` once a cover exists.

The legacy PNG route still works independently:

- On `https://<slug>.gemigo.app/__thumbnail.png`:
  - Check R2 for `apps/<slug>/thumbnail.png`.
  - If missing, serve `apps/<slug>/thumbnail.webp` when available.

---

## Deploy

From repo root:

```bash
cd workers/r2-gateway
pnpm exec wrangler deploy
```

After deploy:

- Visiting `https://<some-existing-slug>.gemigo.app/` should serve the app.
- `https://<slug>.gemigo.app/__thumbnail.png` should return a PNG or WebP when a cover is available.
