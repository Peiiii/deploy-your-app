# Vercel（参考）：Auth + 存储方案

本文件用于“对标学习”：提炼 Vercel 在“前端平台 + 托管能力”模式下，身份与存储的产品化方式，供 GemiGo App SDK 设计参考。

---

## 0) API 设计（先看这个：代表性接口）

> 说明：Vercel 平台本身不提供统一 Auth SDK；但它提供/整合了一组“托管原语”（KV/Blob/Postgres 等）可被应用代码直接调用。下面列的是最常见的“应用侧 API 面”。

### 0.1 Auth（常见落地方式：不是 Vercel 自带）

典型是应用自己集成 OAuth/OIDC，并在 Serverless/Edge 中承载回调与会话：

- Next.js Route Handlers / API Routes（概念形态）：
  - `GET/POST /api/auth/*`（登录回调、登出、session）
- 常见库（示例心智）：
  - Auth.js/NextAuth：`signIn()` / `signOut()` / `getServerSession()`（或 `auth()`）

对标要点：Vercel 代表的是“平台不强绑定身份”，而是给你运行环境与密钥管理，让你自己拼装 Auth。

### 0.2 KV（状态/缓存/会话类）

- 典型 SDK（示例 API 面）：
  - `kv.get(key)`
  - `kv.set(key, value, { ex? | px? })`
  - `kv.del(key)`
  - `kv.incr(key)`
  - 哈希/集合/有序集合：`hset/hgetall`、`sadd/smembers`、`zadd/zrange` 等

### 0.3 Blob（文件对象）

- 典型 SDK（示例 API 面）：
  - `put(path, data, { access?, contentType? })`
  - `head(urlOrPath)` / `del(urlOrPath)`
  - `list({ prefix?, limit?, cursor? })`

### 0.4 Postgres（结构化数据）

- 典型 SDK（示例 API 面）：
  - `sql\`SELECT ...\``
  - `sql\`INSERT ...\``

## 1) Auth（登录与身份）

### 1.1 关键事实（PM）

- Vercel 本身不是身份提供方；它提供的是部署/运行平台。
- 实际项目通常通过第三方/开源方案完成 Auth（例如 OAuth/OIDC、Auth.js/NextAuth 一类）。

### 1.2 典型落地形态（架构）

- 在应用侧（或平台侧）实现：
  - OAuth 登录回调
  - session cookie / JWT（以及刷新策略）
- 与平台的结合点更多在：
  - 环境变量与密钥管理
  - Edge/Serverless Functions 承载登录回调与鉴权

### 1.3 对 GemiGo 的启发（建议）

- 我们要提供的不是“让开发者自己在 Functions 里写 Auth”，而是直接提供 `gemigo.auth.*` 的平台身份能力（更接近 Firebase/小程序，而不是 Vercel）。

---

## 2) 存储（按产品拆分）

### 2.1 典型产品拆分（PM）

- KV（低门槛状态/缓存/会话）
- Blob（文件对象）
- Postgres（结构化数据）

这种拆分让开发者“按场景选能力”，也让平台可以清晰做配额、观测与计费。

### 2.2 Preview / 环境隔离（架构）

Vercel 的强项之一是 preview 环境：

- 每个 preview 都能有独立配置/域名
- 数据/资源是否隔离取决于产品与工程约束，但“环境心智”非常强

### 2.3 对 GemiGo 的映射（建议）

- 我建议我们把 `gemigo.cloud` 作为产品门面，并沿用同样的能力拆分：
  - V0：`cloud.kv`（轻量跨设备数据）
  - V1：`cloud.blob`（文件）
  - V1/V2：`cloud.db`（结构化/查询，需单独立项与计费模型）
- 从第一天就把 usage 口径设计好（否则后续无法治理/定价）。
