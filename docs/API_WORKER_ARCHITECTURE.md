# API Worker 架构与路由说明（gemigo-api）

> 这个文档的目标：
>
> - 让你（和未来的协作者）快速看懂 `workers/api` 的结构；
> - 知道「新加一个 API」应该往哪里写、怎么写；
> - 和 Node 后端 / Pages 的关系搞清楚。

配套文档：

- 账号体系与 OAuth 配置：`docs/AUTH_SETUP.md`

---

## 一、整体架构（高层）

当前后端拆分成三层：

- Cloudflare Pages（`gemigo.io`）
  - 提供前端静态页面 + `_worker.js` 代理。
  - `_worker.js` 会把 `/api/v1/*` 请求转发到一个「真正的后端」（`BACKEND_ORIGIN`）。

- Cloudflare Workers API（`workers/api`，Worker 名：`gemigo-api`）
  - 这是一个「面向产品」的 API 层：
    - 负责账号体系（邮箱 / Google / GitHub 登录）；
    - 负责项目列表 / 创建 / 更新（`projects`）；
    - 负责把 `/api/v1/deploy` 请求代理到 Node 部署引擎；
    - 使用 Cloudflare D1 作为数据库（`PROJECTS_DB`）。

- Node 部署服务（Aliyun 上的 Node 服务）
  - 只负责部署逻辑（打包、推 Pages / 压缩包、SSE 日志等）；
  - 对外暴露 `/api/v1/deploy` 和 `/api/v1/deployments/:id/stream` 这样的接口；
  - `gemigo-api` 通过 `DEPLOY_SERVICE_BASE_URL` 来访问它。

推荐的请求链路：

```text
Browser (gemigo.io) → Pages _worker.js → gemigo-api (Workers)
  → （部署相关）→ Node 部署服务
  → （账号/项目）→ D1 数据库 PROJECTS_DB
```

---

## 二、代码结构总览

`workers/api` 下关键文件：

- 入口与路由
  - `src/index.ts`：Cloudflare Worker 入口（`export default worker`）
  - `src/routes.ts`：集中定义所有 `/api/v1/...` 路由的「路由表」
  - `src/utils/routing.ts`：一个简单 Router 实现（支持 `:id` 这种 path param）

- 控制器（Controller）
  - `src/controllers/auth.controller.ts`
    - 账号相关：`/api/v1/me`、`/api/v1/logout`、邮箱登录/注册、Google/GitHub OAuth 起始与回调
  - `src/controllers/projects.controller.ts`
    - 项目 CRUD：`GET/POST /api/v1/projects`，`PATCH /api/v1/projects/:id`
  - `src/controllers/deploy.controller.ts`
    - 部署相关代理：`POST /api/v1/deploy`，`GET /api/v1/deployments/:id/stream`

- 服务（Service）
  - `src/services/project.service.ts`：项目业务逻辑（调用 AI 生成元数据、生成 URL 等）
  - `src/services/metadata.service.ts`：统一处理项目元数据（名称、slug、分类、标签）
  - `src/services/ai.service.ts`：调用大模型生成项目元数据（可关）
  - `src/services/oauth.service.ts`：封装 Google / GitHub OAuth 所有细节
  - `src/services/config.service.ts`：统一从环境变量读取配置

- 仓库（Repository）
  - `src/repositories/project.repository.ts`：D1 的 `projects` 表
  - `src/repositories/auth.repository.ts`：D1 的 `users` / `sessions` 表

- 工具与类型
  - `src/utils/http.ts`：`jsonResponse` / `readJson` / CORS 等
  - `src/utils/error-handler.ts`：`AppError` & 子类 + `handleError`
  - `src/utils/validation.ts`：邮箱/密码/字符串的校验
  - `src/utils/auth.ts`：密码哈希、Session Cookie、OAuth state Cookie
  - `src/types/env.ts`：`ApiWorkerEnv`（Worker 环境变量类型）
  - `src/types/project.ts` / `src/types/user.ts`：核心数据结构

整体风格：`index.ts`+`routes.ts` 负责「路由定义」，Controller 只负责「一个路由一个方法」，Service/Repository 则处理业务逻辑和数据访问。和 NestJS 的 `Module + Controller + Service + Repository` 很类似。

---

## 三、请求在 Worker 内部的调用链

以一个请求为例：`GET /api/v1/projects`

1. `index.ts` 收到请求：

   ```ts
   const url = new URL(request.url);
   const pathname = normalizePath(url.pathname);
   const method = request.method.toUpperCase() as HttpMethod;
   const router = buildApiRouter(env, url);
   const match = await router.match(pathname, method);
   return await match.handler(request, match.params);
   ```

2. `buildApiRouter(env, url)` 中注册了：

   ```ts
   router.add({
     path: '/api/v1/projects',
     method: 'GET',
     handler: (req) => projectsController.listProjects(req, env, requireDb()),
   });
   ```

3. `projectsController.listProjects` 实现：

   ```ts
   async listProjects(request: Request, env: ApiWorkerEnv, db: D1Database) {
     const projects = await projectService.getProjects(db);
     return jsonResponse(projects);
   }
   ```

4. `projectService.getProjects` 调用 `projectRepository.getAllProjects` 从 D1 读数据。

