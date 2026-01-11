# 迭代日志：产品评论（产品社区基础）

日期：2026-01-10  
目标：在 Web 端为产品（Project）提供评论能力，形成“发布 → 讨论 → 沉淀”的社区闭环。

---

## 产品决策（PM）

V1 取舍（优先闭环、控制复杂度）：

- 支持：登录用户发表评论；支持“单层回复”（`replyToCommentId`）；作者/管理员可删除（软删除）；所有人可查看列表（分页）
- 不做：编辑、Markdown/富文本、评论点赞、楼中楼折叠/线程化、通知、审核后台（后续迭代再补）
- 内容类型：纯文本（前端按文本展示）

---

## 架构设计（架构师）

实现落点：`workers/api`（Cloudflare Worker + D1），以模块化拆分 Repository/Service/Controller，并复用现有 session cookie 鉴权与 D1 绑定。

- 数据库：D1 新增表 `project_comments`（运行时自动建表，无需额外 migration 步骤）
- API：新增 comments endpoints，保持现有 `/api/v1/*` REST 风格
- 前端：在 Explore Feed 评论抽屉中接入真实接口（不再使用 mock）

---

## 改动清单

### API Worker（D1 + 路由）

新增/修改文件（核心入口）：

- `workers/api/src/routes.ts`：注册 comments 路由
- `workers/api/src/repositories/comment.repository.ts`：D1 schema + 查询/写入/软删除
- `workers/api/src/services/comment.service.ts`：业务规则（长度校验、回复校验、简单频控）
- `workers/api/src/controllers/comments.controller.ts`：HTTP 层参数解析 + 鉴权（可匿名读）
- `workers/api/src/types/comment.ts`：返回给前端的 `ProjectComment` 类型
- `workers/api/src/utils/http.ts`：补齐 CORS 允许 `DELETE`
- `workers/api/src/utils/error-handler.ts`：新增 `RateLimitError (429)`
- `workers/api/src/repositories/auth.repository.ts`：对外暴露 `ensureAuthSchema()`，允许 comments 模块在匿名读时 join users 表

#### API 约定

- `GET /api/v1/projects/:id/comments?page=&pageSize=`  
  返回：`{ items, page, pageSize, total }`
- `POST /api/v1/projects/:id/comments`（需登录）  
  Body：`{ content: string, replyToCommentId?: string | null }`  
  返回：`{ comment }`
- `DELETE /api/v1/comments/:id`（需登录，作者或 admin）  
  返回：`{ ok: true }`

#### D1 表结构（自动建表）

表：`project_comments`

- `id`（uuid，主键）
- `project_id`
- `user_id`
- `content`
- `reply_to_comment_id`（可空，单层回复）
- `created_at`, `updated_at`
- `deleted_at`（可空，软删除）

索引：

- `(project_id, created_at DESC)`（按项目拉取最新评论）
- `(user_id, created_at DESC)`（支持后续“我的评论”等能力）

### 前端（Explore Feed 评论抽屉）

- `frontend/src/services/http/comments-api.ts`：新增 comments HTTP client
- `frontend/src/constants.ts`：新增 `API_ROUTES.PROJECT_COMMENTS` / `API_ROUTES.COMMENT_BY_ID`
- `frontend/src/types.ts`：新增 `ProjectComment` 相关类型
- `frontend/src/features/explore/components/explore-feed.tsx`：评论抽屉接入真实接口（加载/发送/回复/删除），并展示真实评论数

---

## 如何验证

### 1) 质量检查（必须）

在 repo 根目录：

```bash
pnpm lint
pnpm typecheck
```

### 2) 本地功能自测（建议）

启动开发环境：

```bash
pnpm dev
```

手工验证路径（Web）：

1. 打开 Explore Feed，点击评论按钮打开抽屉
2. 未登录：发送评论应弹出登录（或提示未授权）
3. 登录后：发送评论应出现在列表顶部；点击“回复”可带上单层回复信息
4. 对自己评论点击“删除”，评论应从列表移除，评论数同步减少

---

## 如何发布 / 部署

建议发布顺序：先 Worker（提供 API）→ 再前端（调用 API）。

### 1) 部署 API Worker

在 repo 根目录（统一入口）：

```bash
pnpm deploy:workers
```

或只部署 API Worker：

```bash
pnpm --filter deploy-your-app-api-worker deploy
```

注意事项：

- 需要确保 `workers/api/wrangler.toml` 已正确绑定 `PROJECTS_DB`（D1）
- 本次 D1 表为运行时自动创建；首次请求 comments 相关接口会触发建表

### 2) 部署前端

构建：

```bash
pnpm build:frontend
```

Pages（GitHub Pages）发布（如果你们当前用的是这个流程）：

```bash
pnpm deploy:pages
```

---

## 回滚策略（简要）

- 仅回滚前端：前端不再调用 comments 接口即可（不影响其他 API）
- 回滚 Worker：删除/关闭 comments 路由即可；D1 表保留不会影响现有功能

