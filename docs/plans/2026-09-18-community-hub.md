# Community Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the premature public feedback feed with localized WeChat and Discord community entrances plus one shared feedback form.

**Architecture:** Keep the existing feedback API as the single source of truth. Render external community configuration through a dedicated config module, show the public submission experience to all users, and expose the feedback feed only as an administrator inbox.

**Tech Stack:** React 19, TypeScript, Zustand, i18next, Tailwind CSS, Cloudflare Workers, D1.

---

### Task 1: Add external community configuration

**Files:**
- Create: `frontend/src/features/community/community-config.ts`
- Create: `frontend/.env.example`

**Steps:**

1. Define optional WeChat QR and Discord invite configuration.
2. Validate Discord URLs before exposing an external link.
3. Document the two environment variables.
4. Run `pnpm typecheck`.

### Task 2: Build localized community entrance cards

**Files:**
- Create: `frontend/src/features/community/components/community-channel-card.tsx`
- Modify: `frontend/src/features/community/pages/community-page.tsx`
- Modify: `frontend/src/i18n/locales/zh-cn.json`
- Modify: `frontend/src/i18n/locales/en.json`

**Steps:**

1. Build accessible WeChat QR and Discord invitation cards.
2. Prioritize card order from the selected interface language without hiding either option.
3. Show a deliberate unconfigured state when credentials are absent.
4. Replace the public feed with the shared feedback call to action.

### Task 3: Preserve a manageable feedback inbox

**Files:**
- Modify: `frontend/src/features/community/pages/community-page.tsx`
- Modify: `frontend/src/features/community/managers/community.manager.ts`

**Steps:**

1. Load feedback only for authenticated administrators.
2. Refresh permissions whenever authentication changes.
3. Keep existing sorting, filtering, comments, deletion, and status controls in the admin-only inbox.
4. Avoid loading the public list after ordinary users submit feedback.

### Task 4: Verify delivery

**Files:**
- Modify only files found defective during verification.

**Steps:**

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm build:frontend`.
4. Check Chinese and English layouts on desktop and mobile, including missing-config states and dark mode.