任何抛出的 `AppError` / `ValidationError` / `UnauthorizedError` 最终都会被 `index.ts` 里的 `handleError` 统一转成 JSON。

---

## 四、如何新增一个 API 路由

假设你要新增：

```http
GET /api/v1/projects/:id
```

### 1. 在 Controller 中添加方法

`src/controllers/projects.controller.ts`：

```ts
class ProjectsController {
  // ...

  // GET /api/v1/projects/:id
  async getProjectById(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string,
  ): Promise<Response> {
    const project = await projectService.getProjectById(db, id);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return jsonResponse(project);
  }
}
```

### 2. 在 Service／Repository 中实现逻辑

- 在 `project.service.ts` 中添加 `getProjectById`；
- 在 `project.repository.ts` 中添加相应的 SQL（`SELECT * FROM projects WHERE id = ?`）。

### 3. 在路由表里注册

`src/routes.ts`：

```ts
router.add({
  path: '/api/v1/projects/:id',
  method: 'GET',
  handler: (req, params) =>
    projectsController.getProjectById(req, env, requireDb(), params.id),
});
```

到这里，一个新的路由就完整接入了。

---

## 五、错误处理与验证约定

- 所有业务错误尽量抛自定义异常：
  - `ValidationError`：参数错误、格式不合法；
  - `UnauthorizedError`：需要登录 / 登录失败；
  - `NotFoundError`：资源不存在；
  - `ConfigurationError`：环境变量 / 绑定缺失；
- `handleError` 会统一输出 JSON：

  ```json
  {
    "error": "Email is already registered.",
    "code": "VALIDATION_ERROR"
  }
  ```

- 参数校验尽量用 `utils/validation.ts` 提供的函数：
  - `validateEmail`、`validatePassword`
  - `validateRequiredString`
  - `validateOptionalString`
  - `validateOptionalArray`

这样可以让 controller 逻辑非常清晰：

```ts
const body = await readJson(request);
const { email, password } = validateEmailPassword(body);
```

---

## 六、环境变量与配置

Worker 的环境变量类型定义在：`src/types/env.ts`。

`config.service.ts` 提供了一层封装，比如：

- `getAppsRootDomain(env)`：Apps 的根域名（默认 `gemigo.app`）
- `getDeployTarget(env)`：`'cloudflare' | 'local' | 'r2'`
- `getDeployServiceBaseUrl(env)`：Node 部署服务地址（默认本地 dev）
- `getAuthRedirectBase(env)`：OAuth 回调和登录后跳转基准（默认 `https://gemigo.io`）
- `getGoogleClientId/Secret`、`getGithubClientId/Secret`：OAuth 配置

建议：

- 所有需要读 `env.*` 的逻辑，尽量都通过 `configService` 这一层来读；
- 这样未来迁移 / 改名 / 切环境的时候，只需要改 `config.service.ts` 或 `wrangler.toml`。

具体的 Auth 相关环境变量与 Cloudflare 配置步骤，已经在 `docs/AUTH_SETUP.md` 中详细列出。

---

## 七、部署与本地开发（简略）

### 1. 安装依赖

```bash
cd workers/api
pnpm install  # 或 npm install
```

### 2. 本地类型检查

```bash
cd workers/api
npx tsc -p tsconfig.json
```

### 3. 本地开发（wrangler dev）

```bash
cd workers/api
pnpm dev
```

然后访问 wrangler 提供的本地 URL，例如：

```text
http://127.0.0.1:8787/api/v1/me
```

### 4. 部署

```bash
cd workers/api
pnpm deploy
```

部署前请确保：

- `wrangler.toml` 中 `account_id`、D1 数据库配置正确；
- Cloudflare Dashboard 中已经为 Worker 配置好：
  - D1 Binding：`PROJECTS_DB`
  - 环境变量：`AUTH_REDIRECT_BASE`、`PASSWORD_SALT`、`GOOGLE_*`、`GITHUB_*` 等。

---

## 八、上线前 checklist（概览）

1. Cloudflare：
   - D1 数据库 `gemigo-projects` 正常可用，Worker 绑定名为 `PROJECTS_DB`；
   - `gemigo-api` Worker 的环境变量按 `AUTH_SETUP.md` 配置好；
   - `wrangler deploy` 成功。

2. Pages (`gemigo.io`)：
   - `_worker.js` 的 `BACKEND_ORIGIN` 指向 `gemigo-api` 的域名；
   - 前端改为直接调用相对路径 `/api/v1/...`。

3. 前端集成：
   - 使用 `/api/v1/me` 获取当前登录用户；
   - `/api/v1/auth/email/signup`、`/api/v1/auth/email/login` 完成邮箱登录；
   - `GET /api/v1/auth/google|github/start?redirect=...` 挂在按钮上；
   - 项目列表 / 创建 / 更新走 `/api/v1/projects` 系列接口。

4. 可观测性：
   - 在 Cloudflare Dashboard 查看 Worker 日志，确认错误都能看见；
   - 前端对 `code: 'VALIDATION_ERROR' | 'UNAUTHORIZED'` 等有友好的提示。

如果未来要继续扩展（比如「项目分析记录」、「计费」、「团队」等），建议继续沿用现在的分层和路由模式：先考虑 Controller 方法签名，再在 `routes.ts` 中注册路由，最后落到 Service/Repository。这样整个系统在规模变大时也比较容易维持清晰度。  

