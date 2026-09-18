---
name: gemigo-customer-analytics
description: Use when analyzing GemiGo customers, registrations, upload or deployment sources, conversion funnels, app traffic, Web Analytics, recent 7-day or 30-day business performance, or when the user explicitly invokes $gemigo-customer-analytics.
---

# GemiGo Customer Analytics

Treat Cloudflare Web Analytics RUM with `bot=0` as the only canonical human-traffic source. Use D1 for customers, projects, deployment history, product events, and diagnostics—not for headline traffic.

## Run

From the GemiGo repository root:

```bash
bash skills/gemigo-customer-analytics/scripts/analyze.sh 30
```

Accept `7` or `30`; default to 30 when the user does not choose. The script is read-only and emits aggregate JSON. It requires an authenticated Wrangler session and never prints credentials or personal identifiers.

## Analyze

1. Compare the selected full-day period with the immediately preceding equal period.
2. Use `webAnalytics.*.human` for page loads and visits. State that Web Analytics uses adaptive sampling.
3. Use D1 deployment attempts for source mix, success rate, duration, channel, and failure codes. Fall back to product events only when deployment history predates the table.
4. Separate registrations, project activation, successful deployment, and app visits; never call them the same conversion.
5. Highlight concentration by app host, device, country, referrer, and UTM/channel when present.
6. Suppress strong conclusions for samples below 30 and label incomplete instrumentation windows.

Read [metric-contract.md](references/metric-contract.md) before interpreting fields.

## Deliver

Lead with 3–5 decisions, then show evidence:

- period-over-period human traffic;
- new customers and activation;
- upload/deployment source mix and reliability;
- acquisition/device/app concentration;
- data quality caveats;
- prioritized next actions with expected metric impact.

Do not expose email, user ID, IP, visitor/session hash, raw referrer URL, or individual event rows.
