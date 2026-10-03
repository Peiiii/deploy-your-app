# 应用 API 连接的部署与恢复

用户配置和前端接入的唯一文档入口：[Secrets 与 API 连接](https://docs.gemigo.io/api-connections)。

## 平台部署与恢复

- API Worker配置 `APP_GATEWAY` Durable Object；应用内活动连接只有一个项目级 owner。
- 执行D1迁移 `workers/api/migrations/0007_app_api_gateway.sql`。该迁移只新增表和索引，既有项目、SDK与积分表不变。
- 平台Worker Secret `APP_SECRETS_KEYS` 格式为 `{"active":"v1","keys":{"v1":"<base64 of 32 random bytes>"}}`，以安全工具生成并备份，禁止写进Git。AES-256-GCM的AAD绑定projectId/Secret名称/版本。
- 轮换平台加密Key：先加入新版本且保留旧版本，再将active改为新版本。新保存的Secret用新版本加密；旧密文继续使用其记录的key_version。删除旧版本前必须迁移所有引用该版本的密文。丢失旧版本会使旧Secret无法解密；用户可重新保存上游Key恢复。
- 对外调用URL使用 `APP_GATEWAY_PUBLIC_ORIGIN`，默认平台 `AUTH_REDIRECT_BASE`（生产为`https://gemigo.io`），避免Pages反向代理把内部Worker域名交给浏览器。
- Worker启用 `global_fetch_strictly_public`，保持自定义目标的公开路由与安全规则；DNS A/AAAA校验和Cloudflare出站私网保护共同约束目标。
- 新增 Durable Object 的首次迁移后，Cloudflare 不允许直接回滚到迁移之前的 Worker 版本。恢复时先停用新连接终止活动请求，再部署保留 AppGateway 类、绑定与迁移记录的恢复包，让新入口返回 503；前端可退回上一版本。保留 D1 表、用户密文和加密 keyring。恢复包须提前构建、冻结、验证，不能把未验证的旧版本回滚当作恢复步骤。[Cloudflare 回滚限制](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。同一 DO 生命周期内的后续版本可按平台限制回滚。
- 删除应用会在项目级 DO 中终止活动请求、原子清除该应用的 Secrets、连接和票据，再删除项目；删除后的 DO 记录拒绝迟到调用。旧全局文字代理保持既有兼容入口；新连接入口必须经过上述授权与额度。

既有消费者盘点：构建时的Google GenAI重写仍指向`genai-api.gemigo.io`，它转发到既有OpenAI网关；前端平台AI调用及已有部署继续使用原入口。本次不改这些协议和供应商配置，小伴使用独立应用连接。已有入口不是新连接的票据旁路：它不能读取或使用任意应用Secret。
