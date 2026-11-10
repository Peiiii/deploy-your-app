# Retired Cloudflare browser service

`gemigo-screenshot-service` now returns HTTP 410 (`BROWSER_SERVICE_RETIRED`) for every request. It has no Browser binding and cannot allocate browser sessions.

- Thumbnail generation is owned by `.github/workflows/capture-thumbnails.yml`, driven by `workers/thumbnail-trigger`.
- Application language detection reads bounded static HTML in `ProjectLanguageService`; it uses no rendering service or model.
- The API no longer has an `APP_CONTENT` service binding. Its existing `APP_CONTENT_TOKEN` only authorizes the scoped operational language-backfill endpoint.
- Keep this tombstone when deploying older callers; do not reintroduce Browser bindings to restore screenshot endpoints.
- Deployment: `pnpm --filter gemigo-screenshot-service run deploy`.
