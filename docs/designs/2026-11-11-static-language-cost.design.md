# Static application language detection

## Source, decision and scope

On 2026-11-11 the owner requested removal of Cloudflare browser execution and explicitly selected code-based detection from HTML descriptions and similar source metadata. This supersedes the rendered-browser/model portions of EL04 and EL06 in `2026-10-02-explore-languages.design.md`; author corrections, privacy, release guards and feed behavior remain unchanged. Flow standard, risk L4, one delivery, plan not required, retrospective pending.

GitHub Actions already owns thumbnail capture. The separate `gemigo-screenshot-service` still serves rendered text for `ProjectLanguageService`, called by the two-minute reconciliation cron. Remove this browser/model chain rather than merely hide its cost or add another fallback. Read at most 128 KiB of static HTML from the validated public project origin with a ten-second timeout and no redirects, cookies, script loading, or model calls. Infer only from explicit HTML language/locale metadata, title/descriptions, static interface text and distinctive scripts; ambiguous source-only shells remain unknown. Author declarations remain authoritative.

Retire all endpoints of the old screenshot Worker with HTTP 410 and remove its Browser binding, so old callers cannot start paid sessions. Remove the API's service binding and unused AI language classifier. Retain the existing scoped operational scan token because the deployed backfill client still uses it for admin authorization. Do not alter GitHub capture workflows or stored thumbnails.

## User and recovery paths

New public deployment → bounded static HTML request → deterministic evidence/unknown → existing release-guarded write → existing language filter. Manual author correction still wins. Failed fetch backs off and preserves the last result. Setting no language for a sparse JavaScript shell is an intentional replacement for paid rendering, not a failed deployment. Reverting the source can restore the old mechanism, but browser allocation must not be re-enabled without explicit owner approval.

## Active acceptance contract SC v1

| ID | Required | Result | Evidence |
| --- | --- | --- | --- |
| SC01 | yes | Static metadata/text detection; no browser/model calls | passed — test-app-languages validates zh/th/fr/pt, sparse shells/ambiguous text and capped reads; fetch spy permits only the app URL |
| SC02 | yes | Author/private/deleted/release guards and fetch backoff remain | passed — real D1/API ownership, revision and backoff tests |
| SC03 | yes | Old screenshot endpoint cannot allocate browsers; binding removed | pending |
| SC04 | yes | GitHub cover pipeline and existing public API stay usable | passed locally — thumbnail performance suite, API/D1 filtering and authorization regression; workflows untouched |
| SC05 | yes | Targeted checks/review, production verification and master sync | pending |

Design review passed: a static HTTP request reuses the existing gateway's deployment-pointer owner instead of duplicating R2 publication resolution. Rejection/unknown is preferable to executing a browser or guessing English from an empty shell. Reads and decoding are bounded; untrusted application HTML is never executed. No new infrastructure or dependency is required.

Implementation review: no findings. Worker TypeScript build and targeted ESLint pass. The test fixture now lists its bundled ESModule explicitly because the current API contains dynamic Worker-loading imports; this avoids unrelated module-discovery failure without changing production behavior. The existing scoped backfill token is retained only for a real admin consumer. The lockfile importer removes Puppeteer; no replacement browser dependency is introduced.
