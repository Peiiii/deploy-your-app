# 迭代日志：wx.cloud 风格全家桶对齐（App SDK + Cloud DB 语义修正）

日期：2026-01-12  
主题：对齐微信小程序云开发（`wx.cloud`）写法；修复 Cloud DB 的“隐式过滤/分页不稳定”问题

---

## 背景与目标（结论）

目标：让 App 开发者能用接近小程序的心智与写法完成云端能力调用（DB / Functions / Storage），并保持平台侧安全边界可控、实现可维护。

本次明确的架构决策（我会这么定）：

- **对齐写法（API facade）**：提供 `wx.cloud` 风格的 `gemigo.cloud.database()/callFunction/uploadFile/getTempFileURL` 等全家桶；
- **不对齐的点（但提供兼容外观）**：`skip(n)` 不做真实 SQL OFFSET，改为“多次 cursor 请求模拟 + 上限保护”，避免走向不可扩展实现；
- **DB 访问控制必须服务端强制**：不在平台代码里写任何“业务预设逻辑”（例如基于 `visibility` 的默认规则）；默认走协议里的 Legacy Permission，社区/公开广场通过 Security Rules（JSON DSL v0）配置实现。

---

## 本次改动（已落代码）

### 1) API Worker：对齐协议的权限模型与分页语义

- `workers/api/src/repositories/sdk-cloud.repository.ts`
  - 支持系统字段映射：`_id <-> id`、`_openid <-> owner_id`；
  - 支持稳定 cursor（与 `orderBy` 绑定，使用 `(orderValue, id)` 做 tie-break），并在服务端编码成不透明 cursor。
  - 协议对齐（B 方案）：`visibility/refType/refId` 不再作为平台字段；历史列数据会一次性迁移进 `data_json`（业务字段）。
- `workers/api/src/services/sdk-cloud.service.ts`
  - Legacy Permission 默认值为 `creator_read_write`（对齐微信的“仅创建者可读写”心智），并实现隐式追加 `_openid == auth.openid`（读/写侧）；
  - Security Rules 模式下，服务端执行规则子集校验（query/count/update/remove）与逐文档评估（doc.get/write）。
  - 协议对齐：服务端禁止写入除 `_id` 外的任何下划线字段（`_openid` 由平台注入），避免与系统字段语义冲突。

影响（行为变更）：

- 默认 legacy 为 `creator_read_write`（仅创建者可读写）；公开广场/社区必须通过 Security Rules（规则模板）显式配置（平台不再“猜测你要公开”）。

### 1.1) API Worker：补齐 where().count/update/remove

- 新增端点：
  - `POST /api/v1/cloud/db/collections/:collection/count`
  - `POST /api/v1/cloud/db/collections/:collection/update`
  - `POST /api/v1/cloud/db/collections/:collection/remove`
- 语义：
  - Legacy Permission：`creator_read_write` 下等价于隐式 `_openid == auth.openid`（因此只会影响自己的文档）。
  - Security Rules：先做“查询子集”校验，再逐文档评估是否可写。

### 1.2) API Worker：补齐 collection 级 Legacy Permission / Security Rules 配置入口

- 新增表：`sdk_db_collection_permissions`
- 新增表：`sdk_db_collection_security_rules`
- Admin API（仅管理员可调用）：
  - `GET /api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission`
  - `PUT /api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission`（body: `{ mode }`）
  - `GET /api/v1/admin/cloud/db/apps/:appId/collections/:collection/security-rules`
  - `PUT /api/v1/admin/cloud/db/apps/:appId/collections/:collection/security-rules`（body: `{ rules }`）

### 2) App SDK：新增 `wx.cloud` 风格 facade（全家桶）

新增/扩展：

- `packages/app-sdk/src/types/cloud.ts`
  - 新增 `WxCloudDatabase/WxCloudCollection/WxCloudDocumentRef` 等类型；
  - 新增 `db.command`（`eq/inc/set/remove`）与 `where({ ... })` 风格类型；
  - `CloudAPI` 新增：`init/database/callFunction/uploadFile/getTempFileURL`。
