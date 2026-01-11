# App SDK 托管存储（V0）方案调研与推荐（重要决策）

结论先行（我的推荐，限定 V0）：**V0 采用 Cloudflare D1 作为“托管 KV（用户私有轻量数据）”的真相源**，通过 API Worker 暴露 Bearer-token API，并在 SDK 中提供 `gemigo.cloud.kv.*`（对齐 `wx.cloud` 的心智）；大对象（图片/文件）不在 V0 范围，后续走 R2（`gemigo.cloud.blob.*`）。

这份文档用于在开始实现前把关键决策一次性讨论清楚：能力边界、数据模型、安全、配额、演进路线。

重要澄清：**Gemigo Cloud 的终态不是只有 KV**。KV 只能覆盖“用户私有数据”的大头；社区/UGC 等共享数据需要 `cloud.db + rules + functions + blob`。终态架构见：`docs/tech/GEMIGO_CLOUD_END_STATE_ARCHITECTURE.md`。

Gemigo Cloud 的终态架构（KV 之外的 DB/Blob/Functions/Rules/sharding）：`docs/tech/GEMIGO_CLOUD_END_STATE_ARCHITECTURE.md`。

---

## 1. 业务目标（PM 视角）

我们要做“产品社区”，托管存储的价值不是“存个 key/value”，而是：

- 开发者不自建后端，也能做出“用户有状态”的 App（登录后数据跨设备可恢复）
- 平台能沉淀关系与行为数据（可审计、可治理、可风控）
- 能与后续能力闭环：Auth（知道用户是谁）→ Storage（存数据）→ Functions（托管计算）

V0 的产品承诺（明确边界，避免误解）：

- **解决“用户私有数据”的 80% 落地**：偏好、草稿、轻量个人业务数据（跨设备可恢复）
- **不承诺社区类共享数据能力**：不做复杂查询/索引/排序/Join（否则会变成“云数据库产品”，范围爆炸）

---

## 2. 约束与安全边界（架构师视角）

### 2.1 不可信 App 假设（必须贯彻）

- App 代码（尤其 vibe coding 生成站点）默认不可信
- 不能把“可无限续期的长期凭证”交给 App
- 所有托管存储操作必须通过：`access_token` + `scope` + 服务端审计/限流

### 2.2 运行形态约束（必须兼容）

- A：独立打开 `https://<slug>.gemigo.app`（跨站点到 `gemigo.io`）
- B：iframe 内嵌到 `https://gemigo.io`

结论：Storage API **不依赖 cookie**，统一用 `Authorization: Bearer <accessToken>`。

---

## 3. “存储”到底是什么：对齐小程序，不必创新的部分

小程序里“存储”其实分两类心智：

- 本地：`wx.setStorage`（设备内，轻量，离线可用）
- 托管：`wx.cloud`（云端，跨设备，跟用户身份绑定）

我们的现状：

- `gemigo.storage.*` 已存在，但实际是本地/宿主侧存储（web fallback 是 `localStorage`，extension 是 `chrome.storage.local`）

我的建议（避免混淆、避免破坏兼容）：

- 保留 `gemigo.storage.*` 的“本地/宿主存储”语义
- 新增托管能力：`gemigo.cloud.kv.*`（V0 只做 KV，后续扩展 blob/functions）

---

## 4. 候选方案调研（对比表）

我们只考虑当前体系最贴合的 4 个选项：D1 / KV / Durable Objects / R2。

### 4.1 D1（SQLite）

优点：

- 强一致读写（在 D1 的语义下），适合“用户刚写入就必须读到”的 KV
- 数据可审计、可备份、可迁移（后续迁到 Postgres 也更顺）
- 我们现有 API Worker 已经大量使用 D1（维护成本最低）

风险/缺点：

- 不是为海量高 QPS KV 设计（但 V0 可控：配额 + 限流 + 数据量上限）
- 全球延迟未必最低（需要靠 Worker + 缓存/分层演进）

### 4.2 Cloudflare KV（边缘 KV）

优点：

- 读很快、全球分发天然优势

风险/缺点（致命点）：

