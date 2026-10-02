import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import languagePreference from '../frontend/src/features/explore/stores/language-preference.ts';
const { browserAppLanguages, readLanguagePreference } = languagePreference;
import { projectRepository } from '../workers/api/src/repositories/project.repository.ts';
import { authRepository } from '../workers/api/src/repositories/auth.repository.ts';
import { projectLanguageService } from '../workers/api/src/services/project-language.service.ts';
import { aiService } from '../workers/api/src/services/ai.service.ts';
import {
  matchesAppLanguages,
  normalizeAppLanguages,
} from '../workers/api/src/utils/app-language.ts';
import type { ApiWorkerEnv } from '../workers/api/src/types/env.ts';

assert.deepEqual(browserAppLanguages(['th-TH', 'en-US']), ['th']);
assert.deepEqual(browserAppLanguages(['zh-TW', 'en']), ['zh']);
assert.deepEqual(browserAppLanguages(['en-GB']), ['en']);
assert.deepEqual(
  readLanguagePreference({ getItem: () => '{"languages":["th","en"]}' }, ['zh-CN']),
  { languages: ['th', 'en'], automatic: false }
);
assert.deepEqual(readLanguagePreference({ getItem: () => '{"languages":null}' }, ['zh-CN']), {
  languages: null,
  automatic: false,
});
assert.deepEqual(
  readLanguagePreference(
    {
      getItem: () => {
        throw new Error('blocked');
      },
    },
    ['th']
  ),
  { languages: ['th'], automatic: true }
);
assert.deepEqual(readLanguagePreference({ getItem: () => '{"languages":[]}' }, ['zh']), {
  languages: ['zh'],
  automatic: true,
});
assert.deepEqual(normalizeAppLanguages(['zh-CN', 'zh-TW', 'en-US', 1, 'und']), ['zh', 'en']);
assert.equal(matchesAppLanguages(undefined, ['en']), false);
assert.equal(matchesAppLanguages(undefined, ['und']), true);
assert.equal(matchesAppLanguages({ languages: ['zxx'], source: 'author' }, ['th']), true);

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({
  modules: true,
  scriptPath: 'workers/api/tmp/language-worker-test/index.js',
  d1Databases: { PROJECTS_DB: 'app-languages' },
  bindings: { APP_CONTENT_TOKEN: 'scoped-test' },
  compatibilityDate: '2026-09-18',
});
const originalFetch = globalThis.fetch;
try {
  const db = await mf.getD1Database('PROJECTS_DB');
  const owner = await authRepository.createUser(db, {
    id: crypto.randomUUID(),
    email: 'language-owner@example.test',
    displayName: 'QA',
  });
  const session = await authRepository.createSession(db, owner.id);
  const projects = [];
  for (const [index, languages] of [[], ['th'], ['en', 'th'], ['zh'], ['zxx']].entries()) {
    const project = await projectRepository.createProjectRecord(db, {
      id: `language-${index}`,
      ownerId: owner.id,
      name: `App ${index}`,
      repoUrl: 'test.html',
      slug: `language-${index}`,
      lastDeployed: `2026-10-0${index + 1}T00:00:00Z`,
      lastSuccessAt: `2026-10-0${index + 1}T00:00:00Z`,
      status: 'Live',
      isPublic: true,
      url: `https://language-${index}.gemigo.app/`,
      framework: 'Unknown',
      description: 'Test',
      category: 'Other',
      tags: [],
    });
    if (languages.length)
      await projectRepository.updateProjectRecord(db, project.id, {
        appLanguage: { languages, source: 'author' },
      });
    projects.push(await projectRepository.getProjectById(db, project.id));
  }
  const request = (path: string, options?: RequestInit) =>
    mf.dispatchFetch(`https://example.test/api/v1${path}`, options);
  let response = await request('/projects/explore?languages=th&pageSize=1&page=2');
  const thai = await response.json();
  assert.equal(thai.total, 3, 'filter before pagination, multilingual and language independent');
  assert.equal(thai.items.length, 1);
  assert.ok(thai.items[0].appLanguage.languages.includes('th'));
  const chinese = await (await request('/projects/explore?languages=zh')).json();
  assert.equal(chinese.total, 2);
  const unknown = await (await request('/projects/explore?languages=und')).json();
  assert.equal(unknown.total, 1);
  const all = await (await request('/projects/explore')).json();
  assert.equal(all.total, 5);
  assert.ok(all.availableLanguages.includes('th'));
  response = await request(`/projects/${projects[0].id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appLanguages: ['th'] }),
  });
  assert.equal(response.status, 401);
  response = await request(`/projects/${projects[0].id}`, {
    method: 'PATCH',
    headers: { Cookie: `session_id=${session.id}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appLanguages: ['zh-CN', 'en'] }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).appLanguage, {
    languages: ['zh', 'en'],
    source: 'author',
  });
  response = await request(`/projects/${projects[0].id}`, {
    method: 'PATCH',
    headers: { Cookie: `session_id=${session.id}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appLanguages: ['bad-code!'] }),
  });
  assert.equal(response.status, 400);
  response = await request(`/projects/${projects[0].id}`, {
    method: 'PATCH',
    headers: { Cookie: `session_id=${session.id}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appLanguages: [] }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).appLanguage, undefined);
  assert.equal(
    (await request(`/admin/projects/${projects[0].id}/detect-language`, { method: 'POST' })).status,
    401
  );

  const project = await projectRepository.getProjectById(db, projects[0].id);
  const env = {
    PROJECTS_DB: db,
    APP_CONTENT_TOKEN: 'fixture',
    DASHSCOPE_API_KEY: 'fixture',
    APP_CONTENT: {
      fetch: async (_url: string, options: RequestInit) => {
        assert.equal(new Headers(options.headers).get('x-gemigo-content-token'), 'fixture');
        return Response.json({
          text: 'เครื่องมือสำหรับการเรียนรู้ กรุณาเลือกบทเรียน',
          controls: 'เริ่มเรียน เลือกบทเรียน',
          htmlLang: 'en',
        });
      },
    },
  } as unknown as ApiWorkerEnv;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body as string);
    assert.ok(body.messages[0].content.includes('exercise'));
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ language: 'th', confidence: 0.96 }) } }],
    });
  };
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  assert.equal((await projectLanguageService.scanProject(env, db, project)).status, 'classifier_unavailable');
  assert.equal((await projectRepository.getProjectById(db, project.id)).appLanguage, undefined, 'classifier failure never stamps unknown');
  assert.equal((await projectRepository.languageScanCandidates(db)).length, 0, 'failed classification backs off so it cannot starve the queue');
  await db.prepare("UPDATE projects SET app_language=json_set(app_language, '$.retryAfter', '2000-01-01T00:00:00Z') WHERE id=?").bind(project.id).run();
  assert.equal((await projectRepository.languageScanCandidates(db)).length, 1, 'failed classification becomes retryable after backoff');
  const unavailableEnv = { ...env, APP_CONTENT: { fetch: async () => new Response('Unavailable', { status: 503 }) } } as unknown as ApiWorkerEnv;
  assert.equal((await projectLanguageService.scanProject(unavailableEnv, db, project)).status, 'content_unavailable');
  assert.equal((await projectRepository.getProjectById(db, project.id)).appLanguage, undefined, 'render failure never stamps unknown');
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"language":"th","confidence":0.96}' } }] });
  await projectLanguageService.scanProject(env, db, project);
  assert.deepEqual((await projectRepository.getProjectById(db, project.id)).appLanguage.languages, [
    'th',
  ]);
  assert.equal(
    (await projectRepository.languageScanCandidates(db)).length,
    0,
    'only once per successful release'
  );
  await projectLanguageService.scanProject(unavailableEnv, db, project);
  assert.deepEqual((await projectRepository.getProjectById(db, project.id)).appLanguage.languages, ['th'], 'failed rescan preserves the last valid language');
  await projectRepository.updateProjectRecord(db, project.id, {
    appLanguage: { languages: ['zh'], source: 'author' },
  });
  await projectLanguageService.scanProject(env, db, project);
  assert.deepEqual(
    (await projectRepository.getProjectById(db, project.id)).appLanguage.languages,
    ['zh'],
    'manual declaration wins over in-flight scan'
  );
  await projectLanguageService.scanProject(unavailableEnv, db, project);
  assert.equal((await projectRepository.getProjectById(db, project.id)).appLanguage.source, 'author', 'retry metadata cannot override an author declaration');
  await projectRepository.updateProjectRecord(db, project.id, { appLanguage: null });
  await projectRepository.updateProjectDeploymentRecord(db, project.id, {
    lastDeployed: '2026-10-02T12:00:00Z',
    status: 'Live',
  });
  await projectLanguageService.scanProject(env, db, project);
  assert.equal(
    (await projectRepository.getProjectById(db, project.id)).appLanguage,
    undefined,
    'old release cannot overwrite new release'
  );
  await projectRepository.updateProjectRecord(db, project.id, { isPublic: false });
  const fresh = await projectRepository.getProjectById(db, project.id);
  await projectLanguageService.scanProject(env, db, fresh);
  assert.equal(
    (await projectRepository.getProjectById(db, project.id)).appLanguage,
    undefined,
    'private app never written'
  );
  assert.deepEqual(
    await aiService.detectAppLanguage(env, { text: 'Short', controls: '', htmlLang: 'en' }),
    []
  );
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { content: '{"language":"en","confidence":0.6}' } }] });
  assert.deepEqual(
    await aiService.detectAppLanguage(env, {
      text: 'Ambiguous text with enough characters',
      controls: '',
      htmlLang: 'en',
    }),
    []
  );
  console.log(
    'PASS app-language browser preferences, real API/D1 filters and auth, detection and release/manual guards'
  );
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}
