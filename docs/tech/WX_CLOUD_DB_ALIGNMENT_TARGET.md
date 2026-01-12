# 微信小程序 `wx.cloud.database()` 对齐目标文档（DB 部分）

目的：把“微信小程序云开发（CloudBase）数据库”的**行为/写法/心智**系统化整理出来，作为 GemiGo `gemigo.cloud`（尤其是 `wx.cloud` 风格 facade）后续迭代的**设计基准与推进节奏**。

本文件只覆盖 **DB**（Cloud Database）。文件/函数/鉴权另文讨论，但会在本文件中标注与 DB 相关的依赖点（如 `_openid` 与权限规则）。

---

## 0) 我们的总原则（PM + 架构师）

### 0.1 默认策略（强约束）

- **只要微信支持的 DB 行为/写法，我们默认都要对齐**，并形成一张“对齐矩阵”持续跟踪落地状态。
- 如果出现“必须不一致”的点，必须在本文件里写清楚：
  - 不一致的原因（安全/可维护性/平台约束）
  - 我们提供的替代写法/迁移策略
  - 未来是否可能再次对齐（Yes/No + 条件）

### 0.2 我做出的关键决策（便于统一推进）

1) **提供 `wx.cloud` 风格 facade 作为主入口**：开发者写法优先对齐微信；底层仍可保留 `gemigo.cloud.db.*` 作为高级/原生接口。
2) **系统字段用下划线前缀（与微信一致）**：`_id`、`_openid`、`_createTime/_updateTime` 等，避免和业务字段混淆。
3) **权限/可见性必须服务端强制**：微信靠规则/权限配置；我们也必须在服务端实现等价能力（最小可行先做默认规则，逐步扩展）。
4) **性能陷阱要“外观对齐、语义可控”**：例如 `skip(n)` 允许写，但内部不走真实 OFFSET，必须有上限/保护并引导 cursor 分页。

---

## 1) 微信 `wx.cloud.database()`：开发者心智与接口形态（整理）

> 目标：描述“开发者在微信里怎么写、预期是什么”，而不是复刻微信底层实现细节。

### 1.1 入口与对象层级

- `wx.cloud.init({ env })`
- `const db = wx.cloud.database()`（也可带 `env` 选择环境）
- `const _ = db.command`：查询/更新操作符入口
- `const posts = db.collection('posts')`

### 1.2 Collection：集合对象既是“集合”也是“查询构建器”

典型链式（关键特征：**where 接收对象**，不是 field-op-value 三元组）：

```js
db.collection('posts')
  .where({ visibility: 'public' })
  .orderBy('createdAt', 'desc')
  .limit(20)
  .skip(0)
  .get()
```

常用方法（按心智）：

- 写入：`add({ data })`
- 单文档：`doc(id)` → `get/set/update/remove`
- 查询：`where(condition)`、`orderBy(field, direction)`、`limit(n)`、`skip(n)`、`get()`
- 统计：`count()`
- 聚合：`aggregate()`（在较复杂场景使用）

### 1.3 DocumentRef：单文档操作

- `doc(id).get()`：读取单条
- `doc(id).set({ data })`：全量覆盖（或按微信语义为 upsert/覆盖，需以官方为准）
- `doc(id).update({ data })`：部分更新（常配合 `db.command` 原子操作）
- `doc(id).remove()`：删除

返回结构常见风格（示例，仅表达“形状/心智”）：

- `add` → `{ _id }`
- `get` → `{ data: [...] }`（collection.get）或 `{ data: {...} }`（doc.get）
- `update/remove` → `{ stats: { updated/removed } }`
- `count` → `{ total }`

### 1.4 `db.command`：微信的核心表达能力

#### 1.4.1 查询操作符（where 的 value 里可出现）

常见有：`eq/neq/lt/lte/gt/gte/in/nin/and/or/exists` 等（不同版本可能有差异）。

写法示例：

```js
const _ = db.command
posts.where({
  visibility: _.eq('public'),
  likeCount: _.gte(10),
  tags: _.in(['ai', 'product']),
})
```

#### 1.4.2 更新操作符（update 的 data 里可出现）

常见有：`inc/mul/set/remove/push/pull/addToSet` 等（不同版本可能有差异）。

写法示例：

```js
const _ = db.command
posts.doc(postId).update({
  data: {
    likeCount: _.inc(1),
    updatedAt: db.serverDate(),
  }
})
```

### 1.5 系统字段（下划线前缀）：微信的“强区分”设计（必须明确）

> 这里整理的是“微信官方文档明确提到/依赖的系统字段与系统行为”，避免我们凭印象补字段导致对齐目标失真。

#### 1.5.1 系统字段清单（文档明确）

