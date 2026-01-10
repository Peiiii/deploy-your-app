# App SDK 登录（V0 推荐落地方案）：授权码 + PKCE + Token Broker

目标：让使用 App SDK 的应用（vibe coding 生成的网站也包含在内）能可靠识别“当前用户是谁”，并为后续“托管存储/托管计算”打下安全基础。

---

## 约束（由现状决定，不建议硬抗）

- App 运行域名：优先 A（独立打开）`https://<slug>.gemigo.app`；B（iframe）也必须支持
- 平台 API 必须在 `gemigo.io` 子域名下（例如 `https://api.gemigo.io`）
- 结论：**对浏览器而言，`gemigo.app` ↔ `gemigo.io` 是跨站点（cross-site）**  
  这会导致：在 `gemigo.app` 内用 iframe/隐藏请求去利用 `gemigo.io` 的 cookie 做“无感刷新”经常不可用（第三方 cookie/ITP 等限制）。

因此：V0 的登录/续期方案要“与浏览器现实一致”，而不是依赖脆弱的第三方 cookie。

---

## 推荐方案（结论）

采用「OAuth2.1 授权码 + PKCE」作为身份获取主干，再叠加一个 **Token Broker（令牌中介）** 来同时覆盖 A/B 两种运行形态：

- **授权码 + PKCE**：确保“拿到 code 也换不出 token”（防截获重放）+ 防 CSRF（state）
- **Token Broker**：把“需要 cookie 的动作”留在 `gemigo.io` 的 first-party 页面里做（对 A 用 popup/redirect，对 B 用父页面），App 自身只拿短期 `access_token`

核心原则：

- App 代码默认不可信 → **不给长期 refresh token 给 App**
- 默认身份为 app-scoped（类似 openid）→ 返回 `appUserId`，不默认暴露平台 userId/email

---

## V0 体验与能力边界（PM 能感知的承诺）

### A：独立子域打开（`*.gemigo.app`）

- 首次登录：会出现一个 **popup（或整页跳转）到 `gemigo.io` 的授权页面**
- 成功后：App 立刻获得短期 `access_token`，可调用平台托管能力（身份/存储等）
- 续期：当 token 过期时，**可能需要再次打开 popup 进行无感/少打扰续期**（依赖浏览器策略，V0 先以稳定为第一优先）

### B：在 `gemigo.io` 内 iframe

- 登录/授权：由父页面（`gemigo.io`）承担，iframe 通过 `postMessage` 拿 token
- 续期：父页面可相对稳定地用 first-party cookie 刷新后再 `postMessage` 给 iframe（体验更接近“无感”）

---

## 时序（高层）

### 1) 登录：App → Broker → App（A：popup；B：父页面）

1. App 调用 `sdk.auth.login({ scopes })`
2. SDK 生成：`state`、`code_verifier`、`code_challenge`
3. 打开 `https://gemigo.io/sdk/authorize?...&code_challenge=...&state=...`
4. 用户在 `gemigo.io` 完成登录 + 授权（首次）
5. 平台重定向回 App 的 `redirect_uri`：`https://<slug>.gemigo.app/sdk/callback?code=...&state=...`
6. App 侧 SDK 校验 `state`，调用 `sdk.auth.exchangeCode(code)`（携带 `code_verifier`）
7. `exchangeCode` 返回：短期 `access_token`（以及 `expires_in`）

### 2) 续期（A/B 不同）

- A（独立子域）：token 临期 → `sdk.auth.ensureValidToken()` → 打开 `https://gemigo.io/sdk/broker`（popup/redirect）→ broker 在 first-party 环境下刷新 → `postMessage` 新 token 给 App
- B（iframe）：父页面定时刷新 → `postMessage` 新 token 给 iframe

---

## 需要的平台端能力（最小集合）

### 数据表（D1，建议最小 3 张）

1. `app_consents`：用户对 app 的授权记录（可撤销）
   - `user_id, app_id, scopes, created_at, revoked_at`
2. `sdk_auth_codes`：一次性 code（短 TTL，一次性消费）
   - `code, app_id, user_id, redirect_uri, code_challenge, expires_at, consumed_at`
3. `app_users`：平台 user 与 app-scoped user 的映射（类似 openid）
   - `app_id, user_id, app_user_id`

### API/页面（`gemigo.io`）

- `GET /sdk/authorize`（HTML）：登录 + 授权页（首次弹窗）
- `POST /sdk/token`（JSON）：`code + code_verifier` → `access_token`
- `GET /sdk/broker`（HTML）：Token Broker 页面（用于 A 的续期/再次授权）

---

## token 约定（V0 建议）

- `code`：TTL 60s，一次性消费
- `access_token`：TTL 30~60min（减少 A 场景频繁弹窗）
- `scope`：V0 先固定两类
  - `identity:basic`（默认）
  - `storage:rw`（后续接入存储时使用）

---

## 风险与取舍（明确写死）

1) 在 `gemigo.app` ↔ `gemigo.io` 跨站点约束下，**A 场景很难做到“完全无感刷新”**（除非引入更复杂的浏览器特性/额外同站点域名策略）。  
V0 优先“稳定可用”而不是“极致无感”。

2) 我们避免把长期 refresh token 暴露给 App 代码，换来的是：A 场景续期需要 broker（popup/redirect）介入。

---

## 下一步（进入实现前的唯一确认问题）

V0 是否接受：**独立子域（A）在 token 续期时可能需要弹窗/跳转到 `gemigo.io` 完成续期（不保证完全无感）**？

- Yes：按本文方案开工（最稳）
- No：需要改域名策略（同站点）或引入更复杂的刷新机制（实现/维护成本会显著上升）
