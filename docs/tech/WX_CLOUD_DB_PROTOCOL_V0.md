# GemiGo wx.cloud DB Protocol v0（规范/协议）

状态：Draft  
版本：v0.1  
范围：仅 DB（Cloud Database）；不包含 Blob/Functions/Auth UI。

本协议的目标：定义一个**业务无关**、以微信小程序 `wx.cloud.database()` 为基准的数据库协议，使得后续实现（SDK/Worker/其它运行时）仅是对本协议的实现，而不是零碎讨论的堆叠。

---

## 1. 术语

- **Platform**：提供云数据库能力的一方（GemiGo）。
- **Client**：调用 `wx.cloud` 风格 API 的应用运行时（Web/小程序/云函数/Web SDK 等）。
- **App**：一个接入方应用（多租户隔离单位）。
- **User**：App 内用户（app-scoped）。
- **Collection**：集合（类似表）。
- **Document**：文档（类似行）。
- **System Field**：系统字段（下划线前缀），由平台生成/控制，客户端不得伪造。

---

## 2. 协议形态（SDK API）

### 2.1 入口

#### `cloud.init(options?) -> void`

- `options?: { env?: string }`
- 语义：对齐微信 `wx.cloud.init({ env })` 写法；用于选择环境/命名空间（实现可选）。

#### `cloud.database(options?) -> Database`

- `options?: { env?: string }`
- 返回 `Database` 对象。

### 2.2 Database

#### `db.command -> Command`

`Command` 提供 where/update 的字段操作符（见第 4 章）。

#### `db.collection(name: string) -> Collection`

- `name` 为集合名（实现可约束长度/字符集）。

#### `db.serverDate(options?) -> ServerDate`

- `options?: { offset?: number }`（毫秒）
- 语义：服务端时间引用，可用于 `add/set/update/where` 的字段值。

> 备注：微信提供 `db.serverDate()`；它不是系统字段，但属于强烈推荐的时间写法。本协议要求支持。

### 2.3 Collection（同时是 Query Builder）

#### `collection.add({ data }) -> Promise<{ _id: string | number }>`

- `data: object`
- 行为：若 `data._id` 不存在，平台自动生成 `_id`；若指定 `_id`，不得与已有冲突。

#### `collection.doc(id: string | number) -> DocumentRef`

#### `collection.where(condition: object) -> Collection`

对齐微信：`where` 接收对象，不是三元组；条件值可为字面量或 `db.command.*` 表达式。

#### `collection.orderBy(field: string, direction?: 'asc'|'desc') -> Collection`

#### `collection.limit(n: number) -> Collection`

#### `collection.skip(n: number) -> Collection`

对齐微信写法，但实现必须满足第 6.3 的“可控语义”约束（避免不可扩展）。

#### `collection.startAfter(cursor: string) -> Collection`（扩展）

GemiGo 扩展：用于高效分页（cursor/keyset pagination）。cursor 来自上一次 `get()` 返回的 `_meta.nextCursor`。

#### `collection.get() -> Promise<{ data: Document[], _meta?: { nextCursor: string | null } }>`

- 返回结构对齐微信：`{ data: [...] }`
- 允许扩展字段：`_meta`（见第 6.4）

#### `collection.count() -> Promise<{ total: number }>`

#### `collection.update({ data }) -> Promise<{ stats: { updated: number } }>`

批量更新；受规则系统限制（见第 5 章）。

#### `collection.remove() -> Promise<{ stats: { removed: number } }>`

批量删除；受规则系统限制（见第 5 章）。

### 2.4 DocumentRef

#### `doc.get() -> Promise<{ data: Document }>`

#### `doc.set({ data }) -> Promise<void | { stats?: ... }>`

对齐微信写法。具体返回形状允许实现差异，但不得破坏“失败要报错”的一致性（见第 7 章）。

#### `doc.update({ data }) -> Promise<{ stats: { updated: number } }>`

支持 `db.command` 原子操作（见第 4.2）。

#### `doc.remove() -> Promise<{ stats: { removed: number } }>`

---

## 3. 数据模型与系统字段

### 3.1 Document 结构

Document 是一个 JSON 对象，分为：

- **User Data**：业务字段（不以下划线开头）
- **System Fields**：系统字段（以下划线开头）

### 3.2 系统字段（必须对齐微信的“强区分”）

本协议要求至少支持以下系统字段，并遵循不可伪造/不可篡改原则：

- `_id: string | number`
  - 文档唯一标识
  - 行为：`add` 时可由平台生成；若客户端指定则需唯一