- `_id`
  - 语义：文档唯一 id。
  - 行为：`collection.add({ data })` 时，如果 `data` 里不传 `_id`，后台自动生成；如果指定 `_id`，不能与已有记录冲突。
  - 返回：`add` 返回 `{ _id }`。
- `_openid`
  - 语义：文档创建者的 openid（小程序用户标识），用于权限与“我的数据/作者主页”等典型查询。
  - 行为（在“基础权限配置”下）：
    - 创建记录时，系统会自动给记录加上 `_openid`，值等于当前用户 openid；
    - 不允许用户在创建记录时尝试设置 `_openid`；
    - 更新记录时，不允许修改 `_openid`。

> 重要：微信并不要求“所有场景都依赖 `_openid`”；微信后来引入了数据库安全规则，允许开发者写更灵活的规则，从而不必强依赖 `_openid` 字段。但 `_openid` 作为“基础权限配置的默认机制”仍然是开发者大量使用的事实标准，我们必须兼容。

#### 1.5.2 与权限模型绑定的“隐式行为”（这就是你之前提到的自动过滤）

微信文档明确指出：在“基础权限配置”下会出现一些系统默认行为（开发者容易困惑但又确实存在）：

- 当权限为“仅创建者可读写”时：**查询**会默认给查询条件加上 `_openid == 当前用户 openid`。
- 当权限为“仅创建者可读写”或“所有用户可读，仅创建者可写”时：**更新**前会默认先带上 `_openid == 当前用户 openid` 的查询条件，再对查询到的结果进行更新；
  - 即使使用 `doc.update` 也是如此，因此可能出现“更新操作不报错，但 updated=0”的情况（因为附加条件导致没有命中任何记录）。

这两点直接决定了“微信能写出来的代码”的真实语义边界：**你看起来没写 `_openid`，但平台帮你补了约束**。

#### 1.5.3 非系统字段，但微信强烈推荐的时间写法（我们也要对齐心智）

微信提供 `db.serverDate()` 作为“服务端时间引用”，可用于新增/更新字段值（例如 `createdAt/updatedAt`）。

结论（对齐策略）：

- 微信 DB 并没有把 `createdAt/updatedAt` 作为系统字段强制存在；它更像是一种“推荐用法/最佳实践”。
- 我们要对齐的是：提供等价的“服务端时间”能力与常见范式，而不是臆造 `_createTime/_updateTime` 这种微信未明确为系统字段的东西。

### 1.6 权限与规则（DB 能否支撑“知乎”类社区的关键）

微信里“前端直连数据库”能成立的前提是：

- 平台提供“数据库权限/规则配置”，服务端强制执行；
- 常见配置包括：仅创建者可读写、所有人可读但仅创建者可写、管理员权限等。

> 这意味着：**知乎类社区**在微信侧一般按“公开可读 + 作者/管理员可写”的规则配置来完成基础闭环；再用云函数承担聚合/风控/敏感逻辑。

---

## 2) “知乎”社区在微信侧通常如何建模（可行性说明）

> 目标：证明微信能力足以支撑典型社区（不要求一次性覆盖所有高级能力）。

### 2.1 建模（推荐心智）

- `posts`：帖子（公开/私密）
- `comments`：评论（引用帖子）
- `likes`：点赞事件（用户对帖子/评论的关系）
- `follows`：关注关系

典型字段：

- `posts`：`{ title, body, visibility, createdAt, updatedAt, ... }`
- `comments`：`{ postId, content, createdAt, ... }`

### 2.2 查询（关键用法）

- 广场 feed：`posts.where({ visibility: 'public' }).orderBy('createdAt','desc').limit(20).get()`
- 作者主页：`posts.where({ _openid: authorOpenid, visibility: 'public' }).orderBy(...).get()`
- 帖子评论：`comments.where({ postId }).orderBy('createdAt','asc').get()`

### 2.3 聚合/计数（常见实践）

“点赞数/评论数/热度”等通常不在前端 query 里做聚合，而是：

- 用云函数更新冗余计数字段（例如 `posts.likeCount`、`posts.commentCount`）；
- 或定时任务/触发器聚合（依赖具体平台能力）。

> 结论：微信能做知乎式社区，但“关系查询 + 聚合”需要正确的建模与规则/函数配合。

---

## 3) 我们的对齐目标：GemiGo 的 DB 设计基准

### 3.1 命名与入口（必须对齐）

对齐目标：

- `gemigo.cloud.init({ env? })`（对齐 `wx.cloud.init` 写法）
- `const db = gemigo.cloud.database()`（对齐 `wx.cloud.database`）
- `const _ = db.command`
- `db.collection(name)`

我做出的决策：

