import { readFileSync } from 'node:fs';
import { sdkAuthRequestService } from '../workers/api/src/services/sdk-auth-request.service';
import { sdkAuthRepository } from '../workers/api/src/repositories/sdk-auth.repository';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { sdkAuthService } from '../workers/api/src/services/sdk-auth.service';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'auth-test' },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('DB');
  await db
    .prepare(
      'CREATE TABLE projects(id TEXT PRIMARY KEY,slug TEXT,name TEXT,owner_id TEXT,url TEXT,status TEXT,is_deleted INTEGER)'
    )
    .run();
  await db
    .prepare(
      "INSERT INTO projects VALUES('app','xiaoban-voice','小伴','owner','https://xiaoban-voice.gemigo.app/','Live',0)"
    )
    .run();
  await authRepository.createUser(db, { id: 'owner', displayName: '开发者' });
  const session = await authRepository.createSession(db, 'owner');
  const request = new Request('https://gemigo.io/api/v1/sdk/authorize', {
    method: 'POST',
    headers: { origin: 'https://gemigo.io', cookie: `session_id=${session.id}` },
  });
  const input = {
    appId: 'xiaoban-voice',
    scopes: ['identity:basic'],
    codeChallenge: 'A'.repeat(43),
    openerOrigin: 'https://attacker.example',
  };
  await assert.rejects(sdkAuthService.authorize(request, {} as ApiWorkerEnv, db, input), /来源/);
  // Exercise the actual migration against legacy table layout and legacy credentials.
  const sql = readFileSync(
    'workers/api/migrations/0008_application_authorization.sql',
    'utf8'
  ).replace(/^--.*$/gm, '');
  for (const statement of sql.split(';').filter((s) => s.trim())) await db.prepare(statement).run();
  await db
    .prepare(
      "INSERT INTO sdk_access_tokens VALUES('old','xiaoban-voice','old-user','[\"identity:basic\"]','2026-01-01','2099-01-01',NULL)"
    )
    .run();
  await db
    .prepare(
      "INSERT INTO sdk_auth_codes VALUES('old-code','xiaoban-voice','owner','[]',?,'2026-01-01','2099-01-01',NULL,NULL)"
    )
    .bind('A'.repeat(43))
    .run();
  assert.equal(await sdkAuthRepository.findAccessToken(db, 'old'), null);
  assert.equal(await sdkAuthRepository.consumeAuthCode(db, 'old-code'), null);
  const verifier = 'v'.repeat(64);
  const challenge = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  ).toString('base64url');
  const appRequest = (origin = 'https://xiaoban-voice.gemigo.app') =>
    new Request('https://gemigo.io/api/v1/sdk/auth-requests', {
      method: 'POST',
      headers: { origin },
    });
  const body = {
    appId: 'xiaoban-voice',
    scopes: ['identity:basic'],
    codeChallenge: challenge,
    state: 's'.repeat(43),
    mode: 'redirect',
    redirectUri: 'https://xiaoban-voice.gemigo.app/',
  };
  const env = {} as ApiWorkerEnv;
  const good = {
    ...input,
    openerOrigin: 'https://xiaoban-voice.gemigo.app',
    codeChallenge: challenge,
  };
  await assert.rejects(
    sdkAuthService.authorize(
      new Request(request, {
        headers: { origin: 'https://attacker.example', cookie: `session_id=${session.id}` },
      }),
      env,
      db,
      good
    ),
    /platform origin/
  );
  await assert.rejects(
    sdkAuthService.authorize(request, env, db, { ...good, appId: 'unknown' }),
    /来源/
  );
  await assert.rejects(
    sdkAuthService.authorize(request, env, db, { ...good, scopes: ['admin:all'] }),
    /Unsupported/
  );
  await assert.rejects(
    sdkAuthService.authorize(request, env, db, { ...good, codeChallenge: 'short' }),
    /S256/
  );
  await assert.rejects(
    sdkAuthRequestService.create(appRequest('https://attacker.example'), env, db, body),
    /来源/
  );
  await assert.rejects(
    sdkAuthRequestService.create(appRequest(), env, db, {
      ...body,
      redirectUri: 'https://attacker.example/',
    }),
    /registered/
  );
  await assert.rejects(
    sdkAuthRequestService.create(appRequest(), env, db, {
      ...body,
      redirectUri: 'https://xiaoban-voice.gemigo.app/elsewhere',
    }),
    /registered/
  );
  await assert.rejects(
    sdkAuthRequestService.create(appRequest(), env, db, { ...body, state: 'short' }),
    /state/
  );
  const created = await sdkAuthRequestService.create(appRequest(), env, db, body);
  const url = new URL(created.authorizationUrl);
  assert.equal(url.pathname, '/auth/authorize');
  assert.deepEqual([...url.searchParams.keys()], ['request']);
  const id = url.searchParams.get('request')!;
  const context = await sdkAuthRequestService.context(request, db, id);
  assert.equal(context.name, '小伴');
  assert.equal(context.provider, '开发者');
  assert.equal(context.previouslyGranted, false);
  assert.equal('ownerId' in context, false);
  assert.equal('email' in context, false);
  const result = await sdkAuthRequestService.authorize(request, env, db, id);
  await assert.rejects(sdkAuthRequestService.authorize(request, env, db, id), /已过期|已使用/);
  await assert.rejects(sdkAuthRequestService.context(request, db, id), /已过期|已使用/);
  const exchanged = await sdkAuthService.exchangeToken(appRequest(), env, db, {
    code: result.code,
    codeVerifier: verifier,
  });
  assert.equal(exchanged.appId, 'xiaoban-voice');
  assert.equal(
    (await sdkAuthRepository.findAccessToken(db, exchanged.accessToken))?.sourceOrigin,
    'https://xiaoban-voice.gemigo.app'
  );
  await assert.rejects(
    sdkAuthService.exchangeToken(appRequest(), env, db, {
      code: result.code,
      codeVerifier: verifier,
    }),
    /already used/
  );
  const invalid = await sdkAuthService.authorize(request, env, db, good);
  await assert.rejects(
    sdkAuthService.exchangeToken(appRequest(), env, db, {
      code: invalid.code,
      codeVerifier: 'x'.repeat(64),
    }),
    /codeVerifier/
  );
  await assert.rejects(
    sdkAuthService.exchangeToken(appRequest(), env, db, {
      code: invalid.code,
      codeVerifier: verifier,
    }),
    /already used/
  );
  const foreign = await sdkAuthService.authorize(request, env, db, good);
  await assert.rejects(
    sdkAuthService.exchangeToken(appRequest('https://attacker.example'), env, db, {
      code: foreign.code,
      codeVerifier: verifier,
    }),
    /app origin/
  );
  const fresh = await sdkAuthRequestService.create(appRequest(), env, db, body);
  const freshId = new URL(fresh.authorizationUrl).searchParams.get('request')!;
  assert.equal((await sdkAuthRequestService.context(request, db, freshId)).previouslyGranted, true);
  await db
    .prepare("UPDATE sdk_auth_requests SET expires_at='2000-01-01' WHERE id=?")
    .bind(freshId)
    .run();
  await assert.rejects(sdkAuthRequestService.context(request, db, freshId), /已过期/);
  await db.prepare("UPDATE projects SET status='Failed'").run();
  await assert.rejects(sdkAuthService.authorize(request, env, db, good), /来源/);
  await db.prepare("UPDATE projects SET status='Live',url='https://custom.example/'").run();
  const custom = await sdkAuthRequestService.create(appRequest('https://custom.example'), env, db, {
    ...body,
    redirectUri: 'https://custom.example/',
  });
  assert.equal(
    (
      await sdkAuthRequestService.context(
        request,
        db,
        new URL(custom.authorizationUrl).searchParams.get('request')!
      )
    ).origin,
    'https://custom.example'
  );
  await db.prepare("UPDATE projects SET url='https://changed.example/'").run();
  await assert.rejects(
    sdkAuthRequestService.context(
      request,
      db,
      new URL(custom.authorizationUrl).searchParams.get('request')!
    ),
    /来源/
  );
  await db.prepare("UPDATE projects SET url='https://xiaoban-voice.gemigo.app/'").run();
  const raceRequest = await sdkAuthRequestService.create(appRequest(), env, db, body);
  const raceId = new URL(raceRequest.authorizationUrl).searchParams.get('request')!;
  const races = await Promise.allSettled([
    sdkAuthRequestService.authorize(request, env, db, raceId),
    sdkAuthRequestService.authorize(request, env, db, raceId),
  ]);
  assert.equal(races.filter((result) => result.status === 'fulfilled').length, 1);
  // Simulate a full outstanding-request window, without issuing 1000 network requests.
  await db
    .prepare(
      `WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<1000)
 INSERT INTO sdk_auth_requests SELECT 'cap-'||n,'xiaoban-voice','https://xiaoban-voice.gemigo.app','https://xiaoban-voice.gemigo.app/','redirect','[]',?,'state','2026-01-01','2099-01-01',NULL FROM numbers`
    )
    .bind(challenge)
    .run();
  await assert.rejects(sdkAuthRequestService.create(appRequest(), env, db, body), /Too many/);
  console.log(
    'PASS: issuer origin/CSRF/live app/scopes/PKCE, legacy credential exclusion, real migration, short request/context/privacy/callback/cap/expiry/replay/custom domain'
  );
} finally {
  await mf.dispose();
}
