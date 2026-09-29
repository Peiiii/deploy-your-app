# Screenshot Service Worker (`gemigo-screenshot-service`)

This Worker uses Cloudflare Browser Run (Puppeteer) to generate app thumbnails. It consumes `gemigo-thumbnail-jobs` one job at a time, writes WebP to R2, and retries failed jobs. Its HTTP screenshot endpoint remains available for legacy callers.

- Entry: `worker.ts`
- Deployed name (per `wrangler.toml`): `gemigo-screenshot-service`
- Primary caller: `workers/r2-gateway` via the `THUMBNAIL_QUEUE` binding

---

## Local development

This Worker depends on Cloudflare Browser Rendering, which is only available in the Cloudflare environment. For day-to-day work you can usually rely on staging/production and logs.

To run locally (for basic type/runtime checks):

```bash
cd workers/screenshot-service
pnpm install           # if not already installed at repo root
pnpm exec wrangler dev
```

> Note: Browser Rendering may not fully work in `wrangler dev` unless configured with a compatible account and `BROWSER` binding. Treat local dev as best-effort for this Worker.

---

## Production configuration

Defined by `workers/screenshot-service/wrangler.toml`:

```toml
name = "gemigo-screenshot-service"
main = "worker.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[browser]
binding = "BROWSER"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gemigo-apps"

[[queues.consumers]]
queue = "gemigo-thumbnail-jobs"
max_batch_size = 1
max_concurrency = 1
```

### Steps in Cloudflare Dashboard

1. Deploy the Worker once:

   ```bash
   cd workers/screenshot-service
   pnpm exec wrangler deploy
   ```

2. In Cloudflare Dashboard → Workers & Pages → this Worker:
   - Enable **Browser Rendering**.
   - Ensure the `BROWSER` binding appears (matching the `[browser]` section).

No additional environment variables are strictly required here. If you want to secure it behind a token:

- Add a variable in this Worker, e.g. `SCREENSHOT_SERVICE_TOKEN="some-secret"`.
- Have callers (like `r2-gateway`) send `Authorization: Bearer <token>` and validate it in `worker.ts`.

Currently, the integration expects the R2 gateway to pass an optional `SCREENSHOT_SERVICE_TOKEN` header; if you decide to enforce it, add the corresponding check in this Worker.

---

## API shape

The Worker accepts either:

- `GET /?url=https://example.com`
- `POST /` with JSON body: `{ "url": "https://example.com" }`

It returns:

- `200` with `image/png` body on success.
- `400` with usage hint when `url` is missing.
- `500` with a simple error message if screenshot capturing fails.

The queue consumer stores optimized screenshots at `apps/<slug>/thumbnail.webp` and clears the app's pending marker. Keep the queue available before deploying either Worker.