- facade 层的系统字段：`_id`、`_openid` 统一下划线前缀。
- 兼容层：保留原生 `gemigo.cloud.db.collection()` 返回的 `CloudDbDoc`（包含 `ownerId/etag/createdAt...`），但 facade 的默认返回以微信风格为主。

### 3.2 系统字段对齐（我们必须补齐）

微信对齐目标（系统字段的“强区分”）：

- `_id`：文档 id（系统生成或用户指定且不冲突）
- `_openid`：创建者标识（基础权限配置下由系统自动写入、且不可由客户端创建/修改）

我做出的决策（落在我们平台）：

- 我们的真实创建者标识是 `appUserId`：
  - facade 默认暴露 `_openid`（映射到平台的 `appUserId`），用于最大化兼容微信生态代码与心智。
- 在 facade 的 doc data 中注入：
  - `_id`（已实现）
  - `_openid`（已实现）
- 时间字段：
  - 不把 `_createTime/_updateTime` 作为“微信系统字段”对齐目标；
  - 我们可以在 facade 的 `_meta` 中提供 `_createTime/_updateTime`（或直接提供 `createdAt/updatedAt`），但必须明确这是“平台扩展”，不是微信系统字段。

### 3.3 查询能力对齐（必须做成“微信能写的我们能跑”）

对齐目标：

- `where(condition: object)` 支持任意字段；
- `db.command` 支持常用比较操作符（至少 `eq/neq/lt/lte/gt/gte/in/nin`）；
- `orderBy(field, direction)` 支持任意字段排序（受索引约束）；
- `limit/skip/get` 行为与微信一致（含限制/报错行为）。

我做出的决策（分期落地，避免一次性范围爆炸）：

- **V1（必须）**：where 任意字段 + 基础比较操作符 + 单字段 orderBy + limit + cursor 分页；
- **V1.1（必须）**：索引声明与“缺索引时明确报错”（对齐微信的可预期性）；
- **V2（可选）**：聚合 `aggregate()`、复杂逻辑 `and/or`、更丰富的 command。

### 3.4 更新能力对齐（原子操作/并发语义）

对齐目标：

- `doc.update({ data })` 支持 `db.command.inc/set/remove/...` 的常用原子操作；
- 并发冲突行为可预期（微信侧由平台保证；我们侧必须有等价机制）。

我做出的决策：

- 平台底层以 `etag/ifMatch` 做乐观并发控制（我们已有），facade 的“原子更新”必须最终落到服务端原子语义（而不是客户端读改写）。
- 在我们服务端能力没补齐前，facade 可以临时用读改写 + `ifMatch`（我们当前就是这样做的），但必须标注为“暂行实现”，并纳入替换计划。

### 3.5 权限/规则对齐（DB 的生死线）

对齐目标：

- 微信：通过控制台规则配置决定读写权限；
- 我们：必须提供等价的 **rules**（服务端强制执行），并把它作为 Cloud DB 的一等公民。

我做出的决策：

- V0 默认规则（已部分落地）：自己可读写全部；他人仅可读 `public`；
- V1 增强：可配置到 collection 级的 read/write 策略（owner/public/role），并支持字段白名单；
- V2：更完整的规则表达（必要时再做 DSL/表达式引擎）。

---

## 4) 对齐矩阵（我们要用它推进，不再零碎讨论）

> 说明：本表是“目标清单 + 当前差距”。每次迭代必须更新本表（新增一条 log + 更新状态）。

### 4.1 入口与对象模型

| 能力 | 微信写法 | 我们目标 | 当前状态 |
|---|---|---|---|
| init | `wx.cloud.init({ env })` | `gemigo.cloud.init({ env? })` | ✅ 已实现（占位） |
| database | `wx.cloud.database()` | `gemigo.cloud.database()` | ✅ 已实现（能力受限） |
| command | `db.command` | `db.command` | ⚠️ 部分（eq/inc/set/remove） |

### 4.2 CRUD

| 能力 | 微信写法 | 我们目标 | 当前状态 |
|---|---|---|---|
| add | `add({ data }) -> {_id}` | 同 | ✅ 已实现 |
| doc.get | `doc(id).get() -> {data}` | 同 | ✅ 已实现 |
| doc.set | `doc(id).set({data})` | 同 | ✅ 已实现（映射到覆盖写） |
| doc.update | `doc(id).update({data})` | 同 | ⚠️ 支持有限 command（服务端执行；仍是单行读改写） |
| doc.remove | `doc(id).remove()` | 同 | ✅ 已实现 |

### 4.3 Query（核心差距）

