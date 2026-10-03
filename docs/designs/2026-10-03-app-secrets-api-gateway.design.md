# GemiGo 应用级 Secrets 与 API 中转方案

日期：2026-10-03。状态：讨论稿，尚未实现或发布。此次用户要求先讨论清楚能力与边界，不启动付费或产品实现。

## 有效目标与本轮修订

用户提出：每个应用管理员能配置自己的任意命名 Secrets、自定义上游 URL，通过平台代理调用；Secret 不进入前端，应用之间隔离；支持公开或要求用户登录的访问模式、限额与撤销；平台提供 OpenAI 等 AI 协议及实时语音入口，但不提供用户自定义后端代码执行。先打通能力，不做支付。

这取代前一份 `2026-10-03-realtime-voice-support.design.md` 中“平台统一提供 Key、仅对小伴启用”的推荐策略。小伴成为通用应用连接的首个验收案例；前案有关音频生命周期、宿主候选和真实声音验收的事实仍可复用。平台赞助 Key 可另行设计，不是本轮默认。

推荐能力名称为“应用 API 连接”。应用管理员管理连接；访客调用连接。连接引用 Secret，不把 Secret 本身变成浏览器可调用的资源。

## 现有 owner 与缺口

- 项目设置入口：`frontend/src/features/project-settings/`。当前设置包括部署、展示、统计和云数据库，新增“API 连接”应沿此入口。
- 管理权限：`workers/api/src/controllers/projects.controller.ts` 与 `cloud-db-settings.controller.ts` 已验证登录和 `project.ownerId`。首版管理员沿用项目 owner，不暗中承诺尚未实现的团队角色。
- 运行身份：`workers/api/src/services/sdk-auth.service.ts` 已支持应用/用户 Token。应复用校验，并补真实项目绑定、连接启用与授权检查；不能把客户端自报 appId 或 scope 字符串当成完整权限。
- 文字代理：`workers/openai-gateway-worker` 与 `genai-proxy-worker` 有流式响应与协议代码。现有上游地址和 Key 是 Worker 级配置，不是应用级配置；现有 OpenAI gateway 无应用鉴权/限额。
- 应用密钥管理：此次相关源码检索未发现应用级 Secret CRUD、密文存储和版本撤销能力，需新增；平台 OAuth/部署服务的 Secrets 不可充当应用 Secret。
- 实时语音：小伴独立 Node 原型已连接 DashScope；平台还缺 WebSocket 网关与统一运行权限。

## 用户怎么用

项目 owner 打开“项目设置 → API 连接”，保存命名 Secret（例如 `MODEL_KEY`），再创建连接：名称、协议、上游 Base URL、鉴权方式及 Secret 引用、默认/允许模型、访问模式和限额。测试连接后复制平台 Endpoint 或接入示例。测试失败显示可操作原因，保存后 Secret 只显示已配置和版本，不能重新读出明文。

示例（拟议字段，非已存在 UI）：

```text
连接：english-tutor
协议：OpenAI Chat Completions
上游：https://author-selected-provider.example/v1
鉴权：Authorization: Bearer [Secret: MODEL_KEY]
访问：要求 GemiGo 登录
限额：每用户每日请求数；并发；单次输出上限；应用总限额
```

前端使用平台 Endpoint、连接名/ID 和平台访问身份；调用者无需知道上游 Key。自定义 URL 由 owner 在设置中保存。运行请求不能携带任意上游 URL、跨应用 Secret 引用或替换鉴权 Header。更换 URL 属于管理员修改连接，而不是普通访客参数。

访客首次打开应用 → 需要时登录 → 发起聊天或通话 → 网关校验身份/策略并预留额度 → 使用该连接的 Secret 调上游 → 返回 JSON、流式文本或实时音频。拒绝、等待、额度耗尽、上游错误和恢复入口由接入示例和应用明确呈现。

## 三层模型

