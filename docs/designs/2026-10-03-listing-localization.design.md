# Listing description localization

Source: user reports English introductions in Chinese Explore and asks whether it will recur. Managed implementation/production authorization from AGENTS. Bugfix, reproduce via Geeglo English original shown in zh UI; L3 persistent translation lifecycle. Design required; plan not required (one cohesive fix); retrospective pending.

## User result and paths
1. Open Explore in Chinese: application names retain their identity; introduction selects author-provided Chinese, then current generated Chinese, then original when translation is pending/unavailable. Switch website UI to English: the same cards use English immediately, without changing app-language filter or refetching/paginating. Homepage, feed, preview and public profile use the same description resolver.
2. Existing public Live descriptions receive one bounded operational backfill (direct D1 audit: 563/564 have no localization object). An author changes an introduction using existing display settings: original text remains authoritative, old generated translations stop being eligible immediately; scheduled owner produces translations for the new source. Explicit author locale entries always win. Private/deleted apps are not sent to the model.
3. Translation unavailable/invalid: no false success or language guesses; original remains available, bounded retries back off and do not starve later jobs. No synchronous AI calls while browsing or publishing.

## Owners and frozen design
Reuse localized_metadata, its normalizer and existing MetadataService, ProjectRepository, AIService and scheduled Worker; no parallel language database or new public endpoint. Add generatedDescriptions cache inside existing localization: exact source description, zh/en text and operational retryAfter. When localization was absent, its default und entry preserves original name/description without inferring application language. Never mutate flat original, author locales, app_language, slug/category/tags or deployment revision. MetadataService schedules public Live nonblank descriptions missing author/current generated zh or en. Repository atomically writes only the cache JSON path, guarded by original description and live/public/nondeleted state; merge against current localized_metadata preserves in-flight author edits. New source bypasses previous backoff. No current consumers need title translation; product names are preserved.

Frontend carries localization alongside existing card mapping; its existing reactive i18n consumers resolve descriptions at render time. Author locales match exact then primary language (zh-CN/zh-Hans/zh-cn → zh). Generated cache is usable only when source equals current description. Existing metadata normalizer/merge must preserve cache; stale source mismatch rejects old text. Expose no translation-control UI or redundant metadata row.

Options: per-view AI translation makes browse depend on model latency/cost; rewriting original description loses author/source identity and English view. Cached locale projection best preserves owners and repeatability. Existing author localization stays highest priority; all generated text is translation only, no invented claims.

## Active acceptance contract LL v1
| ID | Required | Observable criterion | Status / evidence |
|---|---|---|---|
| LL01 | yes | zh/en display selects matching description immediately across public cards/feed/profile; content preference unchanged | not-run |
| LL02 | yes | existing public descriptions backfilled; original/author translations and app languages preserved | not-run |
| LL03 | yes | new/edited source eligible; stale translations rejected; failures retry fairly; private/deleted/racing source guarded | not-run |
| LL04 | yes | type/lint/assembled D1 and metadata regressions; review clear; commit/master/production and real UI proof | not-run |

## Design review
Passed: original UI failure reproduced by resolver reading only project.description. Localized fields already exist but were not consumed. Checked both original-English and Chinese/Thai inputs, author locale precedence, no source overwrites, language switching without request race, state restoration and private/stale writes. Cache kept at existing localization owner, not appLanguage. Exact-source guard avoids hashed/version truth duplication. Shared SQL write specification has two current consumers (runtime repository and bounded CLI backfill), avoiding divergent migration guards. Missing descriptions cannot be translated and retain existing empty state; generating descriptions is the existing enrichment owner outside this translation fix. Original fallback during pending/model outage is disclosed; it is temporary, not permanent mixed-language data. No open findings.

Implementation review: manual diff-only review (no project maintainability entry) passed after real D1 tests and metadata policy/app-language HTTP regressions. Guarded JSON-path writes preserve originals, app languages and concurrent author locales; stale generated cache cannot become eligible after edits. No open findings. Remaining LL02/LL04 require production backfill and UI proof.

Production backfill revision / re-review passed: local model keys are invalid; avoid exposing or retrieving production secrets and avoid a new endpoint. Use the same scheduled MetadataService with a temporary bounded batch override (max100, concurrency5, 20s per request), default three afterward. Cloudflare scheduled wall-time permits this bounded batch; successful writes land individually. Remove the production override after the catalog drains. This is the current operational consumer; CLI backfill remains usable with valid explicit model credentials and imports only model env fields, never unrelated Cloudflare credentials. No secrets changed.
