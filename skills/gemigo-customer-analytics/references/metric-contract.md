# Metric contract

| Question | Canonical source | Rule |
|---|---|---|
| Human visits/page loads | Cloudflare Web Analytics RUM | `bot=0`; use full UTC days; values may be adaptively sampled |
| Registration | `users.created_at` | Count created users; group only by coarse auth provider |
| Activated customer | `projects.created_at` | User owns at least one non-deleted project |
| Successful deploy | `deployment_attempts` | `status='succeeded'`; group by immutable attempt source |
| Current project source | `projects.source_type` | Describes latest selected deployment source, not history |
| Product funnel | `product_events` | Match deployment steps with the same `flow_id` |
| App diagnostic views | `project_daily_stats` | Human-classified, deduped after instrumentation date; not the headline traffic source |

`last_success_at` is the authoritative project deployment timestamp. `last_deployed` remains a compatibility field. Daily product rollups retain aggregate events for 90 days; raw product events retain 30 days.

