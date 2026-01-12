# 第三方应用接入 GemiGo App SDK（Auth + DB，Agent 友好）

这份文档面向“第三方应用开发者”，目标是让你（或你的 AI Agent）能**只靠前端代码**接入：

- `gemigo.auth.login()`：登录 + 授权（popup broker + PKCE）
- `gemigo.cloud.database()`：wx.cloud 风格数据库（含 cursor 分页）

约束：DB 行为与写法以 `docs/tech/WX_CLOUD_DB_PROTOCOL_V0.md` 为唯一真相来源；平台不会对 `visibility/refType/refId` 等业务字段施加特殊语义。

---

## 1) 集成前先理解三件事

### 1.1 `platformOrigin` 与 broker

`gemigo.auth.login()` 会打开一个 popup 到 `platformOrigin + /sdk/broker` 完成登录与授权。

- 默认：`platformOrigin = https://gemigo.io`

> 重要：`login()` 必须在用户点击事件里调用，否则浏览器可能拦截 popup。

> 重要：为安全起见，broker 会校验你的 app 打开它的来源（origin）。当前仅允许：
> - `http://localhost`（本地开发）
> - `https://*.gemigo.app`（部署到 GemiGo 后的应用域名）
>
> 如果你把应用部署在其它任意域名下，登录会失败（属于预期限制）。

### 1.2 `apiBaseUrl`

SDK 发请求的 API base：

- 默认：`https://gemigo.io/api/v1`

多数第三方应用在生产上可以不传 `platformOrigin/apiBaseUrl`，直接用默认即可。

### 1.3 `appId`（数据隔离与权限边界）

`appId` 是云端数据隔离与规则评估的最小单位。

- 当应用运行在 `https://<slug>.gemigo.app`：SDK 会从域名推导 `appId=<slug>`
- 当应用运行在 `localhost`：请在 `auth.login()` 显式传入一个**稳定唯一**的 `appId`（不要用默认推导的 `localhost`）

---

## 2) 最快路径：拷贝即用的单文件示例（Public Wall）

这个小应用覆盖：

- 登录（Auth）
- `posts`：创建 + public feed 查询 + cursor 翻页（DB）
- 负例：尝试写 `_openid` 必须失败（系统字段不可伪造）

### 2.1 引入 SDK（UMD）

静态站点最简单的方式：

```html
<script src="https://unpkg.com/@gemigo/app-sdk@0.2.8/dist/gemigo-app-sdk.umd.js"></script>
```

加载后使用 `window.gemigo`。

### 2.2 `index.html`（可直接运行）

