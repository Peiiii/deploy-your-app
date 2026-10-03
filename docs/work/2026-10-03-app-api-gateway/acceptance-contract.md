# Active acceptance contract

contract-id: gemigo-app-api-gateway-20261003 / revision: 1 / scope-revision: 1
parent-goal: 应用作者保存自己的 Secrets 与连接，访客通过平台安全、可限制和撤销地消费文字/实时语音；小伴在线可用。
来源：../../logs/2026-10-03-app-api-gateway/README.md 与用户确认的设计。

| ID | Required | 可观察结果 | Status | 证据 |
| --- | --- | --- | --- | --- |
| GW-01 | true | 项目 owner 从真实设置入口保存、轮换、删除任意命名 Secret，无法回读明文 | passed | 真实设置保存/编辑反馈；API owner CRUD + SQL版本/删除/加密检查；删除QWEN中断浏览器WS。 |
| GW-02 | true | 自定义连接 URL/鉴权绑定/模型/公开或登录模式可保存、测试、复制接入示例 | passed | 真实UI保存/HTTP测试/复制完整URL；两种上游与Qwen连接已配置，运行证据。 |
| GW-03 | true | A 的 owner/运行身份不能消费 B 的 Secret/连接；URL 出站不能到内网或重定向偷取凭据 | passed | cloudflare-security-boundaries.json / cloudflare-access-quotas.json / cloudflare-private-network-probe.json；加密归属和票据项目隔离SQL检查。 |
| GW-04 | true | 自带 Key 的 OpenAI-compatible 普通/SSE 与通用声明 HTTP 操作成功；原文字代理消费者被盘点，升级不破坏既有入口 | passed | cloudflare-transport.json；两种OpenAI上游最终smoke另记；docs/tech/APP_API_CONNECTIONS.md原入口盘点。 |
| GW-05 | true | 登录用户额度、公开匿名限制、应用总额度及并发在并行调用下不超发 | passed | cloudflare-access-quotas.json及SQL17项检查。 |
| GW-06 | true | 停用/轮换/删除停止新请求并中断活动流和语音，过期/重复票据拒绝，故障占用可收敛 | passed | SSE停用中止/Secret删除WS中止/轮换ticket失效；过期租约按SQL有效时间排除，input cancel测试。 |
| GW-07 | true | 小伴完整 Qwen 五轮、打断、静音/恢复、挂断与再次开始；保留 DeepSeek 文字模式 | passed | browser-voice-gateway.json与cloudflare-realtime-gateway.json；录音样本输入，原生界面控件与重新开始、实际DeepSeek文字回复。 |
| GW-08 | true | 静态包、日志、API 响应无 Secret；加密可轮换，真实错误给出可行动提示 | passed | AES-GCM/AAD/keyring与metadata检查；真实403/429/上游错误；静态包和证据42文件无两种真实Key。 |
| GW-09 | true | 精确提交/推送、主区 master 与远程一致，迁移和服务发布回滚入口可用，GemiGo 设置及小伴线上验收 | not-run | — |
| GW-10 | true | 实际用户确认应用语音可听见；手机 iOS/Android 链路按真实设备留证，外部设备缺失明确报告 | unverified | 应用物理声音需用户确认；没有实际iOS/Android设备证据。此前仅系统样本用户确认，不替代应用。 |

不提供支付/自定义后端 runtime，为用户明确边界。不得以工作量或局部测试通过缩减 Required。主观声音与设备缺失保持未验证，不假报完成。
