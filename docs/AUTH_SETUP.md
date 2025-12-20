# 用户账号体系接入说明（Cloudflare 全托管版本）

> 本文档列出你需要手动完成的步骤。代码部分我已经帮你接好：
>
> - API Worker：`workers/api`
>   - 新增了用户 / 会话表（D1）仓库
>   - 新增了邮箱注册登录、Google 登录、GitHub 登录路由
>   - 新增了 `GET /api/v1/me` 和 `POST /api/v1/logout`
>
> 你只需要按下面步骤在 Cloudflare 和第三方后台做配置，然后按需在前端接一下按钮即可。

---

## 一、确认 / 配置 D1 数据库绑定

Worker：`gemigo-api`（在 `workers/api/wrangler.toml` 中定义）

1. 在 Cloudflare Dashboard 中打开你的 D1 数据库：
   - 名称应为：`gemigo-projects`（与 `wrangler.toml` 保持一致）
2. 在 `gemigo-api` Worker 的 Settings → D1 Bindings 中确认：
   - 存在一个 binding：
     - `Binding name`: `PROJECTS_DB`
     - `Database`: 选择上面这个 `gemigo-projects`
3. 如果 Binding 名不是 `PROJECTS_DB`，改成这个名字。

> 说明：用户表 (`users`) 和会话表 (`sessions`) 会在 Worker 第一次访问时自动通过 SQL 创建，不需要你手动执行迁移脚本。

---

## 二、配置 Worker 环境变量（Auth 相关）

Worker：`gemigo-api`（即 `workers/api`）

在 Cloudflare Dashboard → Workers & Pages → `gemigo-api` → Settings → Variables 里，配置以下变量：

### 2.1 通用

- `AUTH_REDIRECT_BASE`  
  - 值：`https://gemigo.io`  
  - 作用：构造 OAuth 回调地址和默认登录后跳转地址。

- `PASSWORD_SALT`  
  - 值：任意**足够随机且保密**的字符串，例如：
    - 可以在本地生成：`openssl rand -hex 32`
  - 作用：用于给邮箱密码做 SHA-256 加盐哈希。

### 2.2 Google OAuth

需要先在 Google Cloud Console 创建一个 OAuth Client：

1. 打开 Google Cloud Console → APIs & Services → Credentials。
2. 创建 OAuth 2.0 Client：
   - Application type: `Web application`
   - Authorized redirect URIs 中添加：
     - `https://gemigo.io/api/v1/auth/google/callback`
3. 记下：
   - `Client ID`
   - `Client secret`

然后在 `gemigo-api` Worker 的环境变量中设置：

- `GOOGLE_CLIENT_ID`：填上 Client ID  
- `GOOGLE_CLIENT_SECRET`：填上 Client secret

### 2.3 GitHub OAuth

需要在 GitHub 开发者后台创建一个 OAuth App：

1. 进入 GitHub → Settings → Developer settings → OAuth Apps。
2. New OAuth App：
   - Homepage URL: `https://gemigo.io`
   - Authorization callback URL: `https://gemigo.io/api/v1/auth/github/callback`
3. 创建完成后，记下：
   - `Client ID`
   - `Client Secret`（点击 `Generate new client secret`）

在 `gemigo-api` Worker 的环境变量中设置：

- `GITHUB_CLIENT_ID`：填上 Client ID  
- `GITHUB_CLIENT_SECRET`：填上 Client secret

---

## 三、重新部署 `gemigo-api` Worker

在本地项目根目录执行：

```bash
cd workers/api
# 如未安装依赖（只需一次）
pnpm install

# 部署到 Cloudflare
pnpm deploy
# 或者：
# npx wrangler deploy
```

部署完成后，可以用以下方式粗略验证：

1. 浏览器访问（无会话时）：

   ```text
   https://gemigo-api.<你的 workers 子域>/api/v1/me
   ```

   正常情况返回：

   ```json
   { "user": null }
   ```

2. 访问一些错误路径，比如：

   ```text
   https://gemigo-api.../api/v1/auth/google/start
   ```

   如果环境变量缺失，会返回 JSON 提示（例如 `GOOGLE_CLIENT_ID is not configured.`），说明路由已经生效。

---

## 四、前端 / Pages 一端需要做的事

`gemigo.io` 的 Pages 项目已经通过 `_worker.js` 将 `/api/v1/*` 代理到真实后端（Aliyun）或 Worker（取决于你的 `BACKEND_ORIGIN` 配置）。  

现在用户体系由 `gemigo-api` Worker 提供，常用接口如下：