把下面内容保存为 `index.html`，用任意静态服务器打开即可：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GemiGo Public Wall (Third-party Demo)</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
      input, textarea, select, button { font: inherit; }
      input, textarea, select { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; }
      textarea { min-height: 110px; }
      button { padding: 10px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-weight: 700; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
      .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
      .muted { color: #64748b; }
      pre { background: #0b1220; color: #e2e8f0; padding: 14px; border-radius: 12px; overflow: auto; }
      .post { border-top: 1px dashed #e2e8f0; padding: 12px 0; }
      .post:first-child { border-top: 0; padding-top: 0; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>Public Wall（Third-party Demo）</h1>
    <p class="muted">覆盖：Auth 登录 + wx.cloud 风格 DB + cursor 分页 + 系统字段负例。</p>

    <div class="card">
      <div class="row">
        <button id="loginBtn">登录（gemigo.auth.login）</button>
        <button id="logoutBtn" disabled>退出</button>
        <button id="reloadBtn" disabled>刷新 Feed</button>
        <button id="moreBtn" disabled>加载更多</button>
        <button id="negBtn" disabled>负例：写 _openid（应失败）</button>
      </div>
      <p class="muted">
        App ID: <code id="appId">demo-app</code> |
        App User: <code id="appUserId">-</code>
      </p>
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 style="margin-top:0;">发布一条帖子</h3>
      <div class="row">
        <div style="flex:1;min-width:240px;">
          <label class="muted">标题</label>
          <input id="title" placeholder="Hello..." />
        </div>
        <div style="width:220px;min-width:200px;">
          <label class="muted">可见性（业务字段）</label>
          <select id="visibility">
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
        </div>
      </div>
      <div style="margin-top:10px;">
        <label class="muted">正文</label>
        <textarea id="body" placeholder="Write something..."></textarea>
      </div>
      <div class="row" style="margin-top:10px;">
        <button id="createBtn" disabled>创建（collection.add）</button>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 style="margin-top:0;">Public Feed</h3>
      <div id="feed"></div>
      <p class="muted">nextCursor: <code id="cursor">-</code></p>
    </div>

    <h3>Log</h3>
    <pre id="log">(no output yet)</pre>

    <script src="https://unpkg.com/@gemigo/app-sdk@0.2.8/dist/gemigo-app-sdk.umd.js"></script>
    <script>
      const el = (id) => document.getElementById(id);
      const logEl = el('log');
      const feedEl = el('feed');
      const cursorEl = el('cursor');
      const appUserIdEl = el('appUserId');

      const state = {
        nextCursor: null,
      };

      const cfg = {
        appId: el('appId').textContent.trim(),
      };

      const log = (title, payload) => {
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
        const block = `# ${title}\n${text}\n\n`;
        logEl.textContent = logEl.textContent === '(no output yet)' ? block : logEl.textContent + block;
      };

      const escapeHtml = (s) => String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

      const setUiAuthed = (authed) => {
        el('loginBtn').disabled = authed;
        el('logoutBtn').disabled = !authed;
        el('reloadBtn').disabled = !authed;
        el('moreBtn').disabled = !authed;
        el('negBtn').disabled = !authed;
        el('createBtn').disabled = !authed;
      };

      const requireDb = () => {
        if (!window.gemigo?.cloud?.database) throw new Error('gemigo.cloud.database() 不可用');
        return window.gemigo.cloud.database();
      };

      const renderFeed = (items, append) => {
        if (!append) feedEl.innerHTML = '';
        if (!items.length && !append) {
          feedEl.innerHTML = '<div class="muted">（暂无数据）</div>';
          return;
        }
        for (const it of items) {
          const div = document.createElement('div');
          div.className = 'post';
          div.innerHTML = `
            <div><strong>${escapeHtml(it.title || '(no title)')}</strong> <span class="muted">#${escapeHtml(it._id)}</span></div>
            <div class="muted">_openid: <code>${escapeHtml(it._openid)}</code> | visibility: <code>${escapeHtml(it.visibility)}</code></div>
            <div style="white-space:pre-wrap;margin-top:6px;">${escapeHtml(it.body || '')}</div>
          `;
          feedEl.appendChild(div);
        }
      };

      const loadFeed = async ({ append }) => {
        const db = requireDb();
        const _ = db.command;
        let q = db.collection('posts')
          .where({ visibility: _.eq('public') })
          .orderBy('createdAt', 'desc')
          .limit(10);

        if (append && state.nextCursor) q = q.startAfter(state.nextCursor);

        const res = await q.get();
        const items = res?.data || [];
        const nextCursor = res?._meta?.nextCursor ?? null;
        state.nextCursor = nextCursor;
        cursorEl.textContent = nextCursor || '-';

        renderFeed(items, append);
        el('moreBtn').disabled = !Boolean(nextCursor);
        log(`Feed loaded (append=${append})`, { count: items.length, nextCursor });
      };

      const createPost = async () => {
        const db = requireDb();
        const title = el('title').value.trim() || `Hello ${new Date().toLocaleTimeString()}`;
        const body = el('body').value || '...';
        const visibility = el('visibility').value;

        const res = await db.collection('posts').add({
          data: {
            title,
            body,
            visibility, // 业务字段，不是平台系统字段
            createdAt: db.serverDate(),
          },
        });

        log('Post created', res);
        state.nextCursor = null;
        await loadFeed({ append: false });
      };

      const negativeWriteOpenid = async () => {
        const db = requireDb();
        const res = await db.collection('posts').add({
          data: {
            title: 'should fail',
            body: 'try to write _openid',
            visibility: 'public',
            _openid: 'forged', // 应被拒绝
          },
        });
        log('Negative result (should NOT succeed)', res);
      };

      const login = async () => {
        // 必须在用户点击事件里调用，避免 popup 被拦截
        const token = await window.gemigo.auth.login({
          appId: cfg.appId,
          scopes: ['identity:basic', 'db:rw'],
        });
        appUserIdEl.textContent = token.appUserId || '-';
        setUiAuthed(true);
        log('Login ok', token);
        await loadFeed({ append: false });
      };

      const logout = () => {
        try { window.gemigo.auth.logout(); } catch {}
        state.nextCursor = null;
        appUserIdEl.textContent = '-';
        cursorEl.textContent = '-';
        feedEl.innerHTML = '';
        setUiAuthed(false);
        log('Logout', 'ok');
      };

      el('loginBtn').addEventListener('click', () => login().catch((e) => log('Login error', String(e?.message || e))));
      el('logoutBtn').addEventListener('click', logout);
      el('reloadBtn').addEventListener('click', () => loadFeed({ append: false }).catch((e) => log('Feed error', String(e?.message || e))));
      el('moreBtn').addEventListener('click', () => loadFeed({ append: true }).catch((e) => log('Feed error', String(e?.message || e))));
      el('createBtn').addEventListener('click', () => createPost().catch((e) => log('Create error', String(e?.message || e))));
      el('negBtn').addEventListener('click', () => negativeWriteOpenid().catch((e) => log('Negative expected error', String(e?.message || e))));

      setUiAuthed(false);
      log('Ready', { sdk: Boolean(window.gemigo), cloud: Boolean(window.gemigo?.cloud) });
    </script>
  </body>
</html>
```

---

## 3) DB 系统字段与推荐写法（对齐 wx.cloud）

系统字段（对外观测/写法）：

- `_id`：文档 id（可由平台生成；也允许在 `add({ data: { _id } })` 指定，冲突则失败）
- `_openid`：创建者标识（平台注入，不可伪造/不可修改）

推荐业务字段：

- `createdAt/updatedAt`：建议写入 `db.serverDate()`，避免客户端时钟漂移
- `visibility`：纯业务字段（平台不识别），规则/查询由你自己定义

> 重要：客户端不得写入除 `_id` 外的任何下划线字段；尤其不得写 `_openid`。

---

## 4) 权限模型：为什么你“看不到别人数据”

默认 legacy 权限模式是 `creator_read_write`（仅创建者可读写）。

这意味着：

- 你写的 `where({ visibility: _.eq('public') })` 在默认模式下，服务端仍会隐式加上 `_openid == auth.openid`，所以你只会看到你自己的文档。

如果你的第三方应用要做“公开广场/社区”，必须启用 Security Rules 并配置“public 可读 + 自己可写”等规则模板。

参考：

- 规则 DSL：`docs/tech/WX_CLOUD_DB_SECURITY_RULES_DSL_V0.md`
- 协议说明：`docs/tech/WX_CLOUD_DB_PROTOCOL_V0.md`

---

## 5) 常见问题（第三方集成）

### 5.1 登录弹窗打不开 / 被拦截

- 确保 `gemigo.auth.login()` 在用户点击回调里调用。

### 5.2 弹窗打开了，但 `.../sdk/broker` 404

- 生产：不要把 `platformOrigin` 指到不存在的地址，默认 `https://gemigo.io` 即可。

### 5.3 登录提示 `Invalid opener origin` / `Missing required query params`

- 确保你的应用运行在允许的来源：`http://localhost` 或 `https://*.gemigo.app`。
- 不要手动拼 broker URL；只用 `gemigo.auth.login()` 触发（它会自动带上 `origin/state/code_challenge` 等必需参数）。

### 5.4 为什么返回的数据里有 `_openid`

这是系统字段，由平台在写入时注入（不可伪造）；对齐 wx.cloud 的外部观测。

---

## 6) 给 AI Agent 的交付标准（建议你在任务里写清楚）

当你让 agent 开发第三方应用接入时，我建议你明确要求：

- 只能使用 `gemigo.cloud.database()`（wx 风格），系统字段必须 `_id/_openid`
- 不能把 `visibility/refType/refId` 等业务字段写成“平台内建字段”
- 分页必须用 cursor：`_meta.nextCursor` + `startAfter`
- 必须给出验证步骤（点击登录、创建、拉取、翻页、负例写 `_openid`）
