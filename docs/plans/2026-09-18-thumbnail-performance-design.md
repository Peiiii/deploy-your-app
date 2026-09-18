# Project thumbnail performance design

## Goal

Keep the Explore experience visually complete while making project covers fast on
high-latency networks. A production cold load must satisfy:

- first visible thumbnail bytes no greater than 450 KB in total;
- every optimized thumbnail no greater than 100 KB;
- visible thumbnails finish within 1.5 seconds in the production audit;
- below-the-fold thumbnails are lazy loaded;
- repeat loads use browser and edge caches;
- card thumbnail requests never return 404;
- page LCP remains at or below 2 seconds and CLS at or below 0.05.

## Options considered

1. **Only add `loading="lazy"` and cache headers.** Low risk, but keeps oversized
   1280×720 PNGs and creates a separate connection to every app subdomain.
2. **Central thumbnail delivery plus bounded WebP generation.** Reuses the current
   R2 and Browser Rendering stack, preserves custom covers, and removes both the
   payload and connection fan-out. This is the selected approach.
3. **Cloudflare Images transformations.** Operationally simple, but adds a new
   product dependency and billing/configuration uncertainty for a problem the
   existing stack can solve.

## Architecture

The public URL becomes
`https://assets.gemigo.app/thumbnails/<slug>.webp`. The existing wildcard R2
gateway serves this central hostname, reads `apps/<slug>/thumbnail.webp`, and
stores successful responses in the edge Cache API. It invokes Browser Rendering
through a zero-network-overhead Worker service binding. Browser and edge cache
policy is one day with stale-while-revalidate resilience.

If only a legacy custom `thumbnail.png` exists, the screenshot Worker renders that
image into the standard 16:9 frame. Otherwise it captures the deployed app. It
encodes WebP at decreasing quality until the result is at most 100 KB. Generation
runs after the response; the first miss receives a lightweight branded SVG with a
200 response instead of a broken image or a blocking 20-second screenshot job.
Already-optimized WebP uploads are promoted directly in R2 without consuming a
Browser Rendering session, so manual covers remain reliable during screenshot
service rate limiting.

The frontend eagerly loads only the first three cards, marks them high priority,
and lazy-loads the rest. Every image has intrinsic dimensions and async decoding.
New manual cover uploads are resized and WebP-compressed in the browser before
upload, with a bounded-quality loop and safe fallback when Canvas/WebP is not
available.

## Failure handling and verification

Screenshot failures keep the short-lived placeholder and remain retryable. The
legacy `__thumbnail.png` endpoint remains available during migration. Tests cover
URL routing, image attributes, byte limits, cache headers, placeholder behavior,
and Worker dry-runs. Production verification uses Chrome performance traces and
network request inspection after pre-warming the current Explore cards.
