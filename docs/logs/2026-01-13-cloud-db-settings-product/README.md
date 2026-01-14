# 迭代日志：Cloud DB 配置产品化（Project Owner 自助配置）

日期：2026-01-13  
主题：把 Cloud DB 的“权限/规则配置”做成平台产品功能（对标 wx 云开发 / Firebase 的 console）

---

## 背景与目标（结论）

现状问题：

- Cloud DB 默认是 `creator_read_write`（仅创建者可读写）。开发者要做“公开广场/社区”时，必须配置权限/规则，否则会出现“看不到别人数据”的体感。
- 之前只有 Admin API 能改规则，**普通应用拥有者无法自助配置**，这不符合“产品能力”的预期，也不利于对标微信/Firebase。

本次目标：

- 让“项目拥有者（Project Owner）”在 `gemigo.io` 的项目设置里直接配置：
  - Legacy Permission Mode（简单模式）
  - Security Rules（推荐，支持模板 + JSON 编辑）
- 保持与协议一致：平台只提供规则引擎与强制执行，不引入业务预设语义。

我做出的架构决策（我会这么定）：

- **权限/规则配置按 appId + collection 维度**存储，appId 由项目 `slug` 唯一确定（即 `https://<slug>.gemigo.app` 的 `<slug>`）。
- **对外“可配置入口”必须是 owner-scope**，不再要求管理员介入；管理员 API 保留用于运维与紧急处理。
- **Security Rules 优先级高于 Legacy Permission**：当某 collection 配置了 rules，则按 rules 强制；否则才走 legacy permission。

---

## 本次改动（已落代码）

### 1) Worker：新增 Project Owner 自助配置接口（非 Admin）

新增 controller：

- `workers/api/src/controllers/cloud-db-settings.controller.ts`

新增路由（Project owner 才能调用，基于 session cookie）：

- `GET /api/v1/projects/:id/cloud/db/collections/:collection/permission`
- `PUT /api/v1/projects/:id/cloud/db/collections/:collection/permission`（body: `{ mode }`）
- `DELETE /api/v1/projects/:id/cloud/db/collections/:collection/permission`
- `GET /api/v1/projects/:id/cloud/db/collections/:collection/security-rules`
- `PUT /api/v1/projects/:id/cloud/db/collections/:collection/security-rules`（body: `{ rules }`）
- `DELETE /api/v1/projects/:id/cloud/db/collections/:collection/security-rules`

安全与一致性：

- 权限校验：必须登录且是项目 owner；并要求项目存在且 `slug` 可用（slug 即 appId）。
- collection 名校验：仅允许小写字母/数字/`-`/`_`（与 SDK/协议一致）。
- rules 校验：按 `SecurityRulesV0` 解析与限制（最大 32KB）。

### 2) Worker：补齐 rules/permission 的删除能力

新增仓储方法：

- `workers/api/src/repositories/sdk-cloud.repository.ts`
  - `deleteDbCollectionPermission()`
  - `deleteDbCollectionSecurityRules()`

### 3) 前端：项目设置新增 “Cloud DB” Tab（产品入口）

新增：

- `frontend/src/features/project-settings/components/tabs/settings-cloud-db-tab.tsx`
- `frontend/src/services/http/cloud-db-settings-api.ts`
- `frontend/src/features/project-settings/stores/cloud-db-settings.store.ts`
- `frontend/src/features/project-settings/managers/cloud-db-settings-handler.ts`

接入：

- `frontend/src/features/project-settings/components/project-settings-card.tsx` 新增 Tab：`Cloud DB`
- `frontend/src/features/project-settings/managers/project-settings.manager.ts` 暴露 Cloud DB 配置动作

产品交互（MVP）：

- 输入 collection（默认 `posts`）→ Load 当前配置
- Legacy Permission Mode：选择/保存/重置
- Security Rules：模板（Public feed + owner / Owner only）+ JSON 编辑保存 + 删除
- 国际化：Cloud DB Tab 文案支持中/英
- 体验优化：缺少 `slug` 时给出引导；重置权限/删除规则二次确认；提供 `Format JSON`

### 4) 文档：第三方接入教程补齐“平台哪里配置”

- `docs/sdk/APP_SDK_THIRD_PARTY_AGENT_GUIDE.md` 增加 “在 GemiGo 平台哪里配置？” 指引

---

## 如何验证（本地）

1) 启动开发环境：

```bash
pnpm dev
```

2) 登录 `gemigo.io` 本地前端（`http://localhost:5173`），进入任意你拥有的项目设置页：

- `Project Settings` → Tab `Cloud DB`
- 确保项目已设置 `slug`（slug 即 appId）

3) 在 `Cloud DB` Tab 里：

- collection 填 `posts`，点 `Load`
- 选择 `Legacy Permission Mode`，点 `Save`
- 套用 `Template: Public feed + owner`，点 `Save rules`
- 点 `Format JSON` 验证格式化
- 再点 `Remove rules`（会二次确认）验证删除

4) 工程质量检查（必须）：

```bash
pnpm lint
pnpm typecheck
```

---

## 如何验证（产品视角 / 用户路径）

当应用已部署到 `https://<slug>.gemigo.app`：

1) 作为项目 owner 登录 `gemigo.io`
2) 打开该项目 → Settings → `Cloud DB`
3) 配置 `posts` collection 的读写策略
4) 回到你的应用（或 demo）验证：
   - 默认 `creator_read_write` 时只看到自己的数据（预期）
   - 配置 rules 后，按 rules 约束写查询（例如 public feed 必须带 `visibility == 'public'`）即可读取 public 数据

---

## 发布 / 部署说明

本次涉及：

- API Worker（新增 routes/controller）
- 平台前端（新增 Project Settings Tab + 调用接口）
- App SDK（本次功能不依赖 SDK 改动；如有 SDK 改动可按下述流程发布）

发布顺序（我会这么发）：

0) 发布前检查（必须）：

```bash
pnpm lint
pnpm typecheck
pnpm build
```

1) 部署后端（Worker）：

```bash
pnpm --filter deploy-your-app-api-worker run deploy
```

2) 构建并部署前端（Pages）：

```bash
pnpm build:frontend
pnpm deploy:pages
```

3) 发布 App SDK（仅当本次确实改了 `packages/app-sdk` 或需要发新版本）：

- 只构建验证：

```bash
pnpm build:sdk
```

- 发布到 npm（你已登录 npm 且有权限）：

```bash
pnpm publish:sdk
```

- 或者自动 bump version（patch/minor）再发布：

```bash
pnpm release:sdk
# or
pnpm release:sdk:minor
```

---

## 风险与回滚点

- 风险：项目 `slug` 为空时无法配置 Cloud DB（因为 slug=appId）；需要产品上提示用户先设置 slug。
- 风险：规则配置错误会导致应用侧 `PERMISSION_DENIED`；UI 已提供模板以降低误用。
- 回滚点：
  - 前端：隐藏/移除 `Cloud DB` Tab（不影响已有配置）
  - Worker：回滚 routes/controller（已有配置会留在 D1 表中，但不会被修改）
