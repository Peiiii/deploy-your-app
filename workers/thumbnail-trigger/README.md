# Incremental GitHub thumbnail capture

Cloudflare Cron runs every two minutes and queries the indexed, due portion of
`thumbnail_jobs` in the existing projects D1 database. Empty means no GitHub API
request, workflow dispatch, R2 read, or browser. Pending work dispatches
`capture-thumbnails.yml` with `reconcile=false`, unless a run is active/queued.
There is no Aliyun process, browser container, or public HTTP endpoint.

`workers/api/migrations/0003_thumbnail_jobs.sql` installs the pending table and
two project triggers. Both existing project writers (API and Node backend) use
that same database: eligible public Live releases, redeployments and visibility
changes enqueue one task per project. Ineligible updates cancel it; hard deletes
cascade. A random generation prevents an old capture from clearing a new task.
The table owns outstanding work only; R2 remains the authority for covers.

GitHub processes at most 20 due jobs. It uses R2 S3 `head_object` directly,
accepting WebP or legacy PNG larger than 80 bytes, matching the image gateway.
Existing covers finish tasks without Chromium. Captures retain the size/format
limits, recheck task identity and cover existence, and conditionally create
`apps/<slug>/thumbnail.webp` without overwriting a concurrent cover. Failures
retry after 2/4/8 minutes up to one hour, and don't block other apps. Error logs
contain types/HTTP status, never credentials or upstream response bodies.

An hourly, offset GitHub schedule repairs the latest 50 public Live apps; manual
dispatch defaults to this repair too. It is best effort, not the timely trigger.
This bounded check handles existing missing covers and objects deleted outside
the queue; it does not scan all historical apps. Repair preserves queued retry
backoff. D1 repair queries use the existing project sort index, not `datetime()`.

At idle, normal scheduling costs approximately 720 Worker invocations and 720
small indexed D1 queries per day, with zero R2/GitHub work. Hourly repair costs
at most 100 R2 HEADs for 50 apps (two possible keys each), or 2,400/day if all
24 schedules run. It never invokes the image gateway Worker for readiness.
These are workload bounds, not a guarantee about the account's total bill.
The public repository uses standard free GitHub runners.

Configure `GITHUB_DISPATCH_TOKEN` as a Cloudflare Secret. Prefer a fine-grained
GitHub token with Actions read/write for this repository. An existing authorized
login token also works but has wider permissions; restrict it to this no-route
Worker, and rotate/revoke it through GitHub. Never commit/log tokens.

Deployment order: validate locally, execute only the additive migration on the
projects database, publish the workflow/script, then deploy the trigger Worker.
Do not reapply older migrations blindly. No API/Node backend deployment is needed.

```bash
pnpm exec wrangler d1 execute gemigo-projects --remote --config workers/api/wrangler.toml --file workers/api/migrations/0003_thumbnail_jobs.sql
pnpm exec wrangler secret put GITHUB_DISPATCH_TOKEN --config workers/thumbnail-trigger/wrangler.toml
pnpm exec wrangler deploy --config workers/thumbnail-trigger/wrangler.toml
pnpm exec wrangler tail --config workers/thumbnail-trigger/wrangler.toml --format json
```

Logs record `thumbnail-trigger` with the timestamp and `empty`, `busy`, or
`dispatched`. Database/GitHub failures fail that Cron invocation and retry next
tick. Each GitHub request has a ten-second timeout. Python logs D1 rows read,
individual R2 HEADs, queued/pending counts, saved images and deferred retries.
Use manual `reconcile=true` dispatch to fill existing gaps after initial setup.
Verify two actual scheduled events; deployment success alone is insufficient.
The original Cron activation took about 28 minutes before its first event.

An accessible new public app should acquire a real homepage cover within five
minutes at normal light load. Runner queueing, unavailable apps, or large batches
can take longer. The homepage continues using the same R2 cover and polling.

To pause, set `crons=[]` and deploy. Roll back the Worker and workflow/script to
restore the old scan; the additive table may remain. To remove producers, drop
only `thumbnail_jobs_insert` and `thumbnail_jobs_update`. Do not modify project
or R2 data. Rolling forward again is safe: migration statements are idempotent.

Checks:

```bash
pnpm exec tsc -p workers/thumbnail-trigger/tsconfig.json
pnpm exec eslint workers/thumbnail-trigger/worker.ts scripts/test-thumbnail-trigger.ts
./server/node_modules/.bin/tsx scripts/test-thumbnail-trigger.ts
python3 -B -m unittest discover -s scripts -p 'test_capture_missing_thumbnails.py'
actionlint .github/workflows/capture-thumbnails.yml
```
