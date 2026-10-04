# Active acceptance contract

contract-id: gemigo-app-api-gateway-20261003 / revision: 5 / scope-revision: 2
parent-goal: 应用作者保存自己的 Secrets 与连接，访客通过平台安全、可限制和撤销地消费文字/实时语音；小伴在线可用。
来源：../../logs/2026-10-03-app-api-gateway/README.md 与用户确认的设计。

| ID | Required | 可观察结果 | Status | 证据 |
| --- | --- | --- | --- | --- |
| GW-01 | true | 项目 owner 从真实设置入口保存、轮换、删除任意命名 Secret，无法回读明文 | passed | 真实设置保存/编辑反馈；API owner CRUD + SQL版本/删除/加密检查；删除QWEN中断浏览器WS。 |
| GW-02 | true | 自定义连接 URL/鉴权绑定/模型/公开或登录模式可保存、测试、复制接入示例 | passed | 真实UI保存/HTTP测试/复制完整URL；两种上游与Qwen连接已配置，运行证据。 |
| GW-03 | true | A 的 owner/运行身份不能消费 B 的 Secret/连接；URL 出站不能到内网或重定向偷取凭据 | passed | cloudflare-security-boundaries.json / cloudflare-access-quotas.json / cloudflare-private-network-probe.json；加密归属和票据项目隔离SQL检查；新增发行来源/旧凭证迁移反例、authorization-api-live.json及authorization-delivery.md。 |
| GW-04 | true | 自带 Key 的 OpenAI-compatible 普通/SSE 与通用声明 HTTP 操作成功；原文字代理消费者被盘点，升级不破坏既有入口 | passed | cloudflare-transport.json；两种OpenAI上游最终smoke另记；docs/tech/APP_API_CONNECTIONS.md原入口盘点。 |
| GW-05 | true | 登录用户额度、公开匿名限制、应用总额度及并发在并行调用下不超发 | passed | cloudflare-access-quotas.json及SQL17项检查。 |
| GW-06 | true | 停用/轮换/删除停止新请求并中断活动流和语音，过期/重复票据拒绝，故障占用可收敛 | passed | SSE停用中止/Secret删除WS中止/轮换ticket失效；过期租约按SQL有效时间排除，input cancel测试。 |
| GW-07 | true | 小伴完整 Qwen 五轮、打断、静音/恢复、挂断与再次开始；保留 DeepSeek 文字模式 | passed | browser-voice-gateway.json与cloudflare-realtime-gateway.json；录音样本输入，原生界面控件与重新开始、实际DeepSeek文字回复。 |
| GW-08 | true | 静态包、日志、API 响应无 Secret；加密可轮换，真实错误给出可行动提示 | passed | AES-GCM/AAD/keyring与metadata检查；真实403/429/上游错误；静态包、文档和证据124文件及ZIP成员无两种真实Key。 |
| GW-09 | true | 精确提交/推送、主区 master 与远程一致，迁移和服务发布恢复入口可用，GemiGo 设置及小伴线上验收 | passed | production-delivery.md / production-assets.json / production-app-deployment.json / production-text-smoke.json / production-realtime.json / production-browser-voice.json；首次DO迁移用保留DO的恢复包，真实stage已验。最终主线同步另按交付记录核对。 |
| GW-10 | true | 实际用户确认应用语音可听见；手机 iOS/Android 链路按真实设备留证，外部设备缺失明确报告 | unverified | 本轮IAB真实整页授权已通过，未注入SDK token；原popup硬件未实测。应用物理声音和实际iOS/Android仍缺用户/设备证据。此前仅系统样本用户确认，不替代应用。 |

不提供支付/自定义后端 runtime，为用户明确边界。不得以工作量或局部测试通过缩减 Required。主观声音与设备缺失保持未验证，不假报完成。

revision 2 仅更新实际线上证据及恢复限制，scope-revision 保持1。线上录音样本完成10次ASR/10次回复，音频3290880字节、播放峰值0.5468、两个AudioContext运行并在挂断后关闭，WS关闭。用户尚未确认实际可听。

revision 3：授权页评审发现基础SDK发行处缺少应用来源绑定，见review.md新增P1。GW-03既有网关消费/出站证据仍有效，但不能覆盖发行处应用冒认，整体身份隔离须返工后重验；范围未缩减。

## 授权优化（用户2026-10-04批准落地）

| ID | Required | 可观察结果 | Status | 证据 |
| --- | --- | --- | --- | --- |
| AUTH-01 | true | 新短地址与旧SDK授权入口均可用，应用信息来自平台校验 | passed | authorization-api-live.json；新/旧页面200且旧页面显示核实应用，Pages路由测试。 |
| AUTH-02 | true | 中文权限说明、真实应用名称/域名/提供者、账号状态/切换、明暗主题与手机布局 | passed | artifacts/authorization-desktop.png/authorization-mobile.png/authorization-mobile-dark.png；390px无溢出，账号切换复用已核对的原auth owner。 |
| AUTH-03 | true | 所有身份发行来源绑定，旧未验证凭证不可继续消费；错误app/来源/权限/回跳拒绝 | passed | scripts/test-application-authorization.ts 实际D1与0008迁移；authorization-api-live.json来源/回跳/CSRF/一次性反例。 |
| AUTH-04 | true | 整页授权成功/取消/刷新返回，PKCE/state/TTL验证，临时URL参数清理 | passed | authorization-browser-live.json 实际取消/成功/刷新/URL清理；scripts/test-sdk-authorization.ts state/TTL/PKCE/single-flight。 |
| AUTH-05 | true | popup成功、关闭、超时反馈，auto在blocked情况下回退整页 | passed | scripts/test-sdk-authorization.ts 运行实际SDK源码覆盖popup source/origin/state/success/close/timeout/blocked auto及网络准备生命周期；原生popup设备仍未实测。 |
| AUTH-06 | true | SDK公开接口、示例与文档贯通，原SDK入口兼容 | passed | SDK0.3.1 build/types/文档站tarball与小伴依赖；旧SDK页面/API仍兼容，0.3.0逐字保留。 |
| AUTH-07 | true | 全套适用检查/Review/提交同步/发布/实际小伴返回与工程对话验收 | passed | authorization-delivery.md / authorization-app-deployment.json / authorization-browser-live.json；平台/API/docs/SDK/小伴已上线，实际登录返回与文字/语音响应通过，最终Git同步另复核。 |

设计与Review见../../designs/2026-10-04-application-authorization.design.md；公开身份变更会要求旧SDK会话重新登录，数据、积分和上游Key不动。

revision 5：scope-revision2授权优化已发布并走通实际小伴整页返回。GW-03新发行/迁移证据恢复passed，AUTH-01..07按各自证据层级passed；未把SDK mock或尺寸模拟冒充原生popup/真实手机。GW-10物理用户验收不变。
