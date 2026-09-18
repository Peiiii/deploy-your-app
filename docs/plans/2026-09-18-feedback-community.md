# Feedback Community Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-party feedback community where users can publish, vote, discuss, and track product feedback.

**Architecture:** Add an isolated feedback domain to the API Worker with D1 repository, service, controller, and routes. Add a frontend API client, Zustand store, class-based manager, routed page, navigation entry, and bilingual copy; reuse existing authentication and public author data.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Cloudflare Workers, D1, i18next.

---

### Task 1: Define feedback contracts

**Files:**
- Create: `workers/api/src/types/community.ts`
- Modify: `frontend/src/types.ts`

**Steps:**

1. Define post, comment, category, status, sort, permissions, and paginated response contracts.
2. Run `pnpm typecheck`; the new standalone contracts must compile.

### Task 2: Implement D1 persistence

**Files:**
- Create: `workers/api/src/repositories/community.repository.ts`

**Steps:**

1. Add idempotent schemas for posts, votes, and comments with query indexes.
2. Implement list/detail/create/vote/comment/status/delete operations and author joins.
3. Keep all class methods as arrow functions unless a language constraint requires otherwise.
4. Run `pnpm typecheck`.

### Task 3: Implement API business rules and routes

**Files:**
- Create: `workers/api/src/services/community.service.ts`
- Create: `workers/api/src/controllers/community.controller.ts`
- Modify: `workers/api/src/routes.ts`

**Steps:**

1. Add validation, permissions, rate limits, and viewer-specific response mapping.
2. Add public list/comment reads and authenticated create/vote/comment/delete mutations.
3. Add admin-only status updates.
4. Run `pnpm lint` and `pnpm typecheck`.

### Task 4: Add frontend state and orchestration

**Files:**
- Create: `frontend/src/services/http/community-api.ts`
- Create: `frontend/src/features/community/stores/community.store.ts`
- Create: `frontend/src/features/community/managers/community.manager.ts`
- Modify: `frontend/src/constants.ts`
- Modify: `frontend/src/presenter.ts`

**Steps:**

1. Implement typed API calls for all community actions.
2. Model list filters, composer state, expanded comments, loading, and errors in Zustand.
3. Implement class-based manager actions that coordinate API, auth modal, and store updates.
4. Run `pnpm typecheck`.

### Task 5: Build the community experience

**Files:**
- Create: `frontend/src/features/community/pages/community-page.tsx`
- Create: `frontend/src/features/community/components/feedback-composer.tsx`
- Create: `frontend/src/features/community/components/feedback-card.tsx`
- Modify: `frontend/src/routes.tsx`
- Modify: `frontend/src/components/sidebar/sidebar-navigation.tsx`
- Modify: `frontend/src/i18n/locales/zh-cn.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Steps:**

1. Build the page header, summary, sorting/filter controls, empty/loading/error states, and responsive list.
2. Build feedback publishing with accessible fields and clear limits.
3. Build cards with vote, status, author, comments, admin status control, and deletion controls.
4. Add `/community`, navigation, and bilingual labels.
5. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build:frontend`.

### Task 6: Visual and regression verification

**Files:**
- Modify only files found defective during verification.

**Steps:**

1. Start the local frontend/API development environment.
2. Verify desktop and compact layouts, light/dark themes, loading/empty/error states, and unauthenticated write prompts.
3. Fix visible regressions.
4. Re-run `pnpm lint`, `pnpm typecheck`, and `pnpm build:frontend`.
