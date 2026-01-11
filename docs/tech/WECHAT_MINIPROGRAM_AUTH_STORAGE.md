# 微信小程序（参考）：Auth + 存储方案

本文件用于“对标学习”：提炼微信小程序在 **身份** 与 **数据存储** 上的产品心智与安全边界，供 GemiGo App SDK 设计参考（不要求复刻实现细节）。

---

## 0) API 设计（先看这个：代表性接口）

> 说明：微信小程序 API 量非常大，这里只列与“Auth / 存储 / 云能力”强相关的核心接口形态（足够用于对标我们的 SDK 设计）。

### 0.1 Auth（客户端侧）

- `wx.login()`：返回一次性 `code`（用于服务端换取会话）
- `wx.checkSession()`：检查本地 session 是否仍有效（有效则可减少重复登录）
- （可选）`wx.getUserProfile()`：获取用户资料展示/头像昵称（不等价于“登录态”）

### 0.2 Auth（服务端侧：用 code 换会话）

> 这一步不在小程序客户端完成，典型在开发者服务端完成。

- `jscode2session`：用 `code` 换 `openid/session_key`（以及可选的 `unionid`）

### 0.3 本地存储（设备内）

- `wx.setStorage({ key, data })` / `wx.getStorage({ key })` / `wx.removeStorage({ key })` / `wx.clearStorage()`
- 同步版：`wx.setStorageSync` / `wx.getStorageSync` / `wx.removeStorageSync` / `wx.clearStorageSync`

### 0.4 云开发（托管能力：数据库/文件/函数）

> 这组 API 是“像 Firebase 一样不用自建后端”的关键入口。

- 初始化：`wx.cloud.init({ env })`
- 云数据库：
  - `wx.cloud.database()`
  - `db.collection(name)` → `add/get/doc(id).set/update/remove`
  - `where/orderBy/limit/skip`（查询能力）
- 云函数：
  - `wx.cloud.callFunction({ name, data })`
- 云存储（文件）：
  - `wx.cloud.uploadFile({ cloudPath, filePath })`
  - `wx.cloud.downloadFile({ fileID })`
  - `wx.cloud.getTempFileURL({ fileList })`

## 1) Auth（登录与身份）

### 1.1 核心心智（PM）

- 小程序把“用户是谁”作为平台能力：开发者不自建账号体系也能识别用户。
- 身份是 **app-scoped**：同一个微信用户在不同小程序里身份不同（典型：`openid`）。

### 1.2 典型流程（架构）

- 客户端：`wx.login()` → 获取一次性 `code`（短期有效）
- 开发者服务端：`code` → 调平台接口换取：
  - `openid`（小程序内用户标识）
  - `session_key`（会话密钥）
  - （可选）`unionid`（跨小程序统一标识，需要满足条件）

然后开发者服务端基于 `openid` 建立自己业务的 session/JWT，再返回给客户端使用（或直接用服务端 session）。

### 1.2.1 典型“服务端换会话”接口形态（API 设计的核心）

- 请求（概念）：
  - `GET https://api.weixin.qq.com/sns/jscode2session`
  - 参数：`appid, secret, js_code, grant_type=authorization_code`
- 响应（概念）：
  - `{ openid, session_key, unionid?, errcode?, errmsg? }`

这里最重要的对标点是：**客户端只拿临时 `code`；服务端才持有 `secret`，并签发/维护真正的登录态。**

### 1.3 关键安全点（我们应学习）

- **临时凭证换会话**：客户端只拿一次性 `code`，真正的登录态由服务端签发。
- **app-scoped identity**：默认不暴露跨应用的全局 user id。
- **平台侧可治理**：开发者能力受平台规则与审核体系约束。

### 1.4 对 GemiGo 的映射（建议）

- `wx.login()` 的 `code` ≈ `gemigo.auth.login()` 返回的授权码（我们是 OAuth2.1 + PKCE）
- `openid` ≈ `appUserId`（每个 app 一个）
- 我建议继续坚持：App 不持有长期凭证；用 scopes 做最小授权。

---

## 2) 存储（本地 vs 托管）

### 2.1 本地存储（设备内）

- `wx.setStorage` / `wx.getStorage`：轻量、设备内、离线可用
- 适合：偏好设置、草稿、临时缓存

### 2.2 托管存储（云开发体系）

云开发典型把后端拆成三块能力：

- Cloud Database：结构化数据（集合/文档 + 查询）
- Cloud Storage：文件对象
- Cloud Functions：可信执行环境（敏感逻辑/三方密钥）

### 2.3 数据隔离与权限（我们应学习）

- 默认隔离维度通常是：环境（env）/ 小程序（app）/ 用户（openid）
- “前端直连云数据”的前提是：平台提供服务端强制执行的权限规则（rules/ACL）

### 2.4 对 GemiGo 的映射（建议）

- `gemigo.storage.*` 应保持“本地/宿主存储”语义
- 托管存储建议以 `gemigo.cloud.*` 承载（对齐 `wx.cloud` 的心智）
  - V0 先做 `cloud.kv`（跨设备可恢复的轻量 KV）
  - 后续做 `cloud.blob`（文件）与 `cloud.functions`（计算）
