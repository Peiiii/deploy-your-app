# Explore languages current state
- Flow standard, task feature, risk L3; active-contract EL v1 in ../../designs/2026-10-02-explore-languages.design.md.
- Parent goal: default understandable apps and accessible language switching on Explore; user requests implementation and viewing actual result.
- Source: current conversation 2026-10-02; default expected language, visible switch, remember later selection. Full managed authorization AGENTS.md.
- Design review passed; implementation in progress; retrospective pending. Open Required EL01–EL07.
- Worktree codex/explore-languages, source master initially 5f46d45. Main has unrelated frontend-experience and analytics WIP, protected through isolated worktree. No agents spawned.

## Integration and validation
- Integrated origin/master 37341bb in merge c6e6a7c; preserve master D1 queryExplorePage performance and shared Popover lifecycle. Language matching and language facets execute in one constant D1 batch; no full-catalog Worker scan.
- EL01/EL03/EL04 automated evidence: scripts/test-app-languages.ts real Miniflare HTTP/D1, browser defaults zh/th/en, persistence/all/storage blocking, author auth, manual/release/private guards, low-confidence/short unknown. Passed.
- Adjacent scripts/test-explore-performance.ts passed 206-candidate ranking, visibility, privacy and pagination; one batch / four prepared statements including language facets and current-page author query.
- Root tsc/lint, screenshot standalone tsc (DOM/module types), frontend production build, API/screenshot dry-run passed. Existing frontend bundle/Browserslist warnings only.
- EL02 local desktop/mobile real CUA render; phone menu clipping found and fixed with viewport-bound panel. User rejected native selector; replace with styled direct two-option buttons and shared more-language Popover. Updated screenshot tmp/explore-languages/menu-preview.png in primary workspace.
- Implementation review: project has no diff-only maintainability tool; manual diff/owner/race/security/UI review completed. Initial full-catalog pagination regression against concurrent master fixed by D1 integration; menu lifecycle reused, private scans short-circuit. No open findings; production delivery/backfill required for EL05–EL07. Retrospective pending.