- `_openid: string`
  - 创建者标识（微信语义）
  - 行为（至少在“基础权限模式”下必须成立）：
    - 创建时平台自动写入 `_openid = auth.openid`
    - 客户端禁止在创建时显式设置 `_openid`
    - 客户端禁止在更新时修改 `_openid`

> 说明：我们平台真实的创建者标识可能是 `appUserId`。协议层仍以 `_openid` 作为 facade 的标准字段名；实现可以内部映射，但对外必须一致。

### 3.3 系统字段保留规则

- 客户端在 `data` 中设置任何以 `_` 开头的字段：
  - 除 `_id` 外，平台必须拒绝或忽略（推荐拒绝并返回明确错误）。
- 平台可以扩展更多系统字段，但必须：
  - 以 `_` 开头；
  - 文档中明确列出；
  - 不得与用户字段产生歧义。

---

## 4. Command 表达式（db.command）

### 4.1 查询操作符（用于 where）

`where({ field: <expr> })` 中 `<expr>` 可以是：

- 字面量：`string|number|boolean|null|object|array`
- Command 表达式：
  - `_.eq(value)`
  - `_.neq(value)`
  - `_.gt(value)` / `_.gte(value)`
  - `_.lt(value)` / `_.lte(value)`
  - `_.in(list)`
  - `_.nin(list)`
  - （可选扩展）`_.exists(bool)`、`_.and([...])`、`_.or([...])`

### 4.2 更新操作符（用于 update）

`update({ data: patch })` / `doc.update({ data: patch })` 中 `patch[field]` 可以是：

- 直接替换值（等价 set）
- Command 表达式：
  - `_.set(value)`
  - `_.remove()`
  - `_.inc(n)`
  - （可选扩展）`_.mul(n)`、`_.push(v)`、`_.pull(v)`、`_.addToSet(v)`

### 4.3 嵌套字段与点表示法

对齐微信索引说明：字段路径允许使用点表示法（如 `style.color`）。实现可以分期支持，但若不支持必须返回明确错误并在能力矩阵标注。

---

## 5. 权限与规则（必须服务端强制）

本协议要求平台实现**规则系统**（Rules），用于决定每次操作的读/写是否允许。

### 5.1 两种模式（对齐微信演进）

#### A) 基础权限模式（Legacy Permission）

至少提供与微信“基础权限配置”等价的 4 类预设策略（以集合为单位）：

1) 所有用户可读，仅创建者可写
2) 仅创建者可读写
3) 所有用户可读（仅管理端可写/或不允许写，视实现）
4) 所有用户不可读写

并要求复刻微信文档中提到的隐式行为：

- “仅创建者可读写”时，查询会隐式追加 `_openid == auth.openid`
- “仅创建者可读写”或“所有用户可读，仅创建者可写”时，更新会先隐式追加 `_openid == auth.openid` 再更新；因此可能出现 `updated=0` 而不是抛错

#### B) 安全规则模式（Security Rules）

支持以规则表达式定义集合记录的读写条件（例如 `doc._openid == auth.openid`），并要求：

- 平台拒绝不满足规则子集的查询（微信语义：查询条件必须是规则的子集）
- 支持字段级校验（白名单/类型/长度）作为可选增强

> 本协议只定义“必须存在规则系统及其语义”，不强制规则 DSL 的具体语法；但需要在实现文档中给出唯一语法并版本化。

### 5.2 身份上下文（auth）

规则评估必须基于不可伪造的身份上下文，例如：

- `auth.openid`（等价创建者 id）
- `auth.appId`（租户）
- `auth.scopes`（最小授权）

> 这部分属于平台 Auth 协议的输入；DB 协议只要求“DB 服务端必须可获得并可信”。

---

## 6. 查询与分页语义（性能与一致性约束）

### 6.1 索引要求（对齐微信：可预期、可运营）

平台必须具备“索引命中/缺索引报错”的机制，至少满足：

- 当查询无法使用合适索引时，平台返回明确错误（而不是悄悄全表扫描直到超时）。
- 平台提供“索引建议/诊断信息”（可选，但强烈建议）。

### 6.2 limit 与 orderBy

- `limit(n)` 必须有上限（例如 100），超限要么报错要么截断（需明确统一）。
- `orderBy` 默认只允许单字段排序；多字段排序作为可选扩展。

### 6.3 skip（必须“写法对齐、语义可控”）

为了对齐微信写法，`skip(n)` 必须存在；**我们关心的是外部可观测行为**，协议对此做出明确要求：

