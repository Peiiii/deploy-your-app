import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as frontendProjectUtils from '../frontend/src/utils/project';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { metadataService } from '../workers/api/src/services/metadata.service';
import { normalizeProjectLocalization } from '../workers/api/src/utils/project-localization';
import { projectService } from '../workers/api/src/services/project.service';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';
const utils =
  (frontendProjectUtils as typeof frontendProjectUtils & { default?: typeof frontendProjectUtils })
    .default || frontendProjectUtils;
assert.equal(utils.getProjectDescription({}, 'zh-cn'), '');
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'translation-test' },
  compatibilityDate: '2026-09-18',
});
const originalFetch = globalThis.fetch;
try {
  const db = await mf.getD1Database('DB');
  await projectRepository.getProjectById(db, 'none');
  await db
    .prepare(
      "INSERT INTO projects(id,name,repo_url,last_deployed,status,url,description,is_public) VALUES('app','Original Brand','repo','2026-10-03','Live','https://app.gemigo.app/','A search application.',1)"
    )
    .run();
  let project = await projectRepository.getProjectById(db, 'app');
  const env = { DASHSCOPE_API_KEY: 'test' } as ApiWorkerEnv;
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ zh: '一个搜索应用。', en: 'A search application.' }),
          },
        },
      ],
    });
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    1,
    'legacy description queued'
  );
  assert.equal(await metadataService.translateDescription(env, db, project), true);
  project = await projectRepository.getProjectById(db, 'app');
  assert.equal(project.description, 'A search application.', 'original stays authoritative');
  assert.equal(utils.getProjectDescription(project, 'zh-cn'), '一个搜索应用。');
  assert.equal(utils.getProjectDescription(project, 'en-US'), 'A search application.');
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    0,
    'complete source does not rescan'
  );
  assert.ok(normalizeProjectLocalization(project.localization)?.generatedDescriptions);
  const stale = project;
  await projectService.updateProject(db, 'app', { description: 'An edited search application.' });
  project = await projectRepository.getProjectById(db, 'app');
  assert.equal(
    utils.getProjectDescription(project, 'zh'),
    'An edited search application.',
    'stale cache discarded immediately'
  );
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    1,
    'source edit reschedules'
  );
  await metadataService.translateDescription(env, db, stale);
  assert.equal(
    utils.getProjectDescription(await projectRepository.getProjectById(db, 'app'), 'zh'),
    'An edited search application.',
    'in-flight old source cannot write'
  );
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  assert.equal(await metadataService.translateDescription(env, db, project), false);
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    0,
    'failure backs off'
  );
  await db
    .prepare(
      "UPDATE projects SET localized_metadata=json_set(localized_metadata,'$.generatedDescriptions.retryAfter','2000-01-01') WHERE id='app'"
    )
    .run();
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    1,
    'expired failure retries'
  );
  await projectRepository.updateProjectRecord(db, 'app', {
    localization: {
      defaultLocale: 'en',
      locales: {
        en: { name: 'Original Brand', description: project.description },
        'zh-Hans': { name: 'Original Brand', description: '作者确认的中文介绍。' },
      },
    },
  });
  project = await projectRepository.getProjectById(db, 'app');
  assert.equal(
    (await projectRepository.descriptionTranslationCandidates(db)).length,
    0,
    'complete author locales need no translation'
  );
  await projectRepository.saveDescriptionTranslations(db, project, {
    source: project.description,
    locales: { zh: '机器翻译。', en: 'Machine translation.' },
  });
  project = await projectRepository.getProjectById(db, 'app');
  assert.equal(
    utils.getProjectDescription(project, 'zh-cn'),
    '作者确认的中文介绍。',
    'author primary locale wins over generated'
  );
  assert.equal(project.name, 'Original Brand');
  await db.prepare("UPDATE projects SET is_public=0 WHERE id='app'").run();
  globalThis.fetch = async () => {
    throw new Error('private must not reach AI');
  };
  assert.equal(
    await metadataService.translateDescription(
      env,
      db,
      await projectRepository.getProjectById(db, 'app')
    ),
    false
  );
  await projectRepository.saveDescriptionTranslations(db, project, {
    source: project.description,
    locales: { zh: '不应覆盖。' },
  });
  assert.equal(
    utils.getProjectDescription(await projectRepository.getProjectById(db, 'app'), 'zh'),
    '作者确认的中文介绍。'
  );
  await db.prepare("UPDATE projects SET is_public=1,is_deleted=1 WHERE id='app'").run();
  assert.equal((await projectRepository.descriptionTranslationCandidates(db)).length, 0);
  console.log(
    'PASS real D1/source lifecycle: locales, immediate language selection, original/author preservation, edited/stale/private/deleted guards, failure backoff'
  );
} finally {
  globalThis.fetch = originalFetch;
  await mf.dispose();
}