| 层 | 内容 | 权威 owner |
| --- | --- | --- |
| Secret | 不可回读的值、名称、所属不可变 projectId、版本、状态 | 平台 Secrets 管理服务 |
| 连接 | 上游 URL、协议/操作、鉴权绑定、模型规则、Secret 引用、启用状态 | 平台连接配置服务 |
| 运行策略 | 允许的应用身份、访问模式、额度、并发、请求/会话生命周期 | 网关授权与额度服务 |

Secret 可以任意命名和存放 token，但首版仅通过已支持连接的鉴权注入消费；不是可在前端读取的环境变量。公共配置与 Secret 分开。不可变 projectId 用于持久归属，slug/domain 只作为当前入口映射，改名不能把另一项目的 Key 带过来。

协议按操作声明能力，供应商由作者自定义：OpenAI-compatible Chat Completions、Responses、OpenAI Realtime、Qwen Realtime 是不同合同，不能因都叫 OpenAI/Realtime 就宣称自动互通。复用已支持的 GenAI 文本入口，逐项验证后公布能力。第一批建议 OpenAI-compatible 文本及 SSE、Qwen Realtime；首版的管理模型同时适用于两者。

通用 HTTP 中转可用管理员登记的方法、固定路径/路径模板和 Header Secret 绑定表达；只转发声明的操作，不执行脚本，也不允许调用者任意拼接目标主机。HMAC 签名、特殊响应改写或复杂业务编排需要独立适配，任意 Secret 不等于任意协议都已支持。

## 访问隔离、限额与撤销

- `login-required`：复用平台登录，绑定 appId/appUserId 并校验连接归属；可以可靠执行每用户额度。建议新连接默认采用此模式。
- `public`：作者主动开启公开消费，支持应用总额度、并发及匿名限流；匿名标识/IP 不当作可靠用户身份。来源与已发布域名检查只是附加防护，不能承诺“外部脚本绝对不能调用公开接口”。前端 app token 不能充当机密。
- “只有该应用能用”首先定义为 Secret/连接/Token 的应用归属隔离：A 的身份不能选择 B 的连接或 Secret。合法访客能复制自己有权限的请求，这与秘密值泄露不同；需要强限制时用登录、用户授权和额度。
- 首版不做支付，采用作者自带 Key，上游费用由该 Key 的账户承担；平台转发资源仍需总限制。用户额度按可稳定执行的请求数、并发、会话时长与输出上限设置；供应商 token 用量有则记录，没有则不虚构精确金额。
- HTTP 在调用前原子预留额度并限制输出；WebSocket 申请短期单次票据和有上限的会话 lease。失败、取消和实例丢失均有明确预留结算/超时规则，不能只靠单实例内存计数实现全平台限额。
- 管理员可停用连接、替换/删除 Secret。停用后立即拒绝新请求，并撤销未使用票据；活动流/通话进入终止流程，显示停止中直到网关确认。上游已经接受的请求或已产生的费用不能追回。
- 删除 GemiGo 的绑定只停止 GemiGo 使用，不能撤销供应商账户中的 API Key。要让该 Key 全局失效，需要到上游撤销；两种操作在界面文案区分。

## 存储与中转边界

推荐先用应用级密文存储和独立连接表，主加密密钥由平台 Secret 托管，数据库不保存明文；密文绑定 projectId/Secret ID/版本，需支持主密钥版本和轮换。管理 API 不提供明文 GET，静态构建和项目 ZIP 不包含 Secret。Cloudflare Worker Secrets 本身是 Worker 级能力，不自动带来共享 Worker 下的应用隔离。

运行时仅在完成连接授权后解析该连接的 Secret；实时服务通过受保护内部调用获取短期会话所需凭据，避免获得全库读权限。日志不记录 Key、票据、Authorization 或完整配置，供应商错误与响应 Header 不直接原样暴露可能包含凭据的内容。