- 在满足“确定性排序”的前提下，`skip(n).limit(m).get()` 的结果必须与“对同一查询按相同排序取第 `n+1..n+m` 条”一致。
  - “确定性排序”可以来自：
    - 显式 `orderBy(field, direction)`；或
    - 平台定义的默认排序（必须文档化，且包含稳定 tie-break，例如 `(_orderField, _id)`）。
  - 若既无显式 `orderBy`、平台也未定义默认排序，平台必须返回 `INVALID_ARGUMENT`（避免不一致的“默认顺序”）。

在保证上述外部行为的同时，平台实现必须满足：

- `skip(n)` 有最大值上限（例如 1000），超过则必须报错；
- `skip(n)` 不得隐式导致不可控的资源消耗（例如无限扫描/无限请求）。

实现建议：

- 对外保留 `skip`；
- 对内用 cursor 分页模拟（多次翻页直到跳过 n 条），或直接拒绝大 `skip` 并引导使用 cursor。

### 6.4 cursor（第一优先分页能力）

为了覆盖“Feed/无限滚动/位置恢复”等通用场景，平台必须提供 cursor 分页能力，并承诺：

- `get()` 返回 `_meta.nextCursor`（string 或 null），其含义为“继续获取下一页”的不透明游标；
- `startAfter(cursor)`（或等价输入方式）必须能从该游标继续查询；
- cursor 必须与排序绑定：同一 cursor 仅对“同一 collection + 同一 where + 同一 orderBy”有效；若不匹配必须报错 `INVALID_ARGUMENT` 或 `FAILED_PRECONDITION`。

为了兼容微信 `{ data }` 返回形状，本协议约定 cursor 放在 `_meta`：

```js
const res = await posts.orderBy('createdAt', 'desc').limit(20).get()
// res.data: Document[]
// res._meta.nextCursor: string|null
```

---

## 7. 错误模型（协议级约束）

对齐微信开发者体验：错误必须**可预测**、**可分类**。

协议要求错误至少分为：

- `INVALID_ARGUMENT`：参数非法（集合名/字段名/操作符/类型不匹配）
- `NOT_FOUND`：文档不存在（doc.get）
- `PERMISSION_DENIED`：规则拒绝/无权
- `FAILED_PRECONDITION`：缺索引/违反限制（如 skip 超限）
- `CONFLICT`：写入冲突（如 `_id` 冲突、并发控制冲突）
- `INTERNAL`：平台内部错误

返回形态不强制与微信完全一致（微信常见 `errMsg`），但必须：

- 有稳定的机器可读 `code`
- 有可读 `message`
- 在批量操作里提供 `stats.updated/removed` 且语义一致

---

## 8. 一致性与并发（协议要求）

### 8.1 `_openid` 的不可伪造性

- 平台必须以身份上下文生成 `_openid`，并拒绝客户端伪造/修改。

### 8.2 原子更新

当支持 `_.inc` 等原子操作时，平台必须提供服务端原子语义（否则必须明确标记为“非原子/过渡实现”并限制使用场景）。

### 8.3 幂等与重试

平台应允许客户端安全重试读操作；写操作如需支持幂等，应通过额外机制（如 requestId）实现并文档化（可选扩展）。

---

## 9. 传输映射（HTTP/RPC，供实现参考）

本章不属于“业务协议核心”，但为了让实现可落地，需要定义一个可实现的传输映射。可选实现如下：

- `POST /cloud/db/collections/:collection/docs`（add）
- `GET /cloud/db/collections/:collection/docs/:id`（doc.get）
- `PUT/PATCH/DELETE /cloud/db/collections/:collection/docs/:id`（set/update/remove）
- `POST /cloud/db/collections/:collection/query`（where/orderBy/limit/skip/get/count）

鉴权建议：

- 使用 `Authorization: Bearer <token>`（平台 Auth 协议定义 token 形状）
- scopes 至少区分 `db:rw`

---

## 10. 与微信“必须不一致”的点（协议层显式声明）

> 原则：默认对齐；不一致必须写清楚原因与替代。

1) **Web 场景的登录态**：微信容器可隐式携带身份；Web 必须显式登录获取短期 token（安全边界，不可避免）。
2) **skip 的实现细节**：为了可扩展性，平台不承诺“必须使用数据库 OFFSET 实现”；但 **承诺外部可观测行为等价于 offset**（在确定性排序与上限范围内），超出范围必须明确报错/引导 cursor。
3) **规则 DSL 语法**：微信有官方规则语法；本协议只要求“规则系统与语义必须等价”，具体 DSL 必须另文版本化（避免把 DSL 锁死在协议里导致演进困难）。