- 一致性模型偏最终一致，不适合作为“用户数据真相来源”
- 写入频率/语义限制，会逼着我们做复杂一致性补丁

结论：更适合做缓存/配置，而不是 App 用户数据的主存储。

### 4.3 Durable Objects（强一致 + 每对象串行）

优点：

- 强一致、天然适合“每个 appUserId 一个对象”的隔离与限流
- 未来可扩展到实时协作/会话态

风险/缺点：

- 复杂度更高（对象路由、生命周期、迁移/分片、成本模型）
- V0 容易 over-engineering

结论：作为 V1 的“热路径/实时/高频写”演进方向，而不是 V0 的首选。

### 4.4 R2（对象存储）

优点：

- 适合大对象（文件/图片/导出包）

风险/缺点：

- 不擅长 KV（列举/小对象频繁更新/事务）

结论：V0 不用它做 KV，只在后续做 `blob` 能力时引入。

---

## 5. 推荐方案（V0：D1 托管 KV）

### 5.1 数据模型（建议）

新增一张表（命名可讨论，示例）：

- `sdk_kv_items`
  - `app_id`（string）
  - `app_user_id`（string）
  - `key`（string）
  - `value_json`（string）
  - `value_bytes`（int）
  - `etag`（string，写入时生成，用于并发控制）
  - `updated_at`（int，unix ms）
  - 主键：`(app_id, app_user_id, key)`
  - 索引：`(app_id, app_user_id, key)`（用于 list prefix）

硬限制（V0 建议）：

- `key` 长度 ≤ 256
- `value_json` ≤ 64KB（超出让开发者走后续 blob）

### 5.2 API 设计（V0 最小闭环）

全部挂在现有 API Worker（`/api/v1`）下，且 **必须** Bearer token：

- `GET /api/v1/cloud/kv/get?key=...`
- `POST /api/v1/cloud/kv/set` `{ key, value, ifMatch? }`
- `POST /api/v1/cloud/kv/delete` `{ key }`
- `GET /api/v1/cloud/kv/list?prefix=&limit=&cursor=`

明确非目标（避免开发者误用）：

- 不用于承载“社区公共数据”（帖子/评论/点赞/关注流等），那属于 `cloud.db` 的范围
- 不提供通用查询/排序能力（否则会逼着我们做索引与规则系统）

鉴权规则：

- token 必须有效
- token 里带 `appId/appUserId/scopes`
- 需要 `storage:rw` scope（否则 403）

并发控制（推荐但可分期）：

- `set` 返回新的 `etag`
- 写入支持 `ifMatch`（不匹配返回 409），避免“多端覆盖”

### 5.3 SDK API（V0）

- `gemigo.cloud.kv.get(key)`
- `gemigo.cloud.kv.set(key, value, { ifMatch? })`
- `gemigo.cloud.kv.delete(key)`
- `gemigo.cloud.kv.list({ prefix?, limit?, cursor? })`（可选）

SDK 必须显式要求已登录（拿到 `accessToken`），否则返回可预测错误（例如 `SDKError('UNAUTHORIZED')`）。

---

## 6. 配额、限流与风控（必须在 V0 就有）

不做这些会直接变成“免费公共数据库”，不可控。

V0 最小策略（推荐）：

- 每 `appId` 总容量上限（例如 100MB）
- 每 `appUserId` 容量上限（例如 1–5MB）
- 单 key value 上限（例如 64KB）
- 每分钟写入次数上限（按 `appId`、按 `appUserId` 双维度）
- 全量审计日志（至少记录：appId/appUserId/key/bytes/结果/耗时）

---

## 7. 演进路线（把风险提前说清楚）

当 Storage 变成高频核心能力后，可能的演进（按收益/复杂度排序）：

1) **读缓存分层**：把热 key 的读取缓存到 KV（缓存不是主存储）
2) **大对象能力**：R2 + `gemigo.cloud.blob.*`
3) **强一致热路径**：Durable Objects（每用户/每 app 一个对象）承接高频写、会话态、实时协作
4) **结构化数据**：在 D1 之上扩展“集合/表”的更高层 API（但这会显著扩大产品面，需另立项目）

---

