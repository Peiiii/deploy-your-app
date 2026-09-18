# Private Feedback Threads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert website feedback from a hidden public board into private, forum-style threads visible only to each author and GemiGo administrators.

**Architecture:** Enforce ownership at the Worker service and SQL query layers, then present the same private thread model as “My feedback” for users and a filtered inbox for administrators. Keep the existing post/comment tables, remove voting from the API and UI, and treat comments as chronological replies.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, Cloudflare Workers, D1, pnpm.

---

### Task 1: Enforce the private API boundary

**Files:**
- Modify: `workers/api/src/repositories/community.repository.ts`
- Modify: `workers/api/src/services/community.service.ts`
- Modify: `workers/api/src/controllers/community.controller.ts`
- Modify: `workers/api/src/utils/error-handler.ts`
- Modify: `workers/api/src/routes.ts`
- Modify: `workers/api/src/types/community.ts`

**Steps:**

1. Add a 403 `ForbiddenError` for authenticated callers without permission.
2. Require authentication for feedback lists and reply lists.
3. Scope non-admin SQL list queries to the current user while preserving the administrator-wide inbox.
4. Guard every reply read/write/delete with post ownership or administrator access.
5. Remove feedback voting routes and response fields without dropping the compatibility table.
6. Update a post's activity timestamp when a reply is created and sort inboxes by latest activity.
7. Verify anonymous requests return 401 and cross-user requests return 403.

### Task 2: Build the private-thread frontend

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/services/http/community-api.ts`
- Modify: `frontend/src/features/community/stores/community.store.ts`
- Modify: `frontend/src/features/community/managers/community.manager.ts`
- Modify: `frontend/src/features/community/pages/community-page.tsx`
- Modify: `frontend/src/features/community/components/feedback-card.tsx`
- Modify: `frontend/src/features/community/components/feedback-composer.tsx`
- Modify: `frontend/src/i18n/locales/zh-cn.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Steps:**

1. Remove voting and public-board language from the client contract.
2. Load feedback for every signed-in user and clear private state when identity changes or signs out.
3. Show “My feedback” to regular users and the combined inbox with filters to administrators.
4. Add an explicit author-and-team-only privacy notice beside the submission entry and in the composer.
5. Render the original post followed by chronological replies, using a multiline reply composer.
6. Reload the private list after submission so the new thread is immediately visible.
7. Verify signed-out, regular-user, and administrator states visually.

### Task 3: Quality gate and smoke test

**Files:**
- Review all files changed in Tasks 1 and 2.

**Steps:**

1. Run `pnpm lint` and expect no errors.
2. Run `pnpm typecheck` and expect no errors.
3. Run `pnpm build:frontend` and expect a successful build.
4. Exercise the local API with two users and verify private isolation and replies.
5. Review the community page in Chinese and English, desktop and mobile.
