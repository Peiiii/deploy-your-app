# App SDK Auth V0 技术方案（含域名/路由单一真相来源）

目标：让任意接入 `@gemigo/app-sdk` 的 App（包含 vibe coding 生成的网站）可靠获得“当前用户是谁”，并为后续“托管存储/托管计算”建立可控的安全边界。

托管存储（V0）方案调研与推荐：`docs/tech/APP_SDK_STORAGE_V0_RESEARCH.md`。

---

## 1. 约束（决定了方案长什么样）

- App 运行形态都要支持：
  - A：独立打开（优先）`https://<slug>.gemigo.app`
  - B：iframe（很重要）`https://gemigo.io` 内嵌
- 平台 API 对外需要在 `gemigo.io` 体系内（同一个 eTLD+1：`gemigo.io`）
- 浏览器现实：`gemigo.app` ↔ `gemigo.io` 是跨站点（cross-site），第三方 cookie/ITP 会让“无感续期”在 A 场景不稳定

结论（架构决策）：**App 本身默认不可信，V0 不给长期登录态（refresh token）给 App；续期能力尽量留在 `gemigo.io` first-party 环境内完成。**

---

## 2. V0 方案（推荐决策）

采用「OAuth2.1 授权码 + PKCE + Token Broker」：

- App 侧：只拿短期 `access_token`（opaque token / JWT 均可，V0 先 opaque + D1）
- 平台侧：
  - `authorize` 产出一次性 `code`（短 TTL + 一次性消费）
  - `token` 用 `code + code_verifier` 换 `access_token`
  - `broker` 页面运行在 `gemigo.io`（first-party）里：登录、授权、必要时做刷新/续期，并通过 `postMessage` 把结果交回 App

安全要点（不创新但必须有）：

- `state`：防 CSRF / 防混淆回调
- PKCE：`code_challenge` / `code_verifier` 防 code 被截获重放

---

## 3. 与 cookie 的关系（为什么会“依赖 gemigo.io 下的地址”）

需要 cookie 的动作只有一个：**让用户在平台（gemigo.io）维持“已登录”状态**（用于 broker 内完成登录/授权/可能的续期）。

- 在 `gemigo.io` 页面里，cookie 是 first-party → 稳定
- 在 `gemigo.app` 页面里，cookie 对 `*.gemigo.io` 属于第三方 → 不可靠

所以：

- App（`*.gemigo.app`）调用平台能力：走 `Authorization: Bearer <access_token>`（不依赖 cookie）
- 只有 broker（`gemigo.io`）才会用 `credentials: include` 携带 cookie 去调用授权相关接口

这也是为什么看起来“依赖 `https://gemigo.io/...`”：**不是为了让 App 用 cookie，而是为了让 broker 在 first-party 环境下稳定工作。**

---

## 4. 对外域名与路由（推荐的单一真相来源）

### 4.1 结论：对外“规范入口”（canonical）

| Host | 用途 | 归属/实现 | 备注 |
|---|---|---|---|
| `gemigo.io` | 平台 Web（含 broker UI） | Pages/静态站点 | broker 建议固定在 `https://gemigo.io/sdk/broker` |
| `api.gemigo.io` | 平台 API（含 App SDK Auth） | `workers/api`（Cloudflare Worker） | **规划 canonical API（尚未启用）**：`https://api.gemigo.io/api/v1`（现阶段请用 `https://gemigo.io/api/v1`，见 4.3） |
| `backend.gemigo.io` | Node 部署服务（内部/半内部） | `server`（Aliyun Docker） | Worker 通过 `DEPLOY_SERVICE_BASE_URL` 回源 |
| `openai-api.gemigo.io` | OpenAI-compatible 网关 | `workers/openai-gateway-worker` | 仅暴露允许的 `/v1/*` |
| `genai-api.gemigo.io` | GenAI 兼容网关 | `workers/genai-proxy-worker` | 仅暴露允许的 `/v1beta/*` |
| `builderapi.gemigo.io` | 构建/部署相关 Node API（历史/兼容） | 视部署而定 | 若继续使用，建议最终并入 `backend.gemigo.io` 或明确用途 |
| `staging.gemigo.io` | 预发环境（可选） | 视部署而定 | 仅用于测试/灰度 |
| `gemigo.app` | App 根域 | R2/Worker 网关体系 | 见 `workers/r2-gateway` |
| `*.gemigo.app` | 单个 App 子域 | `workers/r2-gateway`（Cloudflare Worker） | `https://<slug>.gemigo.app` |

### 4.3 现状（线上现在实际可用的入口）

目前线上“可用且已部署”的入口是：

- 平台 Web / broker：`https://gemigo.io/sdk/broker`
- 平台 API（含 SDK Auth）：`https://gemigo.io/api/v1/*`（通过 Pages 的 `frontend/public/_worker.js` 反代到后端/Worker）

而 `api.gemigo.io` 目前未完成绑定（DNS/Worker custom domain），所以**现阶段不要依赖 `https://api.gemigo.io`**。

迁移建议（不影响现网）：后续一旦把 API Worker 绑定到 `api.gemigo.io`，可以继续保留 `https://gemigo.io/api/v1` 作为兼容别名（仍由 `_worker.js` 反代）。

### 4.2 Auth V0 的 API 路由（挂在 `api.gemigo.io`）

所有路径均以 `/api/v1` 为前缀：

- `POST /api/v1/sdk/authorize` → 返回 `{ code, expiresIn }`
- `POST /api/v1/sdk/token` → 返回 `{ accessToken, expiresIn, appId, appUserId, scopes }`
- `GET /api/v1/sdk/me` → Bearer token 校验后返回身份信息

---

## 5. 单一真相来源如何持续维护（我推荐的“工程化保证”）

把“哪些服务挂在哪个 `*.gemigo.io`”当成平台契约（contract），用 3 层机制保证不会腐烂：

1) **文档单点**：本文件的 4.1 表格是对外域名/职责的唯一入口（改域名先改这里）。
2) **自动校验**：提供脚本扫描仓库里出现的 `*.gemigo.io`/`*.gemigo.app`，若出现未登记域名则 CI/本地检查失败（防止“偷偷加域名”）。
3) **责任人/评审**：为该文件与相关路由配置设置 CODEOWNERS（可选，但强烈建议），任何改动必须由平台 owner review。

> 这三点里，只有“自动校验”能真正阻止后续变更把单一真相来源弄脏；没有自动化，文档必然过期。