| 能力 | 微信写法 | 我们目标 | 当前状态 |
|---|---|---|---|
| where 任意字段 | `where({ postId })` | 同 | ⚠️ 已实现（字段路径目前仅允许 `a-zA-Z0-9_` 与 `.`） |
| 多操作符 | `_.gte/_.in/...` | 同 | ✅ 已实现 |
| orderBy 任意字段 | `orderBy('likeCount','desc')` | 同（受索引约束） | ⚠️ 已实现（缺索引检测未实现） |
| skip | `skip(n)` | 同写法，语义受控 | ✅ 已实现（模拟 + 上限） |
| cursor 分页 | （微信无直接 cursor API） | `get()._meta.nextCursor` + `startAfter(cursor)`（扩展） | ✅ 已实现（facade 扩展） |
| count | `count()` | 同 | ✅ 已实现 |

### 4.4 系统字段与返回结构

| 能力 | 微信 | 我们目标 | 当前状态 |
|---|---|---|---|
| `_id` | 系统字段 | facade data 注入 `_id` | ✅ 已实现 |
| `_openid` | 系统字段（基础权限配置会自动写入且不可篡改） | facade data 注入 `_openid` | ✅ 已实现 |
| 返回形状 | `{ data: [...] }` 等 | facade 对齐 | ✅ 部分（get/add/remove） |

### 4.5 权限/规则

| 能力 | 微信 | 我们目标 | 当前状态 |
|---|---|---|---|
| 规则配置 | 控制台 rules | 服务端 rules | ⚠️ 已实现 legacy permissionMode（Admin API 配置）；Security Rules 仍待实现 |

---

## 5) 明确的“不一致点”清单（必须写在这里）

> 默认都对齐；以下为我明确选择“暂不完全一致”的点（并给出替代策略）。

1) **隐式登录态**：
   - 微信：开发者体感上不需要自己管理 token（平台容器负责）。
   - 我们：Web 场景必须显式 `gemigo.auth.login()` 拿短期 token（安全边界）。
   - 替代：在 facade 文档里强调“先 login 再 database”；SDK 负责缓存短期 token，但不提供长期 refresh token。

2) **skip 的底层语义**：
   - 微信：支持 `skip`（具体实现由平台决定）。
   - 我们：不做真实 OFFSET，采用 cursor 多次请求模拟 + 上限，避免不可扩展。
   - 替代：提供 cursor 分页能力并在文档中明确推荐。

3) **update 的原子性（过渡期）**：
   - 微信：原子操作由平台数据库层保证。
   - 我们：在服务端补齐前，facade `command` 通过“读改写 + etag/ifMatch”暂行。
   - 约束：该实现只保证“并发不丢写”，不保证“高并发下的严格原子计数性能”；需要 V1 服务端原子化。

---

## 6) 推进节奏（建议路线图）

> 目标：系统化推进，不再零碎讨论。

### Phase A（已做：对齐写法入口）

- facade：`init/database/collection/doc/add/get/set/update/remove/skip/get`
- 默认可见性规则下推到 SQL，避免分页/游标问题

### Phase B（必须：让知乎例子“完全按微信写法跑起来”）

- where：支持任意字段 + 基础操作符（eq/neq/gt/gte/lt/lte/in）
- orderBy：支持任意字段（受索引约束）
- 索引：声明/校验机制（缺索引时给出明确错误）
- 系统字段：在 facade 返回中注入 `_id/_openid`；时间字段通过扩展字段或业务字段实现

### Phase C（增强：更接近成熟 CloudBase）

- count/aggregate
- 规则系统（collection 级规则 + 字段校验 + 角色）
- 更丰富 command（数组/集合操作等）

---

## 7) 如何验证（建议标准化）

每次迭代至少补齐：

1) demo：在 `prototypes/sdk-auth-demo/` 增加对应按钮/用例；
2) 规则：新增一个“公开/私密、他人访问”的验证用例；
3) 工程质量：`pnpm lint` + `pnpm typecheck` 必须通过；
4) SDK 构建：`pnpm build:sdk` 必须通过。

---

## 8) 发布说明（标准流程）

1) Worker 部署（若本次涉及 DB 服务端语义变更）：

```bash
pnpm --filter deploy-your-app-api-worker run deploy
```

2) SDK 发布：

```bash
pnpm build:sdk
pnpm publish:sdk
```

---

## 9) 仍需补齐/确认的微信细节（待对照官方文档）

> 我建议把下面列表当成“对齐验收清单”，逐项对照微信官方文档确认细节后，再固化为更精确的约束（例如大小限制、错误码、索引规则）。

- 文档大小/字段数量/查询限制的硬上限（微信官方约束）
- `doc.set` 是否 upsert、`collection.get` 与 `doc.get` 的完整返回结构与错误形态
- `aggregate`/事务/批量写的具体行为与限制
- 索引的声明方式与缺索引时的错误行为（微信侧）
