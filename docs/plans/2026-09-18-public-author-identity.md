# Public Author Identity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace translated author strings with one privacy-safe, stable public-author model shared by the API and frontend.

**Architecture:** A new `@gemigo/public-author` workspace package owns public identity resolution. The API enriches public project/profile payloads with semantic identities, while React formats anonymous identities at render time with the current locale.

**Tech Stack:** TypeScript, Cloudflare Workers, React 19, i18next, pnpm workspaces

---

### Task 1: Shared public-author domain

**Files:**
- Create: `packages/public-author/package.json`
- Create: `packages/public-author/tsconfig.json`
- Create: `packages/public-author/src/index.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `frontend/package.json`
- Modify: `workers/api/package.json`

1. Define `PublicAuthorIdentity`, identity kinds, safe-label normalization,
   GitHub source attribution, and stable pseudonym generation.
2. Add workspace dependencies and a TypeScript project reference.
3. Verify package compilation with `pnpm typecheck` after integration.

### Task 2: API enrichment

**Files:**
- Modify: `workers/api/src/types/project.ts`
- Create: `workers/api/src/services/public-author.service.ts`
- Modify: `workers/api/src/services/explore.service.ts`
- Modify: `workers/api/src/services/profile.service.ts`

1. Add `publicAuthor` to public project and profile response types.
2. Implement bulk user lookup and domain resolution in a class whose methods are
   arrow functions.
3. Replace Explore's duplicated display-name filtering with the service.
4. Return the same identity from public profile responses.

### Task 3: Locale-reactive frontend rendering

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/author.ts`
- Modify: `frontend/src/utils/project.ts`
- Modify: `frontend/src/components/explore-app-card.tsx`
- Modify: `frontend/src/features/explore/components/explore-feed.tsx`
- Modify: `frontend/src/features/profile/pages/public-profile.tsx`
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/zh-cn.json`

1. Store semantic `PublicAuthorIdentity` objects on mapped cards.
2. Add backward-compatible resolution for older API responses.
3. Format the label from the current `t` function in every render surface.
4. Preserve stable avatar colors and safe profile links.

### Task 4: Regression tests and quality gates

**Files:**
- Create: `scripts/test-public-author.ts`
- Modify: `package.json`
- Modify: `scripts/test-product-analytics.ts`

1. Move author assertions out of the unrelated analytics test.
2. Test precedence, privacy, stable pseudonyms, GitHub legacy behavior, and
   live locale formatting.
3. Run `pnpm test:public-author`.
4. Run `pnpm lint`.
5. Run `pnpm typecheck`.