## 7.1 规模问题（必须讲清楚：D1 不是“无限”）

你提出的极端规模（例如 1000 个 App × 每个 100 万用户）属于“平台成熟期”的量级；**单个 D1 不可能作为长期唯一存储承载“无限 apps/无限用户”的所有数据**。

我推荐的正确姿势是把 Storage 当成一个可运营的产品能力：

- 从第一天开始就有 **配额/限流/计费口径**（否则一定会失控）
- 以 **多租户（appId + appUserId）隔离** 为基础，但在容量/吞吐逼近上限之前，必须具备 **分片（sharding）与迁移** 的演进路线

因此：

- **V0 用单个 D1** 的前提是：我们明确 V0 的目标是“打穿产品闭环”，并用配额把规模控制在 D1 可承受范围内
- **当增长发生**（例如 Top App 的 DAU/QPS/存储占用逼近阈值）再升级到：
  - 多个 D1 分片（按 `appId` 路由到不同 D1）
  - 热点/强一致会话态用 Durable Objects 承接（如确有需求）
  - 大对象转 R2（`cloud.blob`）
  - 终局可迁到独立数据库集群（如 Postgres/分布式 KV），而不是被 D1 限制住产品

---

## 8. 我建议的下一步（讨论清单）

为了开始实现，需要把下面 3 个问题定死（我也给出推荐）：

1) SDK 命名：我推荐 `gemigo.cloud.kv.*`（不复用 `gemigo.storage`）
2) V0 是否必须支持 `list`：我推荐 **先做**（否则很多业务要 hack）
3) V0 并发控制是否做 `etag/ifMatch`：我推荐 **先做**（多端覆盖问题会很快出现）

---

## 9. 其他平台调研（重点：微信小程序）

这一节的目标不是“照抄实现细节”，而是提炼出**可复用的产品/安全模型**，让开发者心智最小、平台可持续维护。

### 9.1 微信小程序（重点参考）

#### 9.1.1 我们应该对齐的心智（不必创新）

- **身份是 app-scoped**：小程序侧以 `openid`（每个小程序一个）为核心身份；我们对应为 `appUserId`（每个 app 一个）。
- **“客户端拿临时凭证 → 服务端换会话/令牌”**：`wx.login()` 返回 `code`，由服务端换 `openid/session_key`；我们用 Auth V0 的授权码 + PKCE 走同构路径。
- **平台托管能力需要权限模型**：
  - 小程序：能力由平台审核/权限系统控制（以及云开发的权限规则/环境隔离）
  - 我们：用 `scopes`（例如 `storage:rw`）+ 可撤销 + 审计/限流作为最小可控方案
- **本地存储 vs 云端存储区分**：
  - 小程序有 `wx.setStorage`（本地）与 `wx.cloud`（云端）
  - 我们保持 `gemigo.storage`（本地/宿主）+ `gemigo.cloud`（托管）

#### 9.1.2 小程序云开发的能力拆分（对我们是很好的参照）

微信云开发（CloudBase / TCB）在产品层面把“后端”拆成三块：

- **Cloud Database**：结构化数据（集合/文档），带查询与权限规则
- **Cloud Storage**：文件对象（上传/下载）
- **Cloud Functions**：可信执行环境（服务端逻辑/三方 API）

对照到我们的路线图：

- V0：先做 `cloud.kv`（最小“跨设备可恢复数据”），不承诺复杂查询
- V0.1：`cloud.functions.call`（让“密钥/跨域/敏感逻辑”上云）
- V1：`cloud.db`（集合/文档 + rules）与 `cloud.blob`（R2）

#### 9.1.3 小程序的安全模型（我们需要“同等可控”，但实现方式不同）

小程序把“客户端不可控”当作默认前提，因此：

- 关键能力都必须在平台可审计/可封禁
- 云开发通常配合“权限规则（rules）”限制数据访问（按用户/角色/字段）

我们的 V0 不做复杂 rules，但必须提供“同等可控”的基础：

- 所有托管存储请求：`access_token`（短 TTL）+ `storage:rw` scope
- 服务端强制隔离：默认 `appId + appUserId`
- 具备封禁与撤销能力（至少能撤销某 app 的某 scope）
- 具备配额与限流（防滥用、控成本）

