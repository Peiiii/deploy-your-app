# OpenAI-compatible AI Gateway Worker (Phase 1: Text)

目标：为**非 GenAI 应用**提供一个 OpenAI-compatible 的 AI 后端（例如浏览器端应用、任意使用 OpenAI SDK 的项目），无需在前端暴露上游 Provider API Key。

> 说明：本 Worker 的对外 API 形态是 OpenAI-compatible（`/v1/...`）。GenAI 兼容（`/v1beta/...`）请使用 `workers/genai-proxy-worker`，建议绑定不同域名做隔离。

## 支持的接口（一期）

- `POST /v1/chat/completions`（支持 `stream: true` 的 SSE）
- `GET /v1/models`（返回最小模型列表）

## 部署

```bash
pnpm --filter deploy-your-app-openai-gateway-worker install
wrangler -c workers/openai-gateway-worker/wrangler.toml secret put UPSTREAM_API_KEY
pnpm --filter deploy-your-app-openai-gateway-worker deploy
```

### 使用 DashScope（Qwen3）

默认已在 `workers/openai-gateway-worker/wrangler.toml` 配置为：

- `TARGET_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `DEFAULT_MODEL=qwen3-max`

只需要把 `UPSTREAM_API_KEY` 设置为你的 DashScope Key 即可。

## 中国大陆访问（绑定自定义域名）

`*.workers.dev` 在中国大陆通常不可用。建议为该 Worker 绑定一个自定义域名（例如 `openai-api.gemigo.io`）。

- 配置位置：Cloudflare Dashboard → Workers & Pages → 选择 Worker → Triggers → Custom Domains
- 或使用 `wrangler.toml` 的 `routes`（见 `workers/openai-gateway-worker/wrangler.toml` 注释示例）

## 单页测试应用（可作为用户应用部署）

仓库提供了一个无依赖的单页 HTML 测试工具，可直接作为“用户应用”部署到平台用于验证该 Worker：

- `prototypes/openai-gateway-tester.html`

## 现阶段设计约束

- Phase 1 **不做任何鉴权/限流**（后续会补上用户维度与应用维度的授权与计量）。
- Worker **不会使用**客户端传来的 `Authorization` 去调用上游 Provider，永远使用 Worker 侧的 `UPSTREAM_API_KEY`。
