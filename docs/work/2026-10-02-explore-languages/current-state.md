# Explore languages current state

- Flow standard, feature, risk L3; active contract EL v1 in ../../designs/2026-10-02-explore-languages.design.md. Full managed authorization from AGENTS.md.
- Goal: understandable apps by default, visible content-language switching, manual preference memory, actual rendered app-language authority, author correction and production delivery.
- Design/revisions reviewed; implementation and local validation passed. EL01–EL07 current passed; delivered at the production entry, user visual acceptance pending. Retrospective completed; see decision below.
- Isolated codex/explore-languages worktree protected unrelated admin/analytics/frontend work. Integrated concurrent modern frontend and app-delivery changes through normal merges; no agents spawned.

## Effective UX revisions
- Styled website-language buttons, explicit 网站显示语言 / 想看哪些语言的应用？ / 应用支持的语言 names.
- Search-adjacent compact content button; all multi-selection/help/reset stays in its shared Popover. Mobile keeps a short 内容 prefix so it is distinguishable from website settings.
- User rejects a language row on every card: single-language lists omit it; all/multiple-language lists use a bounded inline label in the existing author/like footer. Shared preference remains sole owner. Local real 390px rendering confirms 32px footer and no horizontal overflow.

## Evidence
- Root typecheck/lint; screenshot standalone tsc; frontend production build; API/screenshot dry-run. Existing bundle >500kB warning remains outside this task.
- scripts/test-app-languages.ts passed actual Miniflare HTTP/D1 filters, browser zh/th/en/default/storage behavior, owner PATCH auth, rendered classifier policy, author/private/deleted/revision guards, service failures never stamped unknown, five-minute retry fairness and preserving valid prior classifications.
- scripts/test-explore-performance.ts passed actual 206-candidate D1 ranking/window/privacy/filters/pagination and constant indexed page query. A transient local ECONNRESET during machine/browser interruption resolved on a fresh isolated run; no test behavior changed.
- scripts/test-frontend-experience.mjs passed merged session/project/explore/profile stale-request and recovery contracts.
- Production CUA covered desktop and 390px compact menu, Thai and multi/all preference persistence, website/content language independence, browser reset, and empty recovery. Owned private QA project language English save/reload succeeded; reset saved and original unconfirmed state restored. Local regression covers redeploy/scanner author authority.
- No project maintainability script exists; manual diff-only implementation review covered repository query owner, secrets/scoped binding, stale writes, retry fairness, detector bounds, merged modern frontend, card label visibility/truncation and accessibility. No open findings.

## Production detection and backfill
- Puppeteer 1.0.x browser connect hung because the new runtime supplies Blob frames to an ArrayBuffer-only transport. Existing screenshot config now retains no_websocket_standard_binary_type; upstream cloudflare/puppeteer#193 and removal condition documented at its canonical config owner/design. Actual rendered zh/th scans then worked.
- Current API deployment 608bcb50-8b32-446e-a3e9-8d4b248863b9; screenshot cb2a9dbc-ad92-4e32-aefd-aba9f13b1f7a. Internal APP_CONTENT binding/token configured without replacing other secrets. Cron */2 scans max three; five-minute failure delay prevents head-of-queue starvation. Public browsing never scans.
- Entire visible catalog attempted. Public API snapshot on 2026-10-03 (Asia/Shanghai): 564 unique apps; known zh289, th198, en14, uk1, fa2 = 504; 48 valid insufficient-evidence unknown; 12 pending. Final bounded retry completed one more English app; 11 remaining apps returned HTTP404 and one content request failed. Unavailable apps stay retryable, never silently classified as unknown/English. This is coverage, not a claim of 100% language accuracy or whole-site multilingual support.
- Source fb4a228 (feature 6ae7ec7, retry fix f879cca) pushed normally to master and task branch; pnpm deploy:pages published gh-pages bc53c9b. Pages production 7b065777-9870-4162-ae1b-3e1d556d19f3; live index-DXXuYLpo.js SHA-256 946dbc5572bd7568818b6e7a75f0cb1a9fe26dd40b37aa15db9207651f430494 exactly matches build. Real production desktop single-language labels=0, mobile mixed-language footer=32px, no overflow. Main checkout fast-forward synchronized while preserving admin/analytics WIP.

## Handoff and boundaries
- Entry https://gemigo.io/explore; browser default single-language cards omit duplicate labels; choose all/multiple in the content button to see small inline labels. Website language changes do not alter app preferences. Project display settings allow author corrections.
- Unsupported, too-short, low-confidence, unavailable and login-protected applications are not guessed. Authors can confirm supported or language-independent behavior. A primary high-confidence interface language is detected, not exhaustive navigation/multilingual audit.
- User acceptance of visual preference remains pending; deployment and AI acceptance do not imply user approval.

## Retrospective decision
- Existing configuration owner and design record now capture the verified Puppeteer binary-frame incompatibility and its removal condition. Runtime fact updated in place; no separate knowledge authority.
- no-increment for global process/skills: the existing lifecycle/design/validation owners cover this case. Card metadata hierarchy and compact language controls were corrected in the product rather than promoted from this single UI preference into a universal rule.
- Required IDs all passed; current result is delivered for user experience acceptance, not claimed user-approved. Source, production entry, aggregate unknown/unavailable boundary and proof screenshots are documented.

Proof screenshots retained in the primary workspace (outside archived worktree): `tmp/explore-languages/card-language-production.png` and `tmp/explore-languages/card-language-mixed-mobile.png`.
