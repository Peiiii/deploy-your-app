# AI Gateway（统一 AI 后端）全面分析与一期方案

> 视角：产品经理（增长/体验/成本） + 架构师（可维护性/可演进性/安全）。
>
> 背景：我们已实现 `@google/genai` 兼容层（`/v1beta/...`），并希望进一步支持“非 GenAI 应用直接调用我们的 AI 后端”（而不是只能走 proxy 形态）。

---

## 1. 我们到底在做什么（产品定义）

**AI Gateway**：一个稳定、可控、可计量的 AI 入口层。

- 对调用方：提供“尽可能通用”的 API（优先 OpenAI-compatible）以及“GenAI 兼容 API”（满足 aistudio / `@google/genai` 只改 URL 的需求）。
- 对平台：隐藏上游 Provider 的差异，集中做鉴权、限流、观测、成本控制、策略（模型映射/降级）、统计与计费。
- 对长期：把“调用模型”从“应用代码”中解耦，未来更换 Provider、加速、做混合路由都不需要用户改代码。

---

## 2. 目标用户与场景（优先级）

### A. 平台内应用（你们托管/部署的用户应用）
**目标**：让任何前端应用都能安全地调用 AI（在浏览器环境也能跑），避免用户自己配置 Key。

- 典型：Gemigo 平台上的应用（R2/自定义域名提供静态页面）。
- 诉求：零配置、可控成本、可做统计/计费、可风控。

### B. 外部/第三方应用（非平台托管）
**目标**：提供一个可用的“通用 AI 后端”，让开发者/团队能快速集成。

- 诉求：OpenAI-compatible（生态最大），且对国内可用（自定义域名 + 国内可访问的上游）。

### C. GenAI 固定 SDK 应用（aistudio / `@google/genai`）
**目标**：只改 `baseUrl` 就能跑（兼容 `@google/genai` 的路径与返回形态）。

- 诉求：最大兼容、尽量不需要改业务逻辑。
- 现实约束：一期只做文本，多模态/文件等后续再扩。

---

## 3. “直接调用”为什么值得做（产品收益）

- **降低门槛**：大量前端/全栈模板默认用 OpenAI SDK/格式，直接兼容意味着“复制粘贴就能用”。
- **减少平台耦合**：不要求必须使用 `@google/genai`；也不要求一定是 aistudio 项目。
- **为 Network/CORS 兜底**：浏览器端跨域与上游复杂鉴权，交给 Gateway 统一解决。
- **成本可控**：统一入口才能做限流、额度、审计与计费闭环。

---

## 4. 风险与必须前置的约束（不做会出大问题）

### 4.1 安全与滥用（必须）
如果“任何人无 token 可调用”，Worker 会变成公共免费接口：

- 盗刷/爆量：成本失控，甚至被封。
- 内容风险：生成违规内容、做钓鱼/垃圾输出。
- 资源攻击：超大输入、长流式连接、并发占满。

**结论**：哪怕一期不做“账号系统”，也至少要有 **App Token**（或 allowlist）+ 限流。

### 4.2 隐私与合规（尽量早明确）
- 数据留存策略：是否记录 prompt/response？默认建议 **不记录全文**，仅记录计量字段（token、延迟、模型、状态码、projectId/appId）。
- PII：如果要排障，建议提供“可选采样 + 明示开关 + 脱敏”。

### 4.3 生态兼容性（不要高估“一次做全”）
OpenAI API 生态很大，但一期建议聚焦：

- `POST /v1/chat/completions`（含 SSE streaming）
- （可选）`GET /v1/models`（返回一个最小列表，便于 SDK 初始化）

其它如 embeddings、images、audio、files、responses API、tools streaming 细节，二期再扩。

---

## 5. 一期推荐架构：一个 Gateway，两个“外观 API”

### 5.1 外观 API（对外契约）

1) **GenAI 兼容（已做基础）**
- `POST /v1beta/models/:model:generateContent`
- `POST /v1beta/models/:model:streamGenerateContent`
- `POST /v1beta/models/:model:countTokens`

2) **OpenAI-compatible（建议新增）**
- `POST /v1/chat/completions`
- （可选）`GET /v1/models`

### 5.2 内部结构（可维护性关键）

建议把“协议适配”和“上游适配”分开：

- **Protocol adapters（协议适配）**
  - `genai -> canonical`
  - `openai -> canonical`（多数情况下可近似 pass-through）
- **Provider adapters（上游适配）**
  - `canonical -> dashscope(openai-compatible)`
  - 未来可新增 `anthropic` / `gemini` / `deepseek` 等

> 这样做的价值：未来增加一个“新对外协议”或“新上游 provider”，只需补一侧 adapter，不会指数级爆炸。

---

