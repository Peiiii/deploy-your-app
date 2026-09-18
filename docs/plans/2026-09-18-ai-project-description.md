# AI Project Description Bug Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore AI-generated project descriptions for deployments where users did not provide one, without overwriting manual metadata.

**Architecture:** Add a class-based metadata enrichment policy used by the API Worker deployment orchestration. Trigger enrichment whenever required metadata is missing rather than only when the slug is missing, and keep a deterministic source-aware fallback for AI failures and legacy UI records.

**Tech Stack:** TypeScript, Cloudflare Workers, D1, React, Node/tsx smoke tests.

---

### Task 1: Reproduce the metadata skip

**Files:**
- Create: `scripts/test-deployment-metadata-policy.ts`
- Create: `workers/api/src/services/deployment-metadata-policy.ts`

1. Add assertions showing that an existing slug with a missing description still requires enrichment.
2. Run the test and verify it fails before the policy exists.
3. Implement the minimal class API required by the test.
4. Verify manual descriptions are recognized as complete only when the other discovery metadata is also present.

### Task 2: Repair deployment enrichment

**Files:**
- Modify: `workers/api/src/services/deploy.service.ts`
- Modify: `workers/api/src/controllers/deploy.controller.ts`

1. Replace the slug-only early return with policy-based missing-metadata detection.
2. Keep existing valid slugs stable while filling missing description, category, and tags.
3. Persist only missing fields and preserve user-authored values.
4. Use source context to build a description when AI returns an empty result.

### Task 3: Improve the legacy display fallback

**Files:**
- Modify: `frontend/src/utils/project.ts`

1. Replace the universal fallback sentence with a project-specific description.
2. Prefer category and tags where present and always include the project name.
3. Keep the fallback presentation-only so a later redeploy can still persist an AI description.

### Task 4: Verify and release

**Files:**
- Modify: `package.json`

1. Add and run the metadata policy regression script.
2. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build:frontend`.
3. Run Worker deployment dry-run with production variables preserved.
4. Commit task files, push `master`, and verify the remote SHA equals local `HEAD`.
5. Deploy the API Worker before the frontend.
6. Verify the production API and page, then report the exact commit and production links.
