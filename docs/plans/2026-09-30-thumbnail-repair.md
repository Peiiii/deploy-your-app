# Project Thumbnail Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure newly deployed apps acquire real screenshot covers and visible cards replace temporary placeholders after generation.

**Architecture:** Keep the central R2 thumbnail endpoint and use a Cloudflare Queue for screenshot jobs. The gateway records a short-lived per-app enqueue marker, the screenshot Worker consumes jobs one at a time and writes WebP into R2, and visible cards check readiness before refreshing. Preserve legacy and uploaded covers.

**Tech Stack:** Cloudflare Workers, Browser Run Puppeteer, R2, React, TypeScript.

---

### Task 1: Reproduce and protect gateway behavior

**Files:** `workers/r2-gateway/worker.ts`, `scripts/test-thumbnail-performance.ts`

1. Add a test for missing thumbnail readiness and generated object readiness.
2. Run the thumbnail test to verify the new case fails.
3. Implement a HEAD readiness response with CORS and no generation side effect.
4. Run the thumbnail test.

### Task 2: Move generation to a durable queue

**Files:** `workers/screenshot-service/worker.ts`, `workers/screenshot-service/wrangler.toml`, `workers/r2-gateway/worker.ts`, `workers/r2-gateway/wrangler.toml`, `scripts/test-thumbnail-performance.ts`

1. Add source assertions or direct behavior tests for bounded navigation and resizing.
2. Replace network-idle navigation with DOM-ready navigation and a short settle period.
3. Encode at decreasing quality and viewport widths until the image is within the configured byte limit.
4. Enqueue each missing app once while its marker is fresh; consume jobs outside the gateway's 30-second background window.
5. Limit consumer concurrency, retry failures, write completed WebP to R2, and clear the marker.
6. Run the thumbnail test and Worker dry-runs.

### Task 3: Refresh visible cards after generation

**Files:** `frontend/src/components/explore-app-card.tsx`, optional shared hook for feed

1. When a visible thumbnail loads, query readiness without triggering another generation.
2. If still pending, poll briefly with a limit and refresh the image URL once ready.
3. Stop polling on unmount or image change.
4. Run lint, typecheck, relevant tests, and production build.

### Task 4: Deliver

1. Commit only task files, push the source branch, and remotely verify its SHA.
2. Deploy screenshot service, gateway, then frontend if changed, preserving production secrets.
3. Check production domain responses for recent apps until WebP screenshots are stored and visible.
4. Report exact deployment and verification results.