- `GET /api/v1/me`
  - 返回当前登录用户信息：
    ```json
    {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "displayName": "xxx",
        "avatarUrl": "https://...",
        "providers": {
          "email": true,
          "google": true,
          "github": false
        }
      }
    }
    ```
  - 未登录时：`{ "user": null }`

- `POST /api/v1/auth/email/signup`
  - body：`{ "email": "xx@xx", "password": "xxxxxxx" }`
  - 成功：返回 `{ user: PublicUser }`，并通过 `Set-Cookie` 写入 `session_id` cookie。

- `POST /api/v1/auth/email/login`
  - body：同上。
  - 成功：返回 `{ user: PublicUser }`，写入 `session_id` cookie。

- `POST /api/v1/logout`
  - 清除 session，返回 204，同时清除 `session_id` cookie。

- `GET /api/v1/auth/google/start?redirect=<url>`
  - 浏览器跳转到此地址 → Worker 重定向到 Google 登录；
  - 登录成功后回到 `/api/v1/auth/google/callback`，再 302 回到 `redirect` 或 `AUTH_REDIRECT_BASE`。

- `GET /api/v1/auth/github/start?redirect=<url>`
  - 同上，走 GitHub OAuth。

### 4.0 桌面端（Electron）推荐的登录方式

从产品体验与兼容性角度，桌面端建议**永远在系统默认浏览器里完成 Google/GitHub OAuth**（避免在 Electron WebView 内登录触发风控/体验割裂），并在登录完成后通过 deep link 回到桌面端。

- 桌面端入口页建议带 `?desktop=1`（用于 Web 端识别“运行在桌面壳内”）。
- OAuth 发起仍然走：
  - `GET /api/v1/auth/google/start?redirect=<url>`
  - `GET /api/v1/auth/github/start?redirect=<url>`
- 其中 `redirect` 推荐使用：
  - `gemigo-desktop://auth`
  - 登录成功后 Worker 会 302 回到 `redirect`，桌面端接收 deep link 并完成桌面端会话写入/刷新页面。

如果你使用本仓库的桌面壳（`desktop/`），它会在主窗口拦截上述 `/auth/*/start` 导航并改用系统浏览器打开，同时确保 `redirect` 指向 `gemigo-desktop://auth`。

### 4.1 前端建议的调用方式（伪代码）

以 React + fetch 为例（仅示意）：

```ts
// 获取当前用户
async function fetchCurrentUser() {
  const res = await fetch('/api/v1/me', {
    credentials: 'include',
  });
  const data = await res.json();
  return data.user; // 可能为 null
}

// 邮箱注册
async function signup(email: string, password: string) {
  const res = await fetch('/api/v1/auth/email/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  return data.user;
}

// 邮箱登录
async function login(email: string, password: string) {
  const res = await fetch('/api/v1/auth/email/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data.user;
}

// 退出登录
async function logout() {
  await fetch('/api/v1/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

// 使用 Google 登录
function loginWithGoogle() {
  const redirect = window.location.href;
  window.location.href =
    '/api/v1/auth/google/start?redirect=' + encodeURIComponent(redirect);
}

// 使用 GitHub 登录
function loginWithGithub() {
  const redirect = window.location.href;
  window.location.href =
    '/api/v1/auth/github/start?redirect=' + encodeURIComponent(redirect);
}
```

你可以按自己的 UI/状态管理方式（Zustand 等）把这些 API 封装成一个 `useAuthStore` 或 `authService`。

---

## 五、你可以按这个顺序验证

1. **部署 Worker 并确认 `/api/v1/me`**：
   - 未登录时：返回 `{ user: null }`。

2. **在本地用浏览器或 Httpie 试一下邮箱注册 / 登录**：
   - `POST /api/v1/auth/email/signup`
   - `GET /api/v1/me` → 应该返回新用户信息。

3. **再试 Google / GitHub 登录**：
   - 在浏览器里点击你接上的按钮，观察跳转流程；
   - 登录成功后，`/api/v1/me` 应该返回同一个用户（如果邮箱相同，会自动合并）。

4. **最后把 Dashboard 中对“当前用户”的展示接上（可选）**：
   - 例如右上角显示邮箱 / 头像 + 退出按钮；
   - 某些操作需要登录才允许执行。

---

如果你在配置这些变量 / OAuth App 的过程中遇到具体报错（比如 Google/GitHub 返回错误、Worker 抛异常），可以把错误信息或相关 Worker 日志贴给我，我再帮你针对性排查。  