#### 9.1.4 小程序为什么能“看起来不用管 token”

小程序环境本身就是平台托管的“受控容器”，平台可以在系统层面附带身份凭证；而我们在 Web 上必须面对跨站点与 popup/redirect 的现实，所以才需要 broker + Bearer token 的模式。

结论：我们不追求“完全无感”，追求“可预测、可恢复、可解释”。

### 9.2 Firebase（Google）

典型组合：Firebase Auth + Firestore/RTDB + Cloud Functions + Cloud Storage。

#### 9.2.1 产品心智（为什么它能做到“应用不需要后端”）

Firebase 的核心不是“给你一个数据库”，而是把 Web/App 的后端拆成一组可组合的**托管原语**，并用 SDK 把它们包装成前端开发者可直接使用的形态：

- **Auth**：前端直接登录拿到稳定的用户身份（同时支持匿名/社交登录等）
- **Data**：Firestore/RTDB 做结构化数据（带实时订阅/离线能力）
- **Rules**：服务端强制访问控制（开发者写规则而不是自己写鉴权中间件）
- **Functions**：把敏感逻辑、三方密钥、重计算移到可信环境
- **Storage**：文件对象单独能力，和数据表分离

我们要学习的是这套“最小心智 + 可控边界”，而不是一上来复刻 Firestore 的复杂查询与实时订阅。

#### 9.2.2 Auth 与数据访问的关系（我们需要对齐的关键点）

Firebase 的典型形态是：客户端拿到由平台签发的身份凭证（例如 ID token），每次访问数据都带上，服务端（或托管数据层）再用规则校验。

对应到我们：

- 我们已经有 `access_token`（短 TTL）与 `scopes`
- Storage API 只接受 `Authorization: Bearer <accessToken>`（不依赖 cookie）

#### 9.2.3 Rules（Firebase 的护城河，我们要怎么借鉴）

Firebase 之所以敢让前端直接打数据库，是因为 **Rules 是服务端强制执行** 的访问控制层。

我们 V0 不做复杂 rules，但必须具备“同等可控”的最小替代品：

- 默认隔离：`appId + appUserId`
- 最小权限：`storage:rw` scope 才允许写
- 治理能力：配额/限流/审计日志/封禁与撤销

并把 “rules” 作为 V1 的明确演进方向（而不是 V0 夹带实现导致范围失控）。

#### 9.2.4 离线与多端一致性（我们需要把坑提前标出来）

Firebase 的开发者体验很好的一部分原因是它天然考虑了：

- 多端同时写、覆盖与冲突
- 断网后的本地缓存与恢复（尤其是移动端）

我们 V0 不做实时同步，但要避免未来被“多端覆盖”逼着推倒重来，所以我建议 V0 就做：

- `etag/ifMatch`（乐观并发控制）
- `list`（前缀列举）+ `cursor`（可演进分页），避免开发者自行维护 key 索引

#### 9.2.5 计费/配额/观测（Firebase 的隐形关键）

Firebase 的底层商业逻辑是：每次读写都有成本，因此它从一开始就有清晰的 usage 口径与限制。

对应到我们（V0 必须具备）：

- 每次写入都记录 `bytes`（便于配额与计费）
- 读/写次数与耗时指标（便于限流与定位滥用）
- 按 `appId`、按 `appUserId` 两级维度做配额与治理

#### 9.2.6 我建议我们“照抄”的部分（非常具体）

- 命名心智：`gemigo.cloud.*`（与 `gemigo.storage.*` 明确区分）
- 能力拆分：`cloud.kv`（轻量数据）/ `cloud.blob`（文件）/ `cloud.functions`（计算）
- 安全主轴：凭证（token）+ 服务端强制校验（scopes/隔离/配额/审计）

#### 9.2.7 我建议我们“暂时不照抄”的部分（避免范围爆炸）

- Firestore 那种查询/索引/实时订阅（把 V0 做成“云数据库”会直接拖慢平台化进度）
- 复杂 rules DSL（V1 再引入；V0 用 scopes + 默认隔离 + 治理先兜住）
- 离线同步（V0 先用 `etag/ifMatch` 把一致性坑填平）

