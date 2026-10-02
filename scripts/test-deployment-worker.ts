import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { authRepository } from '../workers/api/src/repositories/auth.repository.ts';
import { projectRepository } from '../workers/api/src/repositories/project.repository.ts';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository.ts';
import { deploymentSourceService } from '../workers/api/src/services/deployment-source.service.ts';
import { SourceType } from '../workers/api/src/types/project.ts';
import type { ApiWorkerEnv } from '../workers/api/src/types/env.ts';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, Response: MfResponse } = wranglerRequire('miniflare');
const serverRequire = createRequire(path.resolve('server/package.json'));
const express = serverRequire('express');
const mf = new Miniflare({
  modules: true,
  scriptPath: 'workers/api/tmp/deployment-worker-test/index.js',
  d1Databases: { PROJECTS_DB: 'deployment-worker-test' },
  r2Buckets: ['ASSETS'],
  bindings: {
    DEPLOY_TARGET: 'r2',
    DEPLOY_SERVICE_TOKEN: 'test-secret',
    DEPLOY_SERVICE_BASE_URL: 'http://fixture/api/v1',
  },
  outboundService: async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'fixture') throw new Error('Unexpected external request');
    url.host = `127.0.0.1:${server.address().port}`;
    const response = await fetch(url, {
      method: request.method,
      headers: [...request.headers],
      body: request.body,
      duplex: 'half',
    } as RequestInit);
    return new MfResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: [...response.headers],
    });
  },
  compatibilityDate: '2026-09-18',
});
const app = express();
app.use(express.json({ limit: '10mb' }));
let builderMode = 'success';
const providerId = crypto.randomUUID();
app.post(
  '/api/v1/deploy',
  (
    req: { headers: Record<string, string>; body: Record<string, string> },
    res: { status(code: number): { json(data: unknown): void }; json(data: unknown): void }
  ) => {
    assert.equal(req.headers['x-gemigo-builder-token'], 'test-secret');
    assert.equal(req.headers.cookie, undefined, 'never forward customer credentials to builder');
    assert.equal(req.body.zipData, undefined);
    assert.ok(req.body.zipSourceKey);
    if (builderMode === 'reject') return res.status(413).json({ error: 'fixture rejection' });
    res.json({ deploymentId: providerId });
  }
);
app.get(
  '/api/v1/deployments/:id',
  (
    _req: unknown,
    res: { status(code: number): { json(data: unknown): void }; json(data: unknown): void }
  ) => {
    if (builderMode === 'missing') return res.status(404).json({ error: 'lost' });
    res.json(
      builderMode === 'failure'
        ? {
            type: 'status',
            status: 'FAILED',
            stage: 'build',
            buildMode: 'build',
            errorCode: 'command_failed',
            errorMessage: 'fixture compiler failed',
          }
        : {
            type: 'status',
            status: 'SUCCESS',
            stage: 'complete',
            buildMode: 'static',
            projectMetadata: { url: 'https://worker-qa.gemigo.app/' },
          }
    );
  }
);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
try {
  const db = await mf.getD1Database('PROJECTS_DB');
  const bucket = await mf.getR2Bucket('ASSETS');
  const user = await authRepository.createUser(db, {
    id: crypto.randomUUID(),
    email: 'deployment-qa@example.test',
    displayName: 'QA',
  });
  const session = await authRepository.createSession(db, user.id);
  const project = await projectRepository.createProjectRecord(db, {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name: 'Worker QA',
    slug: 'worker-qa',
    repoUrl: 'qa.zip',
    sourceType: SourceType.Zip,
    lastDeployed: '',
    status: 'Offline',
    framework: 'Unknown',
    description: 'Complete',
    category: 'Tools',
    tags: ['qa'],
  });
  const env = {
    PROJECTS_DB: db,
    ASSETS: bucket,
    DEPLOY_TARGET: 'r2',
    DEPLOY_SERVICE_TOKEN: 'test-secret',
    DEPLOY_SERVICE_BASE_URL: `http://127.0.0.1:${server.address().port}/api/v1`,
  } as ApiWorkerEnv;
  const call = (pathname: string, init: RequestInit = {}, auth = true) =>
    mf.dispatchFetch(`https://gemigo.test/api/v1${pathname}`, {
      ...init,
      headers: { ...(auth ? { Cookie: `session_id=${session.id}` } : {}), ...init.headers },
    });
  const data = new Uint8Array(128 * 1024);
  const uploadedResponse = await call(`/projects/${project.id}/deployment-source`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip', 'Content-Length': String(data.byteLength) },
    body: data,
  });
  assert.equal(uploadedResponse.status, 200);
  const uploaded = (await uploadedResponse.json()) as { zipSourceKey: string };
  assert.equal(
    await deploymentSourceService.validate(env, project.id, uploaded.zipSourceKey),
    data.length
  );
  await assert.rejects(
    deploymentSourceService.validate(env, crypto.randomUUID(), uploaded.zipSourceKey),
    /Invalid ZIP/
  );
  assert.equal(
    (
      await call(`/projects/${project.id}/deployment-source`, {
        method: 'PUT',
        body: new Uint8Array(75 * 1024 * 1024 + 1),
      })
    ).status,
    400
  );
  assert.equal(
    (
      await call(
        `/projects/${project.id}/deployment-source`,
        { method: 'PUT', headers: { 'Content-Length': '1' }, body: 'x' },
        false
      )
    ).status,
    401
  );

  const flow = crypto.randomUUID();
  const start = () =>
    call('/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: project.id,
        sourceType: 'zip',
        zipSourceKey: uploaded.zipSourceKey,
        deploymentFlowId: flow,
        clientChannel: 'web',
      }),
    });
  assert.equal((await start()).status, 200);
  assert.equal((await start()).status, 200, 'retry same flow reuses accepted job');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM deployment_attempts').first()).n, 1);
  assert.equal(
    (await call(`/deployments/${providerId}/reconcile`, { method: 'POST' }, false)).status,
    401
  );
  const patch = (status: string) =>
    call(`/projects/${project.id}/deployment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, deploymentFlowId: flow }),
    });
  assert.equal(
    (await patch('Live')).status,
    400,
    'client cannot manufacture Live before server confirmation'
  );
  const confirmed = await call(`/deployments/${providerId}/reconcile`, { method: 'POST' });
  assert.equal(confirmed.status, 200);
  const attempt = await deploymentRepository.findByProviderId(db, providerId);
  assert.equal(attempt?.status, 'succeeded');
  assert.equal(attempt?.build_mode, 'static');
  assert.equal(attempt?.stage, 'complete');
  assert.equal((await projectRepository.getProjectById(db, project.id))?.status, 'Live');
  assert.equal(
    (await patch('Failed')).status,
    400,
    'late client error cannot overwrite confirmed success'
  );
  builderMode = 'missing';
  const retained = await (
    await call(`/deployments/${providerId}/reconcile`, { method: 'POST' })
  ).json();
  assert.equal(
    retained.status,
    'SUCCESS',
    'confirmed D1 result survives expiry of builder receipt'
  );
  assert.equal((await patch('Building')).status, 200);
  assert.equal(
    (await projectRepository.getProjectById(db, project.id))?.status,
    'Live',
    'late Building cannot overwrite a confirmed result'
  );

  const failedAttempt = crypto.randomUUID();
  await deploymentRepository.createAttempt(db, {
    id: failedAttempt,
    projectId: project.id,
    ownerId: user.id,
    sourceType: SourceType.GitHub,
    clientChannel: 'web',
    startedAt: new Date(Date.now() + 1000).toISOString(),
  });
  await deploymentRepository.markAccepted(
    db,
    failedAttempt,
    providerId + '-failed',
    new Date().toISOString()
  );
  builderMode = 'failure';
  assert.equal(
    (await call(`/deployments/${providerId}-failed/reconcile`, { method: 'POST' })).status,
    200
  );
  const failure = await deploymentRepository.findByProviderId(db, providerId + '-failed');
  assert.equal(failure?.error_code, 'command_failed');
  assert.equal(failure?.error_message, 'fixture compiler failed');
  assert.equal(failure?.stage, 'build');
  assert.equal(
    await projectRepository.updateProjectDeploymentRecord(
      db,
      project.id,
      { status: 'Live' },
      attempt!.id
    ),
    null,
    'stale completion is blocked inside the SQL write'
  );
  assert.equal((await projectRepository.getProjectById(db, project.id))?.status, 'Failed');
  console.log(
    'PASS: real R2 streaming, size/ownership/auth boundaries, idempotent start, service token, canonical D1 result, late client protection, persistent diagnostic fields'
  );
} finally {
  await mf.dispose();
  server.close();
}
