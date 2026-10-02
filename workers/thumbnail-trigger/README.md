# GitHub thumbnail trigger

Cloudflare Cron invokes this Worker every two minutes. It checks recent runs
of `capture-thumbnails.yml`, skips while a run is active/queued, and otherwise
calls GitHub `workflow_dispatch` on master. Chromium, D1 reads and R2 uploads
remain in the existing GitHub Actions workflow and Python script.

No Aliyun process, browser container or public HTTP endpoint is needed.
The public repository uses standard free GitHub runners. This Worker makes
approximately 720 lightweight invocations/day and two GitHub requests per idle
invocation, within Cloudflare's free tier limits. GitHub `schedule` remains a
best-effort fallback, with its minutes offset from the hourly boundary.

Configure the `GITHUB_DISPATCH_TOKEN` Cloudflare Secret. Prefer a fine-grained
GitHub token with Actions read/write for `Peiiii/deploy-your-app`; an existing
authorized GitHub login token with repo access also works. The latter has wider
permissions: keep it only in this no-route Worker's Secret and rotate/revoke it
through GitHub if necessary. Never put the token in source files or log output.

From the repository root:

```bash
pnpm exec wrangler secret put GITHUB_DISPATCH_TOKEN --config workers/thumbnail-trigger/wrangler.toml
pnpm exec wrangler deploy --config workers/thumbnail-trigger/wrangler.toml
pnpm exec wrangler tail --config workers/thumbnail-trigger/wrangler.toml --format json
```

Logs record `thumbnail-trigger` with the scheduled timestamp and `dispatched`
or `busy`. GitHub failures/timeouts fail the Cron invocation and retry on the
next invocation. Each request has a ten-second timeout. Cron propagation can
take up to fifteen minutes after changes. No persistence or task queue is added.

An accessible new public app should acquire a real cover within five minutes
at normal light load. Runner queueing, unavailable apps and large batches may
take longer. Existing covers are preserved. The scan still covers the latest
50 public Live apps with at most 20 captures per run; this change does not expand
that historical scan window.

To pause, set `crons = []` and deploy. To recover a missing cover immediately,
run `capture-thumbnails.yml` manually in GitHub. Restore a previous Worker
version to roll back; existing R2 objects and backend deployments are untouched.

Checks:

```bash
pnpm exec tsc -p workers/thumbnail-trigger/tsconfig.json
pnpm exec eslint workers/thumbnail-trigger/worker.ts scripts/test-thumbnail-trigger.ts
./server/node_modules/.bin/tsx scripts/test-thumbnail-trigger.ts
python3 -B -m unittest discover -s scripts -p 'test_capture_missing_thumbnails.py'
```
