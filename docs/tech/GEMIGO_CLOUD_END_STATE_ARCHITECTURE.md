# Gemigo Cloud 终态架构（Auth + DB + Blob + Functions + Rules + 可分片数据平面）

目的：让接入 `@gemigo/app-sdk` 的 App **不需要自建/维护后端**，仍能完成“绝大多数产品需求”（包含社区/UGC 应用），并且平台具备可治理能力（授权/撤销/审计/配额/风控）。

本文件描述“终态是什么”。分阶段落地路线图另见：`docs/sdk/APP_SDK_PLATFORM_ROADMAP.md` 与 `docs/tech/APP_SDK_STORAGE_V0_RESEARCH.md`。

---

## 1) 终态结论（我们已经做出的架构决策）

Gemigo Cloud 的终态不是“一个 KV”，而是一套 **BaaS（Backend-as-a-Service）**：

- `gemigo.auth`：平台身份（app-scoped 用户）
- `gemigo.cloud.kv`：轻量用户私有数据（跨设备恢复）
- `gemigo.cloud.db`：集合/文档数据库（`db.collection` 心智，承载社区数据）
- `gemigo.cloud.blob`：文件对象（图片/附件/媒体）
- `gemigo.cloud.functions`：托管计算（敏感逻辑、聚合、风控、三方密钥）
- `gemigo.cloud.rules`：服务端强制执行的权限规则（类似 Firebase Rules / 小程序云开发规则）
- 数据平面可扩展：按 `appId` 分片（sharding）+ 迁移，不被单库绑定

关键安全边界：

- App 代码默认不可信 → App 只持有短期 `access_token`（不发长期 refresh token）
- 所有云端能力都必须有：scopes（最小授权）+ 可撤销 + 审计 + 配额/限流

---

## 2) API 设计（终态对开发者呈现什么）

### 2.1 Auth

- `gemigo.auth.login()` → `{ accessToken, expiresIn, appUserId, scopes }`
- `gemigo.auth.getAccessToken()`

### 2.2 Cloud KV（用户私有，轻量）

适用：偏好、草稿、我的列表、个人缓存（跨设备可恢复）。

- `gemigo.cloud.kv.get(key)`
- `gemigo.cloud.kv.set(key, value, { ifMatch? })` → `{ etag }`
- `gemigo.cloud.kv.delete(key)`
- `gemigo.cloud.kv.list({ prefix?, limit?, cursor? })`

### 2.3 Cloud DB（集合/文档，社区/共享数据的主战场）

适用：帖子、评论、点赞、关注关系、公共 profile、榜单/聚合的原始数据等。

核心心智对齐：`db.collection(name)`。

- `const db = gemigo.cloud.db()`
- `const posts = db.collection('posts')`
- `posts.add(doc)` → `{ id }`
- `posts.doc(id).get()` / `.set(doc, { merge? })` / `.update(patch)` / `.delete()`
- `posts.query()`
  - `.where(field, '==', value)`（V1 先支持等值）
  - `.orderBy(field, 'asc'|'desc')`（V1 先支持单字段）
  - `.limit(n)`
  - `.startAfter(cursor)`（游标分页）
  - `.get()` → `{ items, nextCursor? }`
- `posts.onSnapshot(...)`（实时订阅，终态可选；不作为 V0/V1 必选）

### 2.4 Cloud Blob（文件对象）

适用：头像、图片、附件、音视频（以及将来 App 自己的导出包等）。

- `gemigo.cloud.blob.createUploadUrl({ path, contentType, size })` → `{ url, headers, blobId }`
- `gemigo.cloud.blob.getDownloadUrl(blobId)`（短时效 URL）
- `gemigo.cloud.blob.delete(blobId)`
- `gemigo.cloud.blob.list({ prefix?, limit?, cursor? })`

### 2.5 Cloud Functions（可信执行环境）

适用：聚合计数、反作弊、内容审核、签名/三方密钥调用、fanout、任务队列。

- `gemigo.cloud.functions.call(name, payload, { timeoutMs? })` → `{ data }`

---

## 3) 权限模型（Rules）与 scopes（必须区分）

这两者解决的问题不同：

- **scopes**：App 级别“这个应用能不能用某类能力”（最小授权/可撤销）
  - 例：`storage:rw`、`db:rw`、`blob:rw`、`functions:invoke`
- **rules**：数据级别“某个用户能不能读/写某条记录”（访问控制）
  - 例：帖子是否公开、作者能否编辑、只有管理员能删帖

### 3.1 我推荐的 rules 终态形态（可实现且可运营）

每个 app 有一份规则配置（版本化），按 collection 定义 read/write 条件：

- `request.auth.appUserId`（来自 token）
- `request.auth.scopes`（来自 token）
- `resource.data.*`（存量文档）
- `request.data.*`（待写入文档）

V1 建议先支持非常有限的表达能力（避免做 DSL 引擎）：

- 内置谓词：`isOwner(field='ownerId')`、`isPublic(field='visibility')`、`hasRole('admin')`
- 内置校验：字段白名单、长度/类型、只允许某些字段变更

终态再扩展为更完整的表达式引擎（可选）。

---

## 4) 数据平面（终态如何实现可扩展）

### 4.1 多租户隔离（必选）

所有数据对象必须绑定：

- `appId`（租户）
- `appUserId`（app-scoped 用户）

并且：

- 默认隔离：除非 rules 放行，不允许跨 `appUserId` 读取
- 公共数据：通过 `visibility='public'` 或显式 rules 放行

### 4.2 可分片（sharding）（终态必须具备）

原则：不要让“单库极限”决定产品天花板。

推荐做法：

- 按 `appId` 做路由：`shard = hash(appId) % N`
- Worker 侧绑定多个数据库：`DB_0..DB_(N-1)`（D1 或未来别的数据库）
- 迁移：支持把某个 `appId` 从 shard A 搬到 shard B（后台任务 + 双写/读切换）

### 4.3 存储介质的职责划分（终态）

- 结构化数据（KV/DB）：数据库层（短中等对象、强治理）
- 大对象（Blob）：对象存储（R2）+ 签名 URL
- 热点会话/实时：Durable Objects（可选，用于聊天室、在线态、热点聚合）

---

## 5) “社区 App”能否覆盖？（用真实模型验算）

以一个典型社区产品为例（帖子/评论/点赞/关注/Feed）：

- `posts`：`{ id, authorId, title, content, createdAt, visibility, ... }`
- `comments`：`{ id, postId, authorId, content, createdAt }`
- `likes`：`{ id, postId, userId, createdAt }`（可做成 `(postId,userId)` 唯一）
- `follows`：`{ id, followerId, followeeId, createdAt }`

关键需求与对应能力：

- 发帖/评论：`cloud.db`
- 权限（公开/私密、作者可编辑、管理员删帖）：`cloud.rules`
- 点赞数/评论数/热度排序：`cloud.functions`（聚合与反作弊）+ `cloud.db` 存原始事件
- 图片：`cloud.blob`
- Feed：
  - 初期：`posts` 按 `createdAt` 排序（受限查询）
  - 进阶：关注流 fanout（functions + queue），或按热度聚合（functions）

结论：**社区类 App 必须依赖 `cloud.db + rules + functions + blob` 才能“覆盖绝大多数需求”；仅 `kv` 不够。**

