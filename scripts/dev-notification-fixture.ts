import { processNotificationsScheduled } from '../workers/api/src/notifications/delivery';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { commentRepository } from '../workers/api/src/repositories/comment.repository';
import { engagementRepository } from '../workers/api/src/repositories/engagement.repository';
import { followRepository } from '../workers/api/src/repositories/follow.repository';
import { commentService } from '../workers/api/src/services/comment.service';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  entryPoints: ['workers/api/src/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  external: ['cloudflare:workers'],
});
const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const vapidJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', vapid.privateKey));
const vapidPublic = Buffer.from(await crypto.subtle.exportKey('raw', vapid.publicKey)).toString(
  'base64url'
);
const mf = new Miniflare({
  modules: [{ type: 'ESModule', path: 'worker.mjs', contents: bundle.outputFiles[0].text }],
  compatibilityDate: '2026-09-18',
  d1Databases: { PROJECTS_DB: 'notification-browser-fixture' },
  bindings: {
    AUTH_REDIRECT_BASE: 'http://localhost:5199',
    NOTIFICATION_VAPID_JWK: vapidJwk,
    NOTIFICATION_VAPID_PUBLIC_KEY: vapidPublic,
    NOTIFICATION_SEND_ENABLED: '1',
  },
});
const db = (await mf.getD1Database('PROJECTS_DB')) as D1Database;
const author = crypto.randomUUID(),
  reader = crypto.randomUUID();
await authRepository.createUser(db, {
  id: author,
  email: 'author@example.invalid',
  handle: 'fixture-author',
  displayName: '实验作者',
});
await authRepository.createUser(db, {
  id: reader,
  email: 'reader@example.invalid',
  handle: 'fixture-reader',
  displayName: '小林',
});
const sessions = {
  author: (await authRepository.createSession(db, author)).id,
  reader: (await authRepository.createSession(db, reader)).id,
};
const projectId = crypto.randomUUID();
await projectRepository.createProjectRecord(db, {
  id: projectId,
  name: '色彩实验室',
  ownerId: author,
  isPublic: true,
  status: 'Live',
  framework: 'Unknown',
  sourceType: 'html',
  repoUrl: '',
  lastDeployed: new Date().toISOString(),
  url: 'https://example.com',
  description: '探索色彩混合与搭配。',
});
await Promise.all([
  communityRepository.ensureSchema(db),
  commentRepository.ensureSchema(db),
  engagementRepository.ensureSchema(db),
  followRepository.ensureSchema(db),
]);
await commentService.createProjectComment(db, projectId, {
  userId: reader,
  isAdmin: false,
  content: '能不能保存自己配的颜色？我想拿来做课堂练习。',
  replyToCommentId: null,
  submissionId: crypto.randomUUID(),
});
await engagementRepository.likeProject(db, projectId, reader);
await engagementRepository.favoriteProject(db, projectId, reader);
await followRepository.follow(db, reader, author, new Date().toISOString());
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost:8799');
    if (url.pathname === '/fixture/state') {
      const subscriptions = await db
        .prepare('SELECT COUNT(*) AS count FROM notification_push_subscriptions')
        .first();
      const deliveries = await db
        .prepare('SELECT state,attempts,error_code,not_before FROM notification_deliveries')
        .all();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ subscriptions, deliveries: deliveries.results }));
      return;
    }
    if (url.pathname === '/fixture/age' && req.method === 'POST') {
      await db
        .prepare('UPDATE notifications SET created_at=?')
        .bind(Date.now() - 11 * 60000)
        .run();
      res.writeHead(200);
      res.end('aged isolated fixture events');
      return;
    }
    if (url.pathname === '/fixture/tick' && req.method === 'POST') {
      await processNotificationsScheduled({
        PROJECTS_DB: db,
        NOTIFICATION_VAPID_JWK: vapidJwk,
        NOTIFICATION_VAPID_PUBLIC_KEY: vapidPublic,
        NOTIFICATION_SEND_ENABLED: '1',
      } as never);
      res.writeHead(200);
      res.end('isolated scheduler completed');
      return;
    }
    if (url.pathname === '/fixture/large' && req.method === 'POST') {
      const now = new Date().toISOString();
      await db.batch(
        Array.from({ length: 120 }, (_, i) =>
          db
            .prepare(
              'INSERT OR IGNORE INTO project_likes(project_id,user_id,created_at,activation_id) VALUES(?,?,?,?)'
            )
            .bind(projectId, 'fixture-large-' + i, now, 'fixture-large-' + i)
        )
      );
      await db.batch(
        Array.from({ length: 120 }, (_, i) =>
          db
            .prepare(
              'INSERT OR IGNORE INTO project_favorites(project_id,user_id,created_at,activation_id) VALUES(?,?,?,?)'
            )
            .bind(projectId, 'fixture-large-' + i, now, 'fixture-large-' + i)
        )
      );
      await db.batch(
        Array.from({ length: 120 }, (_, i) =>
          db
            .prepare(
              'INSERT OR IGNORE INTO project_comments(id,project_id,user_id,content,created_at,updated_at) VALUES(?,?,?,?,?,?)'
            )
            .bind('fixture-large-' + i, projectId, reader, 'Large-count fixture ' + i, now, now)
        )
      );
      res.writeHead(200);
      res.end('isolated fixture large counts ready');
      return;
    }
    if (url.pathname.startsWith('/fixture/')) {
      const actor = url.pathname.split('/').at(-1) as keyof typeof sessions;
      if (!sessions[actor]) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(302, {
        'set-cookie': 'session_id=' + sessions[actor] + '; Path=/; HttpOnly; SameSite=Lax',
        location: 'http://localhost:5199/notifications',
      });
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const response = await mf.dispatchFetch('http://localhost:8799' + req.url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('Fixture server failure');
  }
});
server.listen(8799, '127.0.0.1', () =>
  console.log(
    'Fixture API ready :8799; browser login routes /fixture/author and /fixture/reader. All data is isolated.'
  )
);
process.on('SIGINT', () => {
  server.close();
  void mf.dispose().then(() => process.exit(0));
});
