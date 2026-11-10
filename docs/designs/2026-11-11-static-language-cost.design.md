# Static application language detection

## Source, decision and scope

On 2026-11-11 the owner requested removal of Cloudflare browser execution and explicitly selected code-based detection from HTML descriptions and similar source metadata. This supersedes the rendered-browser/model portions of EL04 and EL06 in `2026-10-02-explore-languages.design.md`; author corrections, privacy, release guards and feed behavior remain unchanged. Flow standard, risk L4, one delivery, plan not required, retrospective completed.

GitHub Actions already owns thumbnail capture. The separate `gemigo-screenshot-service` still serves rendered text for `ProjectLanguageService`, called by the two-minute reconciliation cron. Remove this browser/model chain rather than merely hide its cost or add another fallback. Read at most 128 KiB of static HTML from the validated public project origin with a ten-second timeout and no redirects, cookies, script loading, or model calls. Infer only from explicit HTML language/locale metadata, title/descriptions, static interface text and distinctive scripts; ambiguous source-only shells remain unknown. Author declarations remain authoritative.

Retire all endpoints of the old screenshot Worker with HTTP 410 and remove its Browser binding, so old callers cannot start paid sessions. Remove the API's service binding and unused AI language classifier. Retain the existing scoped operational scan token because the deployed backfill client still uses it for admin authorization. Do not alter GitHub capture workflows or stored thumbnails.

## User and recovery paths

New public deployment → bounded static HTML request → deterministic evidence/unknown → existing release-guarded write → existing language filter. Manual author correction still wins. Failed fetch backs off and preserves the last result. Setting no language for a sparse JavaScript shell is an intentional replacement for paid rendering, not a failed deployment. Reverting the source can restore the old mechanism, but browser allocation must not be re-enabled without explicit owner approval.

## Active acceptance contract SC v1

| ID | Required | Result | Evidence |
| --- | --- | --- | --- |
| SC01 | yes | Static metadata/text detection; no browser/model calls | passed — test-app-languages validates zh/th/fr/pt, sparse shells/ambiguous text and capped reads; fetch spy permits only the app URL |
| SC02 | yes | Author/private/deleted/release guards and fetch backoff remain | passed — real D1/API ownership, revision and backoff tests |
| SC03 | yes | Old screenshot endpoint cannot allocate browsers; binding removed | passed — production returns 410/BROWSER_SERVICE_RETIRED; control-plane settings confirm zero Browser bindings in screenshot/API Workers and no APP_CONTENT binding |
| SC04 | yes | GitHub cover pipeline and existing public API stay usable | passed — thumbnail performance suite, API/D1 filtering/auth regression; workflows untouched; live public API and public app HTML return 200 |
| SC05 | yes | Targeted checks/review, production verification and master sync | passed — Worker type build, targeted ESLint, app-language/API/D1 test, thumbnail test, frozen offline lockfile check, diff review; source 2aaf2db pushed master and local/remote aligned |

Design review passed: a static HTTP request reuses the existing gateway's deployment-pointer owner instead of duplicating R2 publication resolution. Rejection/unknown is preferable to executing a browser or guessing English from an empty shell. Reads and decoding are bounded; untrusted application HTML is never executed. No new infrastructure or dependency is required.

Implementation review: no findings. Worker TypeScript build and targeted ESLint pass. The test fixture now lists its bundled ESModule explicitly because the current API contains dynamic Worker-loading imports; this avoids unrelated module-discovery failure without changing production behavior. The existing scoped backfill token is retained only for a real admin consumer. The lockfile importer removes Puppeteer; no replacement browser dependency is introduced.

## Production evidence and retrospective

- Screenshot tombstone version: `a99aa98a-6390-43f3-ad1d-12ee25f921d3`; API version: `78c266d4-3ee7-4fd5-a252-1af3291b52ca`.
- 2026-11-11 01:37 Asia/Shanghai: retired content endpoint 410, public Explore API 200, public app static HTML 200. Browser Run dashboard reported no active browser sessions.
- Read-only D1 investigation found 12 pending public Live applications, all with retry metadata. The old bounded batch (up to 3 per two-minute cron, or 2,160/day) could repeatedly start browsers for these failures. Browser Run showed about 21k sessions and 26.32 browser-hours for Nov 1–11; these observations support the identified source, rather than a claim of per-session historical attribution.
- Retrospective decision: update the original language design's current-runtime notice and the retired service README. GitHub thumbnail capture and text/metadata detection are separate owners; a browser must not be silently restored as a convenience fallback. Preserve the existing release/manual guards and report unknown when static evidence is insufficient. No new global skill or background monitor was created.