- `packages/app-sdk/src/web/cloud.ts`
  - 实现 `gemigo.cloud.database()`：支持 `collection().where().orderBy().limit().skip().get()`；
  - 实现 `doc.get/set/update/remove`（`update` 支持有限 `command`，并用 `etag/ifMatch` 做并发保护）；
  - 实现 `where().count/update/remove`（批量能力），并支持 where 的 `db.command` 查询操作符；
  - 实现 `callFunction`（转发到 `cloud.functions.call`）；
  - 实现 `uploadFile/getTempFileURL`（基于现有 `cloud.blob`）。

说明：

- `skip(n)`：通过多次 cursor 请求模拟，并设定上限（避免无限请求与不可扩展语义）。
- `uploadFile`：Web 端 `filePath` 传 `Blob/File`（不支持小程序的“受控文件路径”语义）。

### 3) 文档与 Demo：补齐对齐写法示例

- `docs/sdk/APP_DEVELOPER_GUIDE.md`：新增 `wx.cloud` 风格示例，并更新“作者主页查询”说明；
- `docs/sdk/APP_SDK_API.md`：补齐 `gemigo.cloud.database()/callFunction/uploadFile/getTempFileURL` 文档；
- `prototypes/sdk-auth-demo/index.html`：新增 facade 调用验证片段。

---

## 如何验证（本地）

1) 运行开发环境：

```bash
pnpm dev
```

2) 构建 SDK（确保 demo 使用最新 UMD）：

```bash
pnpm build:sdk
```

3) 启动 demo 静态服务：

```bash
python3 -m http.server 3001 -d .
```

4) 打开 demo：

- `http://localhost:3001/prototypes/sdk-auth-demo/`

依次点击：

- `Login via gemigo.auth.login()`
- `Cloud DB roundtrip`
  - 观察输出：既有 `gemigo.cloud.db.collection(...).query()`（旧写法）也有 `gemigo.cloud.database()`（wx 风格）。

5)（可选，验证 Security Rules / 子集约束）

前提：你的账号需要是管理员（Worker env 里 `ADMIN_EMAILS` 或 `ADMIN_USER_IDS` 命中）。

通过 Admin API 给 `demo-app/posts` 写入一份规则模板（公开可读 + 自己可写），然后在 demo 里用 `visibility='public'` 查询验证：

- `PUT /api/v1/admin/cloud/db/apps/demo-app/collections/posts/security-rules`（body: `{ rules }`）
- 预期：`where({ visibility: _.eq('public') }).get()` 可以读到 public 文档；且当 where 不包含任何规则分支所需的等值条件时，服务端返回 `PERMISSION_DENIED`（不会静默过滤）。

工程质量检查（必须）：

```bash
pnpm lint
pnpm typecheck
```

---

## 如何发布 / 部署

1) 部署 API Worker：

```bash
pnpm --filter deploy-your-app-api-worker run deploy
```

2) 发布 App SDK（仅当 `packages/app-sdk` 有改动时才需要）：

```bash
pnpm build:sdk
pnpm publish:sdk
```

（可选）使用版本脚本：

```bash
pnpm release:sdk
```

### 本次发布信息

- Worker URL：`https://gemigo-api.15353764479037.workers.dev`
- Worker Version ID：`c0a8e571-3c58-470a-896f-06268b4b1d80`

### 如何验证（线上）

```bash
curl -sS https://gemigo-api.15353764479037.workers.dev/api/v1/sdk/_debug
```

预期返回 200 JSON（例如 `{"activeTokens":0}`）。

---

## 风险与回滚点

- 风险：默认权限为 `creator_read_write`，如果业务侧期望“公开可读”，必须显式配置 Security Rules（模板），否则会出现“查不到别人数据”的体感差异。
- 风险：Security Rules DSL v0 能力有限（仅 `==` + `anyOf/allOf` + `auth.openid`），复杂规则需要等 v1 扩展；当前会通过 `PERMISSION_DENIED(query_not_subset_of_rules)` 早失败，不会静默过滤。
- 回滚点：通过 Admin API 把该 collection 的 permission mode 改为 `all_read_creator_write`（临时放开读），或移除/调整该 collection 的 Security Rules 配置。
- facade 的 `skip(n)` 为模拟实现且有上限；需要大分页请用 cursor（`startAfter`）或改用更窄的查询。
