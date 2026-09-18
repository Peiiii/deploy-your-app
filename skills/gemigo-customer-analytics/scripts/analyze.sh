#!/usr/bin/env bash
set -euo pipefail

analysis_days="${1:-30}"
if [[ "$analysis_days" != "7" && "$analysis_days" != "30" ]]; then
  echo "Usage: $0 [7|30]" >&2
  exit 2
fi

git rev-parse --show-toplevel >/dev/null
wrangler_config="$HOME/Library/Preferences/.wrangler/config/default.toml"
oauth_token="${CLOUDFLARE_API_TOKEN:-}"
if [[ -z "$oauth_token" && -f "$wrangler_config" ]]; then
  oauth_token="$(sed -nE 's/^oauth_token = "([^"]+)"/\1/p' "$wrangler_config")"
fi
if [[ -z "$oauth_token" ]]; then
  echo "Cloudflare credentials unavailable; run pnpm exec wrangler login." >&2
  exit 1
fi

read -r current_start current_end previous_start previous_end < <(
  python3 - "$analysis_days" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
days = int(sys.argv[1])
end = datetime.now(timezone.utc).date() - timedelta(days=1)
start = end - timedelta(days=days - 1)
previous_end = start - timedelta(days=1)
previous_start = previous_end - timedelta(days=days - 1)
print(start, end, previous_start, previous_end)
PY
)

graphql_query='query($accountTag: string!, $start: Date!, $end: Date!) { viewer { accounts(filter: { accountTag: $accountTag }) { apps: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "949abcc33d7043af99338da86662a19b" }, limit: 500, orderBy: [date_ASC]) { count sum { visits } avg { sampleInterval } dimensions { date bot } } platform: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "e1b2c8f916f44dc584d9f69895caea30" }, limit: 500, orderBy: [date_ASC]) { count sum { visits } avg { sampleInterval } dimensions { date bot } } appsDevice: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "949abcc33d7043af99338da86662a19b", bot: 0 }, limit: 20, orderBy: [count_DESC]) { count sum { visits } dimensions { deviceType } } appsCountry: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "949abcc33d7043af99338da86662a19b", bot: 0 }, limit: 20, orderBy: [count_DESC]) { count sum { visits } dimensions { countryName } } appsReferrer: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "949abcc33d7043af99338da86662a19b", bot: 0 }, limit: 20, orderBy: [count_DESC]) { count sum { visits } dimensions { refererHost } } appsHost: rumPageloadEventsAdaptiveGroups(filter: { date_geq: $start, date_leq: $end, siteTag: "949abcc33d7043af99338da86662a19b", bot: 0 }, limit: 20, orderBy: [count_DESC]) { count sum { visits } dimensions { requestHost } } } } }'
graphql_payload="$(jq -n --arg query "$graphql_query" --arg account 'adb27b39051202962038992eeaf8f6bb' --arg start "$previous_start" --arg end "$current_end" '{query:$query,variables:{accountTag:$account,start:$start,end:$end}}')"
web_json="$(curl -sS --retry 3 --retry-all-errors --max-time 60 \
  'https://api.cloudflare.com/client/v4/graphql' \
  -H "Authorization: Bearer ${oauth_token}" \
  -H 'Content-Type: application/json' --data "$graphql_payload")"
if [[ "$(jq '.errors | length // 0' <<<"$web_json")" != "0" ]]; then
  jq '{errors}' <<<"$web_json" >&2
  exit 1
fi

d1_sql="SELECT 'users' metric, COUNT(*) value FROM users WHERE date(created_at) BETWEEN '$current_start' AND '$current_end';
SELECT 'projects' metric, COUNT(*) value FROM projects WHERE date(created_at) BETWEEN '$current_start' AND '$current_end' AND COALESCE(is_deleted,0)=0;
SELECT source_type, status, client_channel, COUNT(*) attempts, ROUND(AVG(duration_ms)) avg_duration_ms FROM deployment_attempts WHERE date(started_at) BETWEEN '$current_start' AND '$current_end' GROUP BY source_type,status,client_channel ORDER BY attempts DESC;
SELECT name, dimension, client_channel, COALESCE(utm_source,'') utm_source, COUNT(*) events, COUNT(DISTINCT session_id) sessions FROM product_events WHERE date(at/1000,'unixepoch') BETWEEN '$current_start' AND '$current_end' GROUP BY name,dimension,client_channel,utm_source ORDER BY events DESC LIMIT 100;
SELECT source_type, COUNT(*) projects FROM projects WHERE COALESCE(is_deleted,0)=0 GROUP BY source_type ORDER BY projects DESC;"
d1_payload="$(jq -n --arg sql "$d1_sql" '{sql:$sql}')"
d1_response="$(curl -sS --retry 5 --retry-all-errors --max-time 60 \
  'https://api.cloudflare.com/client/v4/accounts/adb27b39051202962038992eeaf8f6bb/d1/database/e1e28d75-d0a0-4f8e-9b5d-714454686a4f/query' \
  -H "Authorization: Bearer ${oauth_token}" \
  -H 'Content-Type: application/json' --data "$d1_payload")"
if [[ "$(jq -r '.success' <<<"$d1_response")" != "true" ]]; then
  jq '{errors}' <<<"$d1_response" >&2
  exit 1
fi
d1_json="$(jq '.result' <<<"$d1_response")"

jq -n \
  --argjson days "$analysis_days" \
  --arg currentStart "$current_start" --arg currentEnd "$current_end" \
  --arg previousStart "$previous_start" --arg previousEnd "$previous_end" \
  --argjson web "$web_json" --argjson d1 "$d1_json" '
  def total($rows;$from;$to;$bot):
    [$rows[] | select(.dimensions.date >= $from and .dimensions.date <= $to and .dimensions.bot == $bot)] |
    {pageLoads:(map(.count)|add//0),visits:(map(.sum.visits)|add//0)};
  $web.data.viewer.accounts[0] as $a |
  {period:{days:$days,current:[$currentStart,$currentEnd],previous:[$previousStart,$previousEnd]},
   webAnalytics:{
     apps:{human:total($a.apps;$currentStart;$currentEnd;0),previousHuman:total($a.apps;$previousStart;$previousEnd;0),bots:total($a.apps;$currentStart;$currentEnd;1),devices:$a.appsDevice,countries:$a.appsCountry,referrers:$a.appsReferrer,hosts:$a.appsHost},
     platform:{human:total($a.platform;$currentStart;$currentEnd;0),previousHuman:total($a.platform;$previousStart;$previousEnd;0),bots:total($a.platform;$currentStart;$currentEnd;1)}},
   d1:$d1}'
