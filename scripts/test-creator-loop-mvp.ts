import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({ entryPoints: ['workers/api/src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-18', d1Databases: { PROJECTS_DB: 'creator-loop-test' }, bindings: { PASSWORD_SALT: 'local-only', AUTH_REDIRECT_BASE: 'https://gemigo.io' } });
const request = (path: string, init: RequestInit = {}) => mf.dispatchFetch('https://gemigo.io' + path, init);
let serving = false;
try {
  const signup = async (email: string) => {
    const res = await request('/api/v1/auth/email/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'local-test-password' }) });
    assert.equal(res.status, 200);
    return { cookie: res.headers.get('set-cookie')!.split(';')[0], user: (await res.json() as { user: { id: string } }).user };
  };
  const owner = await signup('creator@example.test');
  const consumer = await signup('visitor@example.test');
  await request('/api/v1/projects'); // Initialize the real project repository schema.
  const db = await mf.getD1Database('PROJECTS_DB');
  const insert = async (id: string, isPublic: number | null = 1, status = 'Live', deleted = 0, url = 'https://example.com/learning') => {
    await db.prepare(`INSERT INTO projects (id,name,repo_url,source_type,slug,analysis_id,last_deployed,status,url,description,framework,category,tags,html_content,owner_id,is_public,is_deleted)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, '互动学习作品', 'private-source.zip', 'zip', id, 'internal-analysis', '2026-10-03T00:00:00Z', status, url, '一个探索知识的作品。体验后告诉作者你的建议。', 'Unknown', 'Education', '["learning"]', '<html>private source</html>', owner.user.id, isPublic, deleted).run();
  };
  await insert('public-work');
  await insert('private-work', 0);
  await insert('offline-work', 1, 'Offline');
  await insert('deleted-work', 1, 'Live', 1);
  await insert('danger-work', 1, 'Live', 0, 'javascript:alert(1)');
  await insert('empty-work', 1, 'Live', 0, '');
  await insert('credential-work', 1, 'Live', 0, 'https://user:password@example.com');
  await insert('legacy-work', null);
  const publicRes = await request('/api/v1/apps/public-work');
  assert.equal(publicRes.status, 200);
  const payload = await publicRes.json() as { app: Record<string, unknown> };
  assert.equal(payload.app.id, 'public-work');
  assert.equal(payload.app.description, '一个探索知识的作品。体验后告诉作者你的建议。');
  assert.ok(payload.app.publicAuthor);
  assert.deepEqual(Object.keys(payload.app).sort(), ['category', 'description', 'id', 'name', 'ownerId', 'publicAuthor', 'tags', 'url']);
  assert.doesNotMatch(JSON.stringify(payload), /private-source|internal-analysis|private source|example.test/);
  for (const id of ['private-work', 'offline-work', 'deleted-work', 'danger-work', 'empty-work', 'credential-work', 'missing-work']) {
    const res = await request('/api/v1/apps/' + id);
    assert.equal(res.status, 404, id);
    assert.doesNotMatch(await res.text(), /互动学习|example.test|private source/);
  }
  assert.equal((await request('/api/v1/apps/legacy-work')).status, 200, 'Legacy public semantics');
  const comments = '/api/v1/projects/public-work/comments';
  const post = (content: string, cookie?: string, replyToCommentId?: string) => request(comments, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ content, replyToCommentId }) });
  assert.equal((await post('匿名留言')).status, 401);
  assert.equal((await request('/api/v1/projects/public-work/favorite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"favorited":true}' })).status, 401);
  assert.equal((await request('/api/v1/projects/public-work/favorite', { method: 'POST', headers: { cookie: consumer.cookie } })).status, 200);
  const savedReaction = await request('/api/v1/projects/public-work/reactions', { headers: { cookie: consumer.cookie } });
  assert.equal((await savedReaction.json() as { favoritedByCurrentUser: boolean }).favoritedByCurrentUser, true);
  const created = await post('希望增加英语词汇关卡', consumer.cookie);
  assert.equal(created.status, 200);
  const { comment } = await created.json() as { comment: { id: string } };
  const ownerRead = await request(comments, { headers: { cookie: owner.cookie } });
  const listed = await ownerRead.json() as { items: Array<{ id: string; content: string; canDelete: boolean }>; total: number };
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].content, '希望增加英语词汇关卡');
  assert.equal(listed.items[0].canDelete, false, 'Owner cannot delete someone else’s comment');
  assert.equal((await post('感谢建议，下次更新会考虑。', owner.cookie, comment.id)).status, 200);
  const publicRead = await request(comments);
  const replies = await publicRead.json() as { items: Array<{ replyTo: { commentId: string } | null }>; total: number };
  assert.equal(replies.total, 2);
  assert.ok(replies.items.some(c => c.replyTo?.commentId === comment.id));
  assert.equal((await request('/api/v1/comments/' + comment.id, { method: 'DELETE', headers: { cookie: owner.cookie } })).status, 400);
  console.log('PASS: assembled Worker/D1 public visibility, safe payload, anonymous auth, persistent feedback and owner reply');
  if (process.argv.includes('--serve')) {
    // Disposable local QA users only; login through the UI using the password above.
    await db.prepare('UPDATE projects SET url=? WHERE id=?').bind('http://localhost:5194/api/qa-app', 'public-work').run();
    const server = createServer(async (req, res) => {
      try {
        if (req.url === '/api/qa-app') {
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end('<html lang="zh"><body style="font-family:sans-serif;background:#ecfdf5;padding:32px"><h1>知识探索 · QA</h1><p>点击开始你的第一轮探索</p><button onclick="this.textContent=String(Number(this.textContent)+1)">0</button></body></html>');
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const response = await request(req.url || '/', { method: req.method, headers: req.headers as HeadersInit, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch { res.writeHead(500); res.end('Local QA server error'); }
    });
    await new Promise<void>(resolve => server.listen(8794, '127.0.0.1', resolve));
    serving = true;
    console.log('Disposable QA API ready at http://127.0.0.1:8794');
    const stop = async () => { server.close(); await mf.dispose(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }
} finally {
  if (!serving) await mf.dispose();
}
