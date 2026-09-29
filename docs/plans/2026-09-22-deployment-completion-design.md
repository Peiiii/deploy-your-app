# Deployment completion consistency

## Evidence
The Odd Little Lab CLI deployment succeeded at its live URL, while D1 held project status Building, URL NULL, and its attempt accepted. The start controller fires an unawaited background SSE monitor. Cloudflare may terminate it once the POST response returns. Adding waitUntil alone only extends execution by 30 seconds and does not cover builds.

## Decision
Persist terminal status in the active client SSE response before forwarding SUCCESS. Use a two-minute scheduled reconciliation of accepted attempts (latest attempt per project, last 24 hours, bounded batch of 20 and five-second connection deadline) to recover disconnected clients. Only builder-reported terminal status can complete an attempt. Older builders replay SUCCESS without metadata; derive the configured R2 URL only after the site's index asset exists. Reject unverified success. Do not let an old attempt overwrite the latest deployment. Database errors propagate; they are not malformed JSON.

Compared with waitUntil, this handles long builds. A Queue/Workflow or authenticated builder callback would add infrastructure and builder deployment changes; bounded D1 reconciliation uses existing infrastructure for this fix.

## Verification and release
Regression tests: persistence before success, failed writes, split frames, replay without metadata, missing assets, stale attempts, failure result. Run lint/typecheck, existing metadata tests and Worker production bundle. Commit and push only these changes, verify remote SHA, deploy only gemigo-api with remote variables preserved. Replay the affected deployment through the repaired endpoint, verify D1 and anonymous Explore discovery, then re-deploy the same site to verify the live CLI path without creating a duplicate project. Check scheduled/disconnected completion as well.