任意上游 URL 的范围是作者登记的公网 HTTPS/WSS API。拦截 localhost、私网、云元数据地址、危险端口和向内部地址的重定向；DNS 重绑定与 URL 解析差异必须通过实际出站实现及回归验证，不能只检查 URL 文本。已有 Node 语音宿主与构建宿主有内部权限，此项是自定义 URL 接入的必要发布门。

授权、策略与额度共用 API Worker/D1 owner；HTTP/SSE 复用现有 Worker 代理能力，WebSocket 候选为独立 Node 服务或 Worker，宿主在真实上游实验后选定。多个传输不能各自维护不同应用策略。公开协议尽量透传，应用特有的角色和交互逻辑留在小伴；不把小伴的 `app.ready` 等事件冒充供应商标准协议。

## 建议交付顺序

1. 项目设置的 Secret 与连接 CRUD、项目 owner 权限、密文与版本生命周期；新增后端 repository/service/controller、类型和迁移。无 UI 明文回读。
2. 同一连接授权、公开/登录模式、原子限额、禁用/撤销机制及受约束出站；先通过跨应用隔离与自定义 URL 验证。
3. OpenAI-compatible 文本/流式入口，接入两种不同自定义上游配置；复用旧代理代码，迁移现有公共入口须先盘点真实调用方，不能保留旁路绕过策略或突然破坏已使用应用。
4. Qwen 实时 WebSocket、票据/lease、停止与资源释放。小伴使用自己应用配置的连接，原有 DeepSeek 文字模式也通过其文字连接迁移。
5. 提供接入文档与测试按钮；验证 GemiGo 独立页面和嵌入预览，确认用户实际能听到声音，再考虑更多协议与通用 HTTP 操作。付费、套餐、自定义后端运行时另行讨论。

前四项属于完整首批能力，不把限额、撤销或小伴语音移到未承诺的“以后”。通用 HTTP 特殊操作及额外 AI 协议按明确消费者逐批支持，能力列表必须区分已实现、待实现。

## 验收与方案状态

- A 的 owner/调用 Token 无法查看、修改或消费 B 的连接；改 appId、connectionId、slug 不突破归属；改 URL 不把别的应用 Secret 发给新目标。
- 配置保存、列表、测试、构建产物、网络响应和日志不泄漏明文 Key；管理员能轮换并停用，活动流按承诺终止。
- 两个自定义 OpenAI-compatible 上游分别完成普通和 SSE 调用；错误、取消、输出上限、额度超发、断线及恢复正确。
- 公开和登录模式行为各自成立；匿名额度不伪装为“每用户”，登录额度在并发请求下不超发。
- Qwen 真实五轮通话、打断、静音恢复、浏览器音频暂停恢复、挂断与再次开始；物理可听见仍须用户确认。手机与嵌入权限沿前案验收。
- 模拟票据复用、服务发布和实例退出，确认上游连接与预留额度不会无限遗留；Secret 禁用后无新的上游调用。

本次方案审查识别的关键条件已经写入：原来平台统一 Key 方案不满足用户自带 Key；Origin 不能承担强身份认证；Worker Secrets 不等于租户隔离；自定义 URL 需要受控出站；Secret 必须有可消费的连接；实时和文字都需统一撤销与限额。以上是方案合同，不是实现验证结果。

尚待定稿：第一批具体协议操作、公开连接是否首版开放、额度具体值、加密密钥托管与轮换实现、实时出站宿主的实验结果。技术路线可讨论，当前不标记 Implementation Ready。

