# GenAI Compatibility Proxy Worker (Phase 1: Text)

目标：让使用 `@google/genai` 的项目**只改一个 URL**（`httpOptions.baseUrl`），就能把请求转发到任意上游模型提供商（Phase 1 先支持 OpenAI-compatible）。

> 提示：如果你还希望支持“非 GenAI 应用直接调用 OpenAI-compatible API（`/v1/...`）”，请使用 `workers/openai-gateway-worker`，并建议绑定不同域名做隔离。

## 使用方式（调用方只改 URL）

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  // @google/genai 必填，但本 Worker 不会使用它作为上游 Provider Key
  apiKey: 'any-string',
  httpOptions: {
    baseUrl: 'https://<your-worker>.workers.dev',
  },
});

const res = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: 'Hello!',
});
```

## 部署

```bash
pnpm --filter deploy-your-app-genai-proxy-worker install
wrangler -c workers/genai-proxy-worker/wrangler.toml secret put UPSTREAM_API_KEY
pnpm --filter deploy-your-app-genai-proxy-worker deploy
```

### 使用 DashScope（Qwen3）

默认已在 `workers/genai-proxy-worker/wrangler.toml` 配置为：

- `TARGET_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `DEFAULT_MODEL=qwen3-max`

只需要把 `UPSTREAM_API_KEY` 设置为你的 DashScope Key 即可。

## 本地验证（推荐：无需真实上游 Key）

1. 启动一个 OpenAI-compatible mock 上游：
   - `node workers/genai-proxy-worker/dev/mock-openai.js`
2. 在 `workers/genai-proxy-worker/.dev.vars.example` 基础上创建本地 `.dev.vars`（此文件已被 gitignore）：
   - `cp workers/genai-proxy-worker/.dev.vars.example workers/genai-proxy-worker/.dev.vars`
3. 启动 Worker：
   - `pnpm --filter deploy-your-app-genai-proxy-worker dev`
4. 发送一次 Google GenAI 兼容请求（`apiKey`/`x-goog-api-key` 只是占位，不会被用于上游调用）：
   - `curl -s -X POST http://127.0.0.1:8787/v1beta/models/gemini-2.0-flash:generateContent -H 'content-type: application/json' -H 'x-goog-api-key: any' -d '{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"hi\"}]}]}' | jq .`

## 中国大陆访问（绑定自定义域名）

`*.workers.dev` 在中国大陆通常不可用。建议为该 Worker 绑定一个自定义域名（例如 `genai-api.gemigo.io`），然后让所有 aistudio 项目只改 `baseUrl` 即可。

- 配置位置：Cloudflare Dashboard → Workers & Pages → 选择 Worker → Triggers → Custom Domains
- 或使用 `wrangler.toml` 的 `routes`（见 `workers/genai-proxy-worker/wrangler.toml` 注释示例）

## 单页测试应用（可作为用户应用部署）

仓库提供了一个无依赖的单页 HTML 测试工具，可直接作为“用户应用”部署到平台用于验证代理能力：

- `prototypes/genai-proxy-tester.html`

## 现阶段能力

- ✅ `generateContent`（文本）
- ✅ `streamGenerateContent`（文本流）
- ✅ `countTokens`（估算）
- ✅ 基础函数调用（非流式；流式为 best-effort）
- ❌ 图片/文件/多模态（后续扩展）

## 设计约束（为后续计费/统计留口）

- Worker **不会使用**客户端传来的 `x-goog-api-key` 去调用上游 Provider。
- 未来可以把 `x-goog-api-key` 当作 “app token”，做应用识别、统计、配额与计费（本期先不启用校验）。
