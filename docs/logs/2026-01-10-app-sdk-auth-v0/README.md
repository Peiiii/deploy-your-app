# 迭代日志：App SDK 登录（V0，开始实现）

日期：2026-01-10  
主题：App SDK 登录与“知道用户是谁”（OAuth 授权码 + PKCE + Broker）

---

## 背景与约束

- App 运行域名：优先 A（独立打开）`*.gemigo.app`；B（iframe）也必须支持
- API 域名：必须在 `gemigo.io` 子域名下
- 结论：浏览器视角是跨站点（`gemigo.app` ↔ `gemigo.io`），不能依赖第三方 cookie 实现稳定无感续期

---

## 本次改动（已落代码）

### 1) API Worker：新增 SDK Auth V0 endpoints + D1 表

新增：

- `workers/api/src/types/sdk-auth.ts`
- `workers/api/src/repositories/sdk-auth.repository.ts`
- `workers/api/src/services/sdk-auth.service.ts`
- `workers/api/src/controllers/sdk-auth.controller.ts`

注册路由：

- `workers/api/src/routes.ts` 增加：
  - `POST /api/v1/sdk/authorize`
  - `POST /api/v1/sdk/token`
  - `GET /api/v1/sdk/me`
  - `GET /api/v1/sdk/_debug`

跨域支持：

- `workers/api/src/utils/http.ts`：CORS 允许 `Authorization` 头（便于 App 跨域用 Bearer token 调用）

D1 自动建表（运行时 `CREATE TABLE IF NOT EXISTS`）：

- `sdk_app_users`：生成 app-scoped `appUserId`
- `sdk_app_consents`：记录用户对 app 的授权 scopes（V0 暂未实现撤销入口，但表已预留）
- `sdk_auth_codes`：一次性授权码（短 TTL、一次性消费）
- `sdk_access_tokens`：短期 access token（V0 使用 opaque token 存 D1）

### 2) 前端：新增 Broker 页面（用于 popup 授权）

新增：

- `frontend/src/features/sdk-auth/pages/sdk-auth-broker.tsx`
- `frontend/src/services/http/sdk-auth-api.ts`

接入：

- `frontend/src/app.tsx`：对 `/sdk/broker` 做特殊渲染（避免进入完整后台壳），页面内部支持登录与授权按钮

### 3) App SDK：新增 `gemigo.auth.login()`（popup + PKCE）

新增：

- `packages/app-sdk/src/types/auth.ts`
- `packages/app-sdk/src/web/auth.ts`

接入：

- `packages/app-sdk/src/types/index.ts`：补齐类型与 `GemigoSDK.auth`
- `packages/app-sdk/src/apis/index.ts`：挂载 `auth: webAuth`

### 4) 本地 demo（便于验证）

新增：

- `prototypes/sdk-auth-demo/index.html`

---

## 如何验证（本地）

1) 启动平台（frontend + worker）：

```bash
pnpm dev
```

2) 构建 SDK（保证 `packages/app-sdk/dist` 最新）：

```bash
pnpm build:sdk
```

3) 在 repo 根目录起一个静态服务（模拟 app 站点，端口 3001）：

```bash
python3 -m http.server 3001 -d .
```

4) 打开 demo：

- `http://localhost:3001/prototypes/sdk-auth-demo/`

点击 `Login via gemigo.auth.login()`：

- 会打开 `http://localhost:5173/sdk/broker?...` 弹窗
- 在弹窗里登录并点击“允许”
- demo 页面会显示 `accessToken/appUserId/scopes`

（可选）用返回的 token 调用：

- `GET http://localhost:5173/api/v1/sdk/me`（Header: `Authorization: Bearer <accessToken>`）

---

## 如何发布 / 部署（V0 草案）

生产域名与路由的推荐规范入口（单一真相来源）：`docs/tech/APP_SDK_AUTH_V0_TECH_SPEC.md`。

### 1) 部署 API Worker

```bash
pnpm --filter deploy-your-app-api-worker deploy
```

### 2) 发布 App SDK

```bash
pnpm build:sdk
pnpm publish:sdk
```

> 生产域名与 OAuth redirect / broker 域名需要后续在部署侧统一对齐（本次先保证 V0 端到端跑通）。
