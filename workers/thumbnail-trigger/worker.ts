interface Env {
  GITHUB_DISPATCH_TOKEN: string;
}

const WORKFLOW_URL =
  'https://api.github.com/repos/Peiiii/deploy-your-app/actions/workflows/capture-thumbnails.yml';

export async function triggerCapture(env: Env): Promise<'busy' | 'dispatched'> {
  if (!env.GITHUB_DISPATCH_TOKEN) throw new Error('Missing GitHub dispatch credential');

  const headers = {
    Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'GemiGo-Thumbnail-Trigger',
  };
  const runsResponse = await fetch(`${WORKFLOW_URL}/runs?per_page=5`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!runsResponse.ok) throw new Error(`GitHub workflow check failed: HTTP ${runsResponse.status}`);
  const data = await runsResponse.json() as {
    workflow_runs?: Array<{ status: string }>;
  };
  if (!Array.isArray(data.workflow_runs)) throw new Error('Invalid GitHub workflow response');
  if (data.workflow_runs.some(run => run.status !== 'completed')) return 'busy';

  const response = await fetch(`${WORKFLOW_URL}/dispatches`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'master' }),
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 204) throw new Error(`GitHub workflow dispatch failed: HTTP ${response.status}`);
  return 'dispatched';
}

export default {
  async scheduled(event: { scheduledTime: number }, env: Env): Promise<void> {
    const result = await triggerCapture(env);
    console.log(JSON.stringify({ event: 'thumbnail-trigger', scheduledTime: event.scheduledTime, result }));
  },
};
