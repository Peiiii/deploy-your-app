import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import languagePreference from '../frontend/src/features/explore/stores/language-preference.ts';
const { browserAppLanguages, readLanguagePreference } = languagePreference;
import { projectRepository } from '../workers/api/src/repositories/project.repository.ts';
import { authRepository } from '../workers/api/src/repositories/auth.repository.ts';
import { projectLanguageService } from '../workers/api/src/services/project-language.service.ts';
import {
  detectStaticAppLanguages,
  readStaticHtml,
} from '../workers/api/src/utils/static-app-language.ts';
import retiredBrowser from '../workers/screenshot-service/worker.ts';
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
  modules: [{ type: 'ESModule', path: 'workers/api/tmp/language-worker-test/index.js' }],
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
  const env = { PROJECTS_DB: db, APPS_ROOT_DOMAIN: 'gemigo.app' } as ApiWorkerEnv;
  const thaiHtml =
    '<html lang="en"><head><title>เครื่องมือสำหรับการเรียนรู้</title><meta name="description" content="เลือกบทเรียนและเรียนรู้ด้วยเครื่องมือออนไลน์"></head><body><button>เริ่มเรียน เลือกบทเรียน</button></body></html>';
  const goodFetch: typeof fetch = async (input, options) => {
    assert.equal(
      String(input),
      project.url,
      'only static app HTML is requested, never a model or rendering endpoint'
    );
    assert.equal(options?.redirect, 'error');
    assert.equal(new Headers(options?.headers).has('Authorization'), false);
    assert.equal(new Headers(options?.headers).has('Cookie'), false);
    return new Response(thaiHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const unavailableFetch: typeof fetch = async () => new Response('Unavailable', { status: 503 });
  globalThis.fetch = unavailableFetch;
  assert.equal(
    (await projectLanguageService.scanProject(env, db, project)).status,
    'content_unavailable'
  );
  assert.equal(
    (await projectRepository.getProjectById(db, project.id)).appLanguage,
    undefined,
    'fetch failure never stamps unknown'
  );
  assert.equal(
    (await projectRepository.languageScanCandidates(db)).length,
    0,
    'failed fetch backs off so it cannot starve the queue'
  );
  await db
    .prepare(
      "UPDATE projects SET app_language=json_set(app_language, '$.retryAfter', '2000-01-01T00:00:00Z') WHERE id=?"
    )
    .bind(project.id)
    .run();
  assert.equal(
    (await projectRepository.languageScanCandidates(db)).length,
    1,
    'failed fetch becomes retryable after backoff'
  );
  globalThis.fetch = async () => Response.json({ text: 'not HTML' });
  assert.equal(
    (await projectLanguageService.scanProject(env, db, project)).contentStage,
    'content-type'
  );
  globalThis.fetch = goodFetch;
  await projectLanguageService.scanProject(env, db, project);
  assert.deepEqual((await projectRepository.getProjectById(db, project.id)).appLanguage.languages, [
    'th',
  ]);
  assert.equal(
    (await projectRepository.languageScanCandidates(db)).length,
    0,
    'only once per successful release'
  );
  globalThis.fetch = unavailableFetch;
  await projectLanguageService.scanProject(env, db, project);
  assert.deepEqual(
    (await projectRepository.getProjectById(db, project.id)).appLanguage.languages,
    ['th'],
    'failed rescan preserves the last valid language'
  );
  globalThis.fetch = goodFetch;
  await projectRepository.updateProjectRecord(db, project.id, {
    appLanguage: { languages: ['zh'], source: 'author' },
  });
  await projectLanguageService.scanProject(env, db, project);
  assert.deepEqual(
    (await projectRepository.getProjectById(db, project.id)).appLanguage.languages,
    ['zh'],
    'manual declaration wins over in-flight scan'
  );
  globalThis.fetch = unavailableFetch;
  await projectLanguageService.scanProject(env, db, project);
  globalThis.fetch = goodFetch;
  assert.equal(
    (await projectRepository.getProjectById(db, project.id)).appLanguage.source,
    'author',
    'retry metadata cannot override an author declaration'
  );
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
    detectStaticAppLanguages(thaiHtml),
    ['th'],
    'static Thai interface overrides a template html lang'
  );
  assert.deepEqual(
    detectStaticAppLanguages(
      '<html lang="fr"><title>Calculateur de dépenses</title><meta name="description" content="Calculez vos dépenses et gérez votre budget facilement"></html>'
    ),
    ['fr']
  );
  assert.deepEqual(
    detectStaticAppLanguages(
      '<html><meta property="og:locale" content="pt_BR"><meta name="description" content="Uma ferramenta para organizar suas despesas e tarefas"></html>'
    ),
    ['pt']
  );
  assert.deepEqual(
    detectStaticAppLanguages(
      '<html><meta name="description" content="这是一个帮助用户管理日常工作任务和安排生活计划的在线工具"></html>'
    ),
    ['zh']
  );
  assert.deepEqual(
    detectStaticAppLanguages(
      '<html lang="en"><title>App</title><body><div id="root"></div><script>const text="这是用于脚本的很多很多中文，不是网页界面文字";</script></body></html>'
    ),
    [],
    'script contents and empty shells are not UI evidence'
  );
  assert.deepEqual(
    detectStaticAppLanguages(
      '<html><body>A long ambiguous application without any reliable language declaration</body></html>'
    ),
    [],
    'Latin text alone does not imply English'
  );
  let cancelled = false;
  const bounded = new Response(
    new ReadableStream({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(64 * 1024)));
      },
      cancel() {
        cancelled = true;
      },
    })
  );
  assert.equal((await readStaticHtml(bounded)).length, 128 * 1024);
  assert.equal(cancelled, true, 'oversized source reads stop without downloading the remainder');
  const retired = retiredBrowser.fetch();
  assert.equal(retired.status, 410);
  assert.equal((await retired.json()).code, 'BROWSER_SERVICE_RETIRED');
  console.log(
    'PASS app-language browser preferences, real API/D1 filters and auth, static detection without browser/model calls and release/manual guards'
  );
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}
