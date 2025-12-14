# Worker Kit

一个轻量的 Cloudflare Workers “应用壳”，基于 Hono 提供一致的开发体验与统一规范（CORS / 错误结构 / `export default app.getWorker()`）。

## 为什么需要它

- 让不同 Worker 的入口写法一致，减少复制粘贴与“各写各的”分叉。
- 将横切能力（CORS、统一错误 envelope、后续鉴权/统计/计费中间件）集中在一处维护。

## 用法

```ts
import { createWorkerApp, errorResponse } from '@deploy-your-app/worker-kit'

type Env = { MY_KV: KVNamespace }

const app = createWorkerApp<Env>()

app.get('/health', (c) => c.json({ ok: true }))

app.get('/api/:id', (c) => {
  const id = c.req.param('id')
  return c.json({ id })
})

app.get('/forbidden', () => errorResponse(403, 'Forbidden'))

export default app.getWorker()
```

## 默认行为

- 默认启用 CORS（`origin: *`），并允许 `Content-Type` / `Authorization` / `x-goog-api-key`。
- 默认 `404`/`500` 返回统一 JSON 错误结构：

```json
{ "error": { "code": 404, "message": "Not Found", "status": "ERROR" } }
```

## 可配置项

- `createWorkerApp({ cors: false })`：关闭默认 CORS
- `createWorkerApp({ cors: { origin: 'https://example.com' } })`：自定义 CORS
- `createWorkerApp({ middleware: [...] })`：注入自定义中间件
- `createWorkerApp({ onError, notFound })`：覆盖默认错误响应

