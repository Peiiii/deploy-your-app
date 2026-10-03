# 应用 API 连接的部署与恢复

用户配置和前端接入的唯一文档入口：[Secrets 与 API 连接](https://docs.gemigo.io/api-connections)。

## 平台部署与恢复

- API Worker配置 `APP_GATEWAY` Durable Object；应用内活动连接只有一个项目级 owner。
- 执行D1迁移 `workers/api/migrations/0007_app_api_gateway.sql`。该迁移只新增表和索引，既有项目、SDK与积分表不变。
- 平台Worker Secret `APP_SECRETS_KEYS` 格式为 `{"active":"v1","keys":{"v1":"<base64 of 32 random bytes>"}}`，以安全工具生成并备份，禁止写进Git。AES-256-GCM的AAD绑定projectId/Secret名称/版本。
- 轮换平台加密Key：先加入新版本且保留旧版本，再将active改为新版本。新保存的Secret用新版本加密；旧密文继续使用其记录的key_version。删除旧版本前必须迁移所有引用该版本的密文。丢失旧版本会使旧Secret无法解密；用户可重新保存上游Key恢复。
- 对外调用URL使用 `APP_GATEWAY_PUBLIC_ORIGIN`，默认平台 `AUTH_REDIRECT_BASE`（生产为`https://gemigo.io`），避免Pages反向代理把内部Worker域名交给浏览器。
- Worker启用 `global_fetch_strictly_public`，保持自定义目标的公开路由与安全规则；DNS A/AAAA校验和Cloudflare出站私网保护共同约束目标。
- 回滚先停用新连接以终止上游，再回退API Worker和前端版本。保留新增表及加密keyring，不删除用户Secret。旧全局文字代理保持既有兼容入口；新连接入口必须经过上述授权与额度。

既有消费者盘点：构建时的Google GenAI重写仍指向`genai-api.gemigo.io`，它转发到既有OpenAI网关；前端平台AI调用及已有部署继续使用原入口。本次不改这些协议和供应商配置，小伴使用独立应用连接。已有入口不是新连接的票据旁路：它不能读取或使用任意应用Secret。