## 6. 鉴权/计费/统计：App Token 模型（一期可落地）

### 6.1 核心原则
- **客户端不再携带上游 Provider Key**（避免泄露、避免用户配置复杂）。
- Worker 仅使用 `UPSTREAM_API_KEY` 调用 DashScope 等上游。
- 客户端 token 只用于“识别应用/项目 + 风控/计费”，不用于上游鉴权。

### 6.2 Token 入口（兼容两种生态）
- 对 GenAI：沿用 `x-goog-api-key: <appToken>`（SDK 强制要填 key，这里拿来做 appToken 最自然）
- 对 OpenAI：使用 `Authorization: Bearer <appToken>`

### 6.3 token 形态建议
一期最简单、可控、可维护：
- `APP_TOKENS=tokenA,tokenB`（环境变量 allowlist）
- 或 `APP_TOKEN=<single-token>`（单租户/内部测试）

二期演进（更产品化）：
- token 绑定 `projectId/appId`，并可撤销/轮换
- token 可做 JWT（包含 `projectId`、`plan`、`exp`），Worker 本地校验即可（不每次查库）

---

## 7. 成本控制与可靠性（一期就该加的“护栏”）

- **请求体大小限制**（如 1–2MB）：防止大 payload 撑爆 Worker。
- **最大输出 token / 超时**：避免长输出/长连接占资源。
- **并发/速率限制**：至少按 token 或 IP 做基本限制；更理想按 appToken 限流。
- **模型白名单/映射**：外部传来的 `model` 统一映射到允许的上游模型（例如默认 `qwen3-max`）。
- **可观测性**：每次请求生成 `requestId`，返回给客户端并写日志（方便排障与计量）。

---

## 8. API 设计细节建议（避免未来返工）

### 8.1 路径结构（建议预留 projectId）
为了未来天然支持“按项目计费/统计”，建议支持：

- `POST /api/:projectId/v1/chat/completions`
- `POST /api/:projectId/v1beta/models/:model:generateContent`

并保持无前缀版本仍可用（兼容现有 aistudio 只改 baseUrl 的方式）：

- `POST /v1/chat/completions`
- `POST /v1beta/...`

### 8.2 CORS 策略
如果走 token 鉴权，允许 `Access-Control-Allow-Origin: *` 是可以接受的（不带 cookies）。
如果未来想走 cookie/session，需要收紧到白名单 origin，并处理 `credentials`。

### 8.3 错误体统一
建议对外都返回稳定 JSON 错误结构（含 `code`、`message`、`requestId`），并保持与 OpenAI/GenAI 的最小兼容。

---

## 9. 中国大陆可用性（落地要点）

- `*.workers.dev` 大概率不可用 → **必须绑定自定义域名**。
- 上游选用 DashScope 等国内可访问的 OpenAI-compatible endpoint。
- 如要更稳：考虑在 Worker 前加一层域名/线路优化（后续再看）。

### 9.1 为什么建议 GenAI 与 OpenAI 使用不同域名隔离

推荐把两套入口放在不同子域名上，例如：

- GenAI：`https://genai-api.gemigo.io`（仅暴露 `/v1beta/...`）
- OpenAI：`https://openai-api.gemigo.io`（仅暴露 `/v1/...`）

好处：

- **避免未来 API 冲突**：两套协议都可能发展出更多路径与版本，域名隔离比路径隔离更稳。
- **安全策略可拆分**：未来 GenAI 可能要兼容“只改 URL”的匿名流量；OpenAI 可能必须登录/强鉴权，分域名更易配不同的 WAF/限流/监控策略。
- **运维更清晰**：指标、日志、告警、路由配置天然分开，出问题更容易定位。

---

## 10. 推荐的一期落地范围（最小闭环）

### P0（现在就能做）
- 继续保留 `/v1beta/...`（GenAI 兼容，文本 + 流式）
- 新增 `/v1/chat/completions`（OpenAI-compatible 入口）
- 增加可选 token 校验（allowlist），并加基础限流/大小限制
- 输出 `requestId` + 基础日志字段（模型、token估算、耗时、状态）

### P1（当你开始考虑“平台化/商业化”）
- 项目级 token（可撤销/轮换）
- 计量落库（D1/KV/队列），做 usage dashboard
- 免费额度 + 超额策略（降级模型/拒绝）

---

## 11. 命名与仓库组织建议

当前目录叫 `genai-proxy-worker`，长期如果同时提供 OpenAI API，建议产品名改为：

- Worker 名称：`ai-gateway-worker` / `ai-gateway`
- 对外文档：AI Gateway（包含 GenAI compatibility + OpenAI-compatible）

但不建议为了“改名”立刻大改目录；可以等二期稳定后再迁移（避免 churn）。