### 9.3 Supabase / Appwrite（开源 BaaS）

可借鉴点：

- 以 Postgres 为中心：结构化能力强
- 有 Row Level Security（RLS）做访问控制

对我们的启发：

- 如果未来要做 `cloud.db`（集合/查询），RLS 类模型是可参考的终局形态
- 但 V0 若直接做“查询型数据库”，实现/运营成本会陡增，不符合当前阶段

### 9.4 Vercel / Netlify（前端平台 + 托管数据/函数）

#### 9.4.1 为什么它们适合作为我们“产品化”的参照

Vercel/Netlify 这类平台的强项不是“数据库”，而是把能力打包成：

- 极低的接入成本（SDK/一行配置/环境变量）
- 明确的生命周期（dev / preview / prod）
- 明确的限制与观测（usage、计费、超额行为可预期）

这对我们把 `gemigo.cloud` 做成平台产品非常关键：不是“提供接口”，而是“提供可运营的托管能力”。

- 把“后端能力”包装成开发者易用的 SDK（KV/Blob/Postgres + Functions）
- 明确的配额、计费与观测（usage）

#### 9.4.2 KV / Blob / Postgres 的拆分（对我们是非常好的产品结构）

Vercel 典型把数据能力拆成多个产品（KV、Blob、Postgres），每个产品都有不同的适用场景、限制与成本。

对我们：

- V0 做 `cloud.kv`（D1）
- V1 做 `cloud.blob`（R2）
- V1/V2 再考虑 `cloud.db`（结构化查询能力，另立项目与计费模型）

这能避免把 “存储” 做成一个大杂烩 API，后续难以治理。

#### 9.4.3 预览环境（Preview）与隔离（我们迟早会需要）

Vercel 的 preview 部署使得：

- 同一份代码在 preview/prod 的数据隔离是可控且可观测的
- 配合环境变量与 project boundary，开发体验很强

对我们：未来 `appId` 可能会有 `prod/staging` 概念（或 app version），Storage 的命名空间需要提前可演进：

- V0：`appId + appUserId + key`
- V1：加入 `appEnv/appVersion`（可选字段），实现 preview 数据隔离

#### 9.4.4 Usage-first（我们必须尽早对齐）

Vercel 做得最对的一点：任何托管能力都先把 usage 打穿（否则无法治理与定价）。

对我们（V0 就要落地在服务端日志/指标里）：

- `storage_reads_total` / `storage_writes_total`
- `storage_bytes_read_total` / `storage_bytes_written_total`
- `storage_write_denied_total`（scope/配额/限流被拒绝）
- 维度：`appId`、`appUserId`、`keyPrefix`（可选）、`status`

#### 9.4.5 我建议我们“照抄”的部分（非常具体）

- 以 `gemigo.cloud` 为产品门面（而不是散落很多 `/api/*`）
- 从第一天就有配额与可观测（不是后补）
- 能力拆分清晰：KV/Blob/Functions（每个都有 scope、限制、计费口径）

- 需要从第一天就设计 usage 口径（不然无法治理）
- `cloud.functions` 的价值会很快超过 `cloud.kv`（能把“密钥/跨域”上云）

#### 9.4.6 我建议我们“暂时不照抄”的部分（但要保留演进空间）

- 把“后端”完全交给开发者写 serverless（那不符合“应用不维护后端”的目标）
- 过早引入过多存储产品线（V0 先把 `cloud.kv` 打穿，再引入 `cloud.blob`）

### 9.5 Cloudflare 自己的产品组合（与我们同栈）

资源：

- D1（SQL/SQLite）、KV（缓存/配置更适合）、R2（对象）、Durable Objects（强一致/会话态）

对我们的启发（也解释了为什么我推荐 D1）：

- D1 适合作为 V0 的真相源（审计/迁移/一致性）
- KV 适合作缓存层，而不是主存储
- DO 适合未来的强一致热路径与实时场景
- R2 适合 blob（文件/图片），不适合高频小 KV
