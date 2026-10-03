/** Module-scoped operations. Requires RECOMMENDATION_SECRET in the environment.
 * Never prints it. Production settings are D1-owned, no Worker redeploy to stop.
 */
import { spawnSync } from 'node:child_process';

const action = process.argv[2] || 'report';
const allowed = new Set(['report', 'status', 'enable', 'disable', 'index', 'cleanup', 'ranker']);
if (!allowed.has(action))
  throw new Error('Use report/status/enable/disable/index/cleanup/ranker content|bge');
const secret = process.env.RECOMMENDATION_SECRET;
if (!secret) throw new Error('RECOMMENDATION_SECRET must be configured');
if (action === 'ranker' && !['content', 'bge'].includes(process.argv[3]))
  throw new Error('Ranker must be content or bge');
const body =
  action === 'ranker'
    ? { action: 'configure', ranker: process.argv[3] }
    : action === 'enable'
      ? { action: 'configure', enabled: true, percent: Number(process.argv[3] ?? 20) }
      : action === 'disable'
        ? { action: 'configure', enabled: false }
        : { action };
const base = process.env.RECOMMENDATION_API_BASE || 'https://gemigo.io/api/v1';
// curl honors the existing HTTPS_PROXY configuration and keeps the token out of argv.
const config = [
  `url = ${JSON.stringify(base + '/admin/explore-recommendation')}`,
  `header = ${JSON.stringify('Content-Type: application/json')}`,
  `header = ${JSON.stringify('Authorization: Bearer ' + secret)}`,
  `data = ${JSON.stringify(JSON.stringify(body))}`,
].join('\n');
const result = spawnSync(
  'curl',
  [
    '--silent',
    '--show-error',
    '--max-time',
    '45',
    '--request',
    'POST',
    '--write-out',
    '\n%{http_code}',
    '--config',
    '-',
  ],
  { input: config, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
);
if (result.error || result.status !== 0) throw new Error('Operation transport failed');
const separator = result.stdout.lastIndexOf('\n');
const status = Number(result.stdout.slice(separator + 1));
if (status < 200 || status >= 300) throw new Error('Operation failed: HTTP ' + status);
console.log(JSON.stringify(JSON.parse(result.stdout.slice(0, separator)), null, 2));
