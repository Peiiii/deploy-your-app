# 迭代日志：Gemigo Cloud（终态方向）— `gemigo.cloud` + Cloud DB/KV

日期：2026-01-11  
主题：直接面向终态开发：Gemigo Cloud（Auth + DB + Blob + Functions + Rules + 可分片数据平面）

---

## 背景与决策（结论）

- 我们的目标是让 App **不需要维护后端**，但仍能满足绝大多数需求（含社区/UGC）。
- 结论：终态不能只有 KV；必须具备：
  - `auth`（身份）
  - `cloud.db`（集合/文档，`db.collection` 心智）
  - `cloud.kv`（用户私有轻量数据）
  - 后续：`cloud.blob`（文件）、`cloud.functions`（可信计算）、`cloud.rules`（权限规则）、sharding（可扩展）
- 终态架构文档：`docs/tech/GEMIGO_CLOUD_END_STATE_ARCHITECTURE.md`

---

## 本次改动（已落代码）

### 1) API Worker：新增 Gemigo Cloud（DB/KV）端点

新增文件：

- `workers/api/src/types/sdk-cloud.ts`
- `workers/api/src/repositories/sdk-cloud.repository.ts`（D1 建表 + KV/DB 读写）
- `workers/api/src/services/sdk-cloud.service.ts`（鉴权、scope 校验、业务逻辑、审计日志）
- `workers/api/src/controllers/sdk-cloud.controller.ts`（HTTP 入口）

注册路由：

- `workers/api/src/routes.ts` 新增：
  - `GET /api/v1/cloud/kv/get?key=...`
  - `POST /api/v1/cloud/kv/set`
  - `POST /api/v1/cloud/kv/delete`
  - `GET /api/v1/cloud/kv/list?prefix=&limit=&cursor=`
  - `POST /api/v1/cloud/db/collections/:collection/docs`
  - `GET /api/v1/cloud/db/collections/:collection/docs/:id`
  - `PATCH /api/v1/cloud/db/collections/:collection/docs/:id`
  - `DELETE /api/v1/cloud/db/collections/:collection/docs/:id`
  - `POST /api/v1/cloud/db/collections/:collection/query`

权限（V0 先按终态骨架定好）：

- `cloud.kv`：要求 scope `storage:rw`
- `cloud.db`：要求 scope `db:rw`

日志：

- `workers/api/src/types/env.ts` 新增环境变量 `SDK_CLOUD_LOG_LEVEL`（`off|error|info|debug`）
  - 默认 `error`（只打失败）
  - 设为 `info` 可看到每次请求的 `op/appId/appUserId/ms/bytes` 等元信息（不打印用户数据内容）

### 2) App SDK：新增 `gemigo.cloud`（web 环境可用）

新增文件：

- `packages/app-sdk/src/types/cloud.ts`
- `packages/app-sdk/src/web/cloud.ts`

接入：

- `packages/app-sdk/src/types/index.ts`：新增 `cloud: CloudAPI`
- `packages/app-sdk/src/apis/index.ts`：挂载 `cloud: webCloud`
- `packages/app-sdk/src/web/auth.ts`：记录本次登录的 `apiBaseUrl`，供 `gemigo.cloud` 默认调用

能力范围：

- `gemigo.cloud.kv.*`：已实现（直连 API Worker，Bearer token）
- `gemigo.cloud.db.collection(...).add/doc/query()`：已实现最小集合模型（受限 where/orderBy/cursor）
- `gemigo.cloud.blob` / `gemigo.cloud.functions`：占位（暂抛 `NOT_SUPPORTED`）

### 3) Demo：补齐 scopes 并增加 cloud 验证

- `prototypes/sdk-auth-demo/index.html`：
  - 登录 scopes 增加 `storage:rw`、`db:rw`
  - 增加按钮用于验证 `gemigo.cloud.kv` 与 `gemigo.cloud.db`

---

## 如何验证（本地）

1) 启动（前端 + Worker + server）：

```bash
pnpm dev
```

2) 构建 SDK（确保 UMD 最新）：

```bash
pnpm build:sdk
```

3) 起 demo 静态服务（端口 3001）：

```bash
python3 -m http.server 3001 -d .
```

4) 打开 demo：

- `http://localhost:3001/prototypes/sdk-auth-demo/`

依次点击：

- `Login via gemigo.auth.login()`
- `KV: set/get/list` (calls `/api/v1/cloud/kv/*`)
- `DB: create/query` (calls `/api/v1/cloud/db/*`)

（可选）打开 Worker 日志：

- 在 Worker 环境变量里设置 `SDK_CLOUD_LOG_LEVEL=info`，观察 cloud 请求的结构化日志。

---

## 如何发布 / 部署

1) 部署 API Worker：

```bash
pnpm --filter deploy-your-app-api-worker run deploy
```

2) 发布 App SDK：

```bash
pnpm build:sdk
pnpm publish:sdk
```

> 说明：生产上 API 目前通过 `https://gemigo.io/api/v1` 入口访问（Pages `_worker.js` 反代）。如果未来要切到 `api.gemigo.io`，需要完成域名绑定与反代配置（见 `docs/tech/APP_SDK_AUTH_V0_TECH_SPEC.md`）。

本次已部署的 API Worker URL（Wrangler 输出）：

- `https://gemigo-api.15353764479037.workers.dev`
