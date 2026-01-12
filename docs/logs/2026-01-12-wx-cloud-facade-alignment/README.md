# 迭代日志：wx.cloud 风格全家桶对齐（App SDK + Cloud DB 语义修正）

日期：2026-01-12  
主题：对齐微信小程序云开发（`wx.cloud`）写法；修复 Cloud DB 的“隐式过滤/分页不稳定”问题

---

## 背景与目标（结论）

目标：让 App 开发者能用接近小程序的心智与写法完成云端能力调用（DB / Functions / Storage），并保持平台侧安全边界可控、实现可维护。

本次明确的架构决策（我会这么定）：

- **对齐写法（API facade）**：提供 `wx.cloud` 风格的 `gemigo.cloud.database()/callFunction/uploadFile/getTempFileURL` 等全家桶；
- **不对齐的点（但提供兼容外观）**：`skip(n)` 不做真实 SQL OFFSET，改为“多次 cursor 请求模拟 + 上限保护”，避免走向不可扩展实现；
- **DB 访问控制必须服务端强制**：默认规则为“自己可读写全部；他人仅可读 `visibility='public'`”，并把筛选下推到 SQL，避免二次过滤导致的分页/游标问题。

---

## 本次改动（已落代码）

### 1) API Worker：修复 Cloud DB Query 的可见性与分页语义

- `workers/api/src/repositories/sdk-cloud.repository.ts`
  - 把“可见性规则”下推到 SQL：默认 `(owner_id = viewer OR LOWER(visibility)='public')`；
  - 当 query 指定 `ownerId != viewer` 时，服务端强制只查询公开文档（`LOWER(visibility)='public'`）；
  - 兼容历史数据 `visibility='Public'` 等大小写（使用 `LOWER(visibility)`）。
- `workers/api/src/services/sdk-cloud.service.ts`
  - 移除 query 的二次“visible filter”，避免 cursor 基于不可见数据生成导致的分页跳跃/潜在信息泄露；
  - `visibility` 解析改为：对 `public/private` 做大小写归一，其它自定义值保持原样（降低破坏性）。
  - cursor 协议升级为不透明游标（v1），与 `collection + where + orderBy` 绑定；不匹配时报 `invalid_cursor/cursor_mismatch`。

影响（行为变更）：

- 在默认 `permissionMode=visibility_owner_or_public` 下，query/count 需要显式写出 owner/public 分支（例如 `where visibility='public'`），避免“静默过滤”。

### 1.1) API Worker：补齐 where().count/update/remove

- 新增端点：
  - `POST /api/v1/cloud/db/collections/:collection/count`
  - `POST /api/v1/cloud/db/collections/:collection/update`
  - `POST /api/v1/cloud/db/collections/:collection/remove`
- 语义（v0 暂定）：`update/remove` 仅对 owner 的文档生效；`count` 复用读侧可见性规则。

### 1.2) API Worker：补齐 collection 级 permissionMode（Legacy Permission 雏形）

- 新增表：`sdk_db_collection_permissions`
- Admin API（仅管理员可调用）：
  - `GET /api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission`
  - `PUT /api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission`（body: `{ mode }`）

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

工程质量检查（必须）：

```bash
pnpm lint
pnpm typecheck
```

---

## 如何发布 / 部署

1) 部署 API Worker（包含 DB Query 语义修复）：

```bash
pnpm --filter deploy-your-app-api-worker run deploy
```

2) 发布 App SDK：

```bash
pnpm build:sdk
pnpm publish:sdk
```

（可选）使用版本脚本：

```bash
pnpm release:sdk
```

---

## 风险与回滚点

- 风险：历史数据若存在 `visibility='Public'` 等大小写不一致，已通过 `LOWER(visibility)` 读侧兼容；写入侧对 `public/private` 做归一。
- facade 的 `skip(n)` 为模拟实现且有上限；需要大分页请用 cursor（`startAfter`）或改用更窄的查询。
