# App SDK 登录（V0）：临时码 → 服务端换会话/令牌

目标：让使用 App SDK 的应用（包含 vibe coding 生成的网站）能“知道用户是谁”，同时尽量不让不可信的 App 代码持有长期登录态。

> 推荐落地版本（考虑 `gemigo.app` ↔ `gemigo.io` 跨站点约束、同时支持 A 独立子域 + B iframe）：见 `docs/thoughts/APP_SDK_AUTH_V0_RECOMMENDED.md`。

---

## 我的建议：采用「OAuth2.1 授权码 + PKCE」的变体（小程序同构）

一句话：**App 只拿一次性的 `code`；真正的登录态（短期 `access_token` + 可刷新能力）由平台服务端签发**。

这对应小程序的经典路径：

- 小程序：`wx.login()` → `code` → 服务端换 `openid/session_key`
- 我们：`sdk.auth.login()` → `code` → `sdk.auth.exchangeCode(code)` 换 `access_token`

区别在于：Web 环境需要额外处理重放、跨域、第三方 cookie 等问题，因此引入 PKCE 与“同站点（same-site）”的部署约束。

---

## 为什么推荐这个方案（PM + 架构师视角的共同结论）

### 1) 安全边界：App 代码默认不可信
vibe coding 生成的网站代码不可控（可能被篡改/注入/恶意），如果给它长期 token（或可无限刷新 token），等价于把用户账号交给 App。

授权码 + PKCE 的好处是：

- `code` **一次性、短 TTL、可绑定上下文（appId、redirectUri、code_challenge）**
- `access_token` **短 TTL**（例如 5~15 分钟），泄露窗口小
- 刷新能力尽量放在平台侧（更可撤销、更可审计）

### 2) 对开发者体验友好：心智和 OAuth/小程序一致
开发者（尤其做过小程序/网页 OAuth）对“临时码换会话”非常熟悉；SDK 只暴露 2 个核心能力即可完成闭环：

- `sdk.auth.login()`：拿到 `code`（可能是跳转/弹窗/iframe 通道）
- `sdk.auth.exchangeCode(code)`：换取 `access_token`（并建立可刷新状态）

### 3) 便于平台化：可做授权弹窗、scope、撤销、审计
你们未来想做“产品社区平台”，就必须具备：授权、撤销、风控、封禁、追溯。授权码模式天然是为“平台化授权”设计的。

---

## 关键约束：必须让“刷新”发生在同站点（same-site）里

这是 Web 和小程序最大的不同：**跨站点 cookie 在很多浏览器/场景下会被限制**。

因此 V0 我建议明确一个工程原则（不创新、反而更稳）：

- **API 域名与 App 域名应处于同一个 eTLD+1**（同站点），例如都在 `gemigo.app` 下  
  - App：`https://<slug>.gemigo.app`
  - API：`https://api.gemigo.app`

这样你们可以安全地用：

- `httpOnly` cookie 存放刷新态（或 session）  
- `access_token` 只在内存/短暂存储中使用

如果 API 和 App 分属不同站点（例如 App 在 `gemigo.app`、API 在 `gemigo.io`），那么“无感刷新”会变得不可靠，工程复杂度会显著上升（需要额外的 broker 页面、postMessage、重新登录等策略）。

---

## 推荐的 V0 流程（标准化步骤）

### A. login（获取授权码）

1. `sdk.auth.login()` 生成：
   - `state`（随机）
   - `code_verifier`（随机）
   - `code_challenge = SHA256(code_verifier)`（PKCE）
2. SDK 打开平台授权页（跳转/弹窗均可）：
   - `GET /sdk/authorize?app_id=...&redirect_uri=...&scope=...&state=...&code_challenge=...`
3. 用户完成平台登录与授权后，平台重定向回 `redirect_uri`：
   - `redirect_uri?code=...&state=...`

### B. exchange（用 code + verifier 换 token）

4. `sdk.auth.exchangeCode(code)`：
   - `POST /sdk/token { code, code_verifier, app_id, redirect_uri }`
5. 平台返回：
   - `access_token`（短 TTL，JWT 或 opaque token）
   - `expires_in`
   - （可选）`refresh` 通过 **httpOnly cookie** 方式建立（推荐）

### C. refresh（可选但建议）

6. SDK 在 token 临期时调用：
   - `POST /sdk/refresh`（带 cookie）→ 新的 `access_token`

---

## 需要在 V0 就定死的几个“不创新”规则

- `code` 一次性使用 + 短 TTL（例如 60 秒）
- `code` 必须绑定 `app_id + redirect_uri + code_challenge`
- `access_token` 短 TTL（例如 5~15 分钟），且 `aud`/`scope` 绑定 app
- 默认只给 `app-scoped user id`（类似 openid），不要直接暴露平台 userId/email

---

## 验证标准（我们后续讨论时可用它做验收）

- 不可信 App 代码拿不到长期登录态（泄露风险可控）
- 用户授权可撤销（平台可封禁某 App）
- 同一个用户在同一个 App 下身份稳定（可做数据隔离/个性化）
- 在 `https://<slug>.gemigo.app` 独立打开时也能无感刷新（同站点前提）