参考：[Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Cloudflare Secrets Store 的 Worker 集成与区别](https://developers.cloudflare.com/secrets-store/integrations/workers/)、[Qwen WebSocket 协议](https://www.alibabacloud.com/help/en/model-studio/realtime-websocket-overview)。

## 执行合同 r2：用户授权后冻结的首批实现

2026-10-04 按用户“按这个落地”启动执行。新增管理入口沿项目设置；支持 `openai-chat`（含 SSE）、`qwen-realtime` 和声明固定方法/路径的 `http`，而不是固定供应商。OpenAI Responses/Realtime 与特殊签名不冒充兼容能力。管理权限是现有 owner，访问模式 public/login；连接默认 disabled=false、login，限额有保守默认并允许 owner 在平台上限内调节。

Secret 用 AES-256-GCM 加密，AAD 为不可变 projectId/name/version；平台 Secret `APP_SECRETS_KEYS` 是带版本的 key ring，新版本用于写入，旧版本用于轮换期解密。存储不返回明文。主区无本任务草稿残留，源代码和文档在独立工作区。

预算使用 D1 单条 INSERT SELECT 原子预留 lease：每用户默认每日20次，项目每日200次，总并发4、用户并发1；最大 HTTP 时长60秒、语音300秒，JSON 输入1MiB、下行16MiB。失败请求仍计入次数，界面明确这不是供应商账单；时长与输出上限用于资源控制，不估造费用。60秒单次票据绑定来源与身份，短期 lease 到期即不占并发，撤销使 active=false。

持续连接的单一 owner 使用项目级 Durable Object（若 Cloudflare 真实 Qwen 实验通过）；它持有活动调用、计时与中止句柄，D1保留持久配额和票据。管理更新后调用同一项目对象取消相关活动请求；Secret轮换/删除同步撤销票据，不另建第二套权限。HTTP/SSE和WebSocket均消费同一连接和lease。HTTP客户端断开会 cancel 上游，WebSocket两端关闭互相清理；正常关闭或最长期限释放并发。

自定义出站只允许公网HTTPS，固定主机/端口443；URL解析禁止认证信息、片段、私有/保留IP、内网域名和危险路径；DNS A/AAAA 在请求前全部检查，禁止跟随重定向。Cloudflare runtime 私网阻断须以不携带客户Secret的真实网络实验验证，不能只靠字符串检查防DNS重绑定。此项不成立时返回宿主选型，不以公开发布代替。

管理与运行异常采用本功能的安全错误路径，避免既有通用handler回传stack。现有文字网关保留兼容入口并盘点调用方；新应用入口不能绕过连接授权。小伴从原型事件迁移为Qwen原生事件消费，保持音频交互，DeepSeek使用独立文字连接。

方案 Review（实现前）：对照用户范围，应用归属使用 projectId，slug仅映射入口；自定义URL仅owner可改；数据库预留原子性与DO中止owner闭合；Secret无前端读取与构建注入。跨协议保留独立合同，默认登录但支持公开限额。核心持久化、设置UI和授权设计无开放finding，可开始实现；实时出站及runtime私网行为仍是依赖实验的门，未通过不得发布相关路径。

## 运行时冻结与实现边界复审（2026-10-04）

Cloudflare真实Qwen升级101并完成5次回复，项目DO同中转已贯通；无Key的私网实验四个目标均返回Cloudflare403。宿主冻结为API Worker的项目DO，实验门已关闭。详见docs/work/2026-10-03-app-api-gateway内cloudflare-*证据。

出站显式global_fetch_strictly_public，避免同zone目标绕过公开Worker路由与安全规则（[官方语义](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public)）。公开网关地址采用APP_GATEWAY_PUBLIC_ORIGIN或AUTH_REDIRECT_BASE，管理侧只接受固定平台Origin，不能采用客户端x-forwarded-host决定权限或目标。输入的慢上传也受同一撤销/时长abort信号控制。依赖实验与新边界已按原目标复审，无开放方案finding。

迁移编号为0007，与并发主线0006积分兼容；保留主线积分Tab/SDK/调度，不复制或回退现有能力。具体接入/恢复合同位于docs/tech/APP_API_CONNECTIONS.md。通用HTTP首版固定路径、JSON输入；文字Token阈值仅适用文字，实时受时长/字节/速率上限约束。
