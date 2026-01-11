# App SDK 平台化路线图（对齐小程序：身份 + 托管存储 + 托管计算）

目标：让接入 `@gemigo/app-sdk` 的 App 在**不自建后端**的情况下，仍然能：

1) 知道用户是谁（Auth）  
2) 存数据（Storage）  
3) 跑后端逻辑/安全调用三方（Functions）

同时满足平台愿景：成为产品社区（身份可追溯、数据可沉淀、能力可授权/可撤销、可审计/风控）。

终态架构（Auth + DB + Blob + Functions + Rules + sharding）：`docs/tech/GEMIGO_CLOUD_END_STATE_ARCHITECTURE.md`。

---

## 0. 我推荐的总体决策（PM + 架构）

- V0 先做“平台三件套”的最小闭环：`auth` → `storage` → `functions`。
- 安全边界默认：App 代码不可信 → **不给长期登录态**，所有能力都必须通过 scopes 进行最小授权。
- 兼容运行形态：A 独立子域（`*.gemigo.app`）优先，B iframe（`gemigo.io` 内嵌）同等重要。

---

## 1. 现状（已落地）

### 1.1 Auth V0（已实现并可本地验证）

- 方案：授权码 + PKCE + broker（popup/redirect）+ D1（opaque token）
- 文档（单一真相来源 + 域名/路由/现状）：`docs/tech/APP_SDK_AUTH_V0_TECH_SPEC.md`
- 迭代日志：`docs/logs/2026-01-10-app-sdk-auth-v0/README.md`

---

## 2. 下一步（V0 必做）：托管存储 Storage

方案调研与推荐（实现前必读）：`docs/tech/APP_SDK_STORAGE_V0_RESEARCH.md`。

### 2.1 目标（对齐小程序云开发的“第一生产力”）

让开发者不写后端也能完成：

- 用户偏好、草稿、配置
- App 内的轻量业务数据（例如评论/收藏/笔记等的 App 私有数据）

### 2.2 我推荐的 V0 范围（最小但可用）

SDK API：

- `sdk.storage.get(key)`
- `sdk.storage.set(key, value)`
- `sdk.storage.delete(key)`
- `sdk.storage.list({ prefix?, limit?, cursor? })`（可选，若实现成本高可推迟到 V0.1）

后端能力（平台托管）：

- 数据隔离默认按 `appId + appUserId`（最小粒度，类似“每个小程序用户都有自己的空间”）
- 权限：需要 `storage:rw` scope（无授权则拒绝）
- 配额：V0 先做简单配额（按 App / 按用户），避免被滥用

存储落点（我推荐，优先可维护性）：

- D1：KV 表（`key/value/updated_at`），简单、可备份、可审计；后续可升级成更结构化的数据模型

### 2.3 验收标准（产品可感知）

- 同一个用户在同一个 App 下的数据稳定且可恢复
- 不同 App 之间严格隔离（无法互读）
- 超出配额有明确错误（非 silent fail）

---

## 3. 下一步（V0.1 / V1）：托管计算 Functions

### 3.1 目标（对齐“小程序云函数”）

让开发者把“需要密钥/需要可信环境/需要跨域”的事情交给平台：

- 调第三方 API（密钥在平台托管）
- 运行敏感逻辑（风控、校验、签名）
- 统一审计与限流

### 3.2 我推荐的 V0.1 API（先把接口定住）

- `sdk.functions.call(name, payload, { timeoutMs? })`

平台侧：

- function registry（函数注册表：谁可以部署哪些函数、scope、版本）
- 执行环境：优先用 Worker（边缘、易扩展），按 `appId` 做隔离与限流

### 3.3 安全边界

- 必须校验 `access_token`、`appId`、`scopes`
- 所有调用有审计日志（至少：appId/appUserId/functionName/耗时/状态码）

---

## 4. 与微信小程序一致、我们不必创新的部分

- “临时码 → 服务端换会话/令牌”作为登录主干（web 环境加 PKCE + broker）
- scope/授权的模型（最小授权、可撤销、可审计）
- 平台托管存储/计算作为默认能力（开发者不维护后端）

---

## 5. 里程碑建议（可按周迭代）

- M0（已完成）：Auth V0 端到端跑通（本地 + 线上 `gemigo.io/api/v1`）
- M1：Storage V0（D1 + scope + SDK API）
- M2：Functions V0.1（最小 call + registry + 审计）
