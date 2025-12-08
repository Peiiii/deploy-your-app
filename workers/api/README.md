# API Worker (`gemigo-api`)

This Worker provides the public `/api/v1/*` endpoints:

- Auth: email / Google / GitHub login, sessions (`/api/v1/auth/*`, `/api/v1/me`, `/api/v1/logout`)
- Projects CRUD in D1 (`/api/v1/projects`)
- Deploy proxy to the Node backend (`/api/v1/deploy`, `/api/v1/deployments/:id/stream`)

For a deeper architecture overview and API details, see:

- `../../docs/API_WORKER_ARCHITECTURE.md`
- `../../docs/AUTH_SETUP.md`
- `../../docs/ENVIRONMENT.md` (section “3.3 API Worker”)

---

## Local development

From repo root:

```bash
pnpm dev          # runs frontend + Node backend + this API Worker
```

Or just the Worker:

```bash
cd workers/api
pnpm dev          # wrangler dev
```

Local-only environment variables live in `.dev.vars` in this folder (this file is git-ignored):

```env
AUTH_REDIRECT_BASE = "http://localhost:5173"

GOOGLE_CLIENT_ID = "..."
GOOGLE_CLIENT_SECRET = "..."

GITHUB_CLIENT_ID = "..."
GITHUB_CLIENT_SECRET = "..."

PASSWORD_SALT = "local-dev-only-change-me"
DASHSCOPE_API_KEY = "optional-if-you-want-AI-features"
```

These values are injected into the Worker `env` and read via `configService` (`src/services/config.service.ts`).

---

## Production configuration

The production Worker is defined by `wrangler.toml`:

```toml
name = "gemigo-api"
main = "src/index.ts"
compatibility_date = "2025-01-15"
account_id = "..."

[vars]
APPS_ROOT_DOMAIN = "gemigo.app"
DEPLOY_TARGET = "r2"
PLATFORM_AI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
PLATFORM_AI_MODEL = "qwen3-max"
AUTH_REDIRECT_BASE = "https://gemigo.io"
DEPLOY_SERVICE_BASE_URL = "https://<your-node-backend>/api/v1"

[[d1_databases]]
binding = "PROJECTS_DB"
database_name = "gemigo-projects"
database_id = "..."
preview_database_id = "..."
```

There are two groups of variables:

### Non-sensitive (set in `wrangler.toml` [vars] or Dashboard Variables)

- `APPS_ROOT_DOMAIN`  
  Must match the domain used by the R2 gateway (for app URLs), e.g. `gemigo.app`.

- `DEPLOY_TARGET`  
  Typically `r2` in production, so URLs point to the R2 gateway domain.

- `PLATFORM_AI_BASE_URL`, `PLATFORM_AI_MODEL`  
  AI platform configuration (DashScope).

- `AUTH_REDIRECT_BASE`  
  Base URL of the frontend, used to build OAuth callback URLs and default post-login redirect.  
  In production this should be `https://gemigo.io`.

- `DEPLOY_SERVICE_BASE_URL`  
  Base URL of the Node deployment service, e.g. `https://builderapi.gemigo.io/api/v1`.  
  If not set, local dev defaults to `http://127.0.0.1:4173/api/v1`.

### Sensitive (set as Secrets in Cloudflare Dashboard)

Configure these via Dashboard → Workers & Queues → `gemigo-api` → Settings → Variables/Secrets, or via CLI:

```bash
cd workers/api
pnpm exec wrangler secret put PASSWORD_SALT
pnpm exec wrangler secret put DASHSCOPE_API_KEY
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

- `PASSWORD_SALT`  
  Used to hash email passwords (see `src/utils/auth.ts`).

- `DASHSCOPE_API_KEY`  
  Backend AI key used for metadata generation / analysis.

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  
  Google OAuth Web client credentials.

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`  
  GitHub OAuth app credentials.

> Detailed OAuth setup steps are in `../../docs/AUTH_SETUP.md`.

---

## Build and deploy

Type-check (optional, but recommended before deploy):

```bash
cd workers/api
pnpm exec tsc -p tsconfig.json
```

Deploy to Cloudflare:

```bash
cd workers/api
pnpm deploy        # wraps `wrangler deploy`
```

After deploy you can sanity-check:

- `GET https://<your-worker-domain>/api/v1/me` → `{ "user": null }` when not logged in
- `GET https://<your-worker-domain>/api/v1/projects` → list of projects (may be empty)

