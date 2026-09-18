import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const baseUrl =
  process.env.API_BASE_URL ?? 'http://127.0.0.1:8790/api/v1';
const email = `metadata-qa+${Date.now()}@example.com`;
const password = 'Passw0rd!';

let cookie = '';
let projectId = '';
let projectSlug = '';

const request = async (
  pathname: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  return fetch(`${baseUrl}${pathname}`, { ...init, headers });
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  assert.ok(response.ok, `${response.status} ${response.statusText}: ${text}`);
  return JSON.parse(text) as T;
};

const waitForDeployment = async (deploymentId: string): Promise<void> => {
  const response = await request(
    `/deployments/${encodeURIComponent(deploymentId)}/stream`,
  );
  assert.ok(response.ok && response.body, 'deployment stream must be available');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const timeoutAt = Date.now() + 90_000;

  try {
    while (Date.now() < timeoutAt) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = chunk
          .split('\n')
          .find((line) => line.startsWith('data:'));
        if (dataLine) {
          const payload = JSON.parse(dataLine.slice(5).trim()) as {
            type?: string;
            status?: string;
            errorMessage?: string;
          };
          if (payload.type === 'status') {
            if (payload.status === 'SUCCESS') return;
            if (payload.status === 'FAILED') {
              throw new Error(payload.errorMessage ?? 'deployment failed');
            }
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  throw new Error('deployment stream ended before success');
};

try {
  const signupResponse = await request('/auth/email/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const signup = await readJson<{ user: { id: string } }>(signupResponse);
  assert.ok(signup.user.id);
  cookie = signupResponse.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.ok(cookie.startsWith('session_id='));

  const draft = await readJson<{
    id: string;
    slug?: string;
    description?: string;
  }>(
    await request('/projects/draft', {
      method: 'POST',
      body: JSON.stringify({ name: 'Greenhouse Rotation Planner QA' }),
    }),
  );
  projectId = draft.id;
  projectSlug = draft.slug ?? '';
  assert.ok(projectSlug, 'the reproduction requires a draft with an existing slug');
  assert.equal(draft.description, undefined);

  const deployResponse = await request('/deploy', {
    method: 'POST',
    body: JSON.stringify({
      id: projectId,
      sourceType: 'html',
      htmlContent:
        '<!doctype html><html><head><title>Greenhouse Crop Rotation Planner</title></head><body><main>Plan seasonal vegetable beds, rotations, and harvest schedules.</main></body></html>',
    }),
  });
  const deployment = await readJson<{ deploymentId: string }>(deployResponse);
  assert.ok(deployment.deploymentId);
  await waitForDeployment(deployment.deploymentId);

  const projects = await readJson<{
    items: Array<{
      id: string;
      description?: string;
      category?: string;
      tags?: string[];
    }>;
  }>(await request('/projects?scope=mine&page=1&pageSize=100'));
  const enriched = projects.items.find((project) => project.id === projectId);
  assert.ok(enriched, 'deployed project must still exist');
  assert.ok(enriched.description?.trim(), 'deployment must persist a description');
  assert.notEqual(
    enriched.description,
    'Deployed AI app deployed with GemiGo.',
  );

  console.log(
    JSON.stringify({
      status: 'ok',
      description: enriched.description,
      category: enriched.category,
      tags: enriched.tags,
    }),
  );
} finally {
  if (projectId && cookie) {
    await request(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  }

  if (/^[a-z0-9-]+$/.test(projectSlug)) {
    const appsRoot = path.resolve('data/apps');
    const appPath = path.resolve(appsRoot, projectSlug);
    if (appPath.startsWith(`${appsRoot}${path.sep}`)) {
      await rm(appPath, { recursive: true, force: true });
    }
  }
}
