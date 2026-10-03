# 点数与文档站整体验收

contract-id: gemigo-points-docs-20261004
parent-goal: 作者借助公开文档与 Skill/SDK 为应用接入收费；用户获得统一点数并消费、恢复权益；作者产生可核对收入并结算；有在线示例并充分验证。
scope-revision: 1
来源：[原始输入](../../logs/2026-10-04-points-docs/README.md#原始输入与约束)

| ID | Required | Status | 合同与证据 |
| --- | --- | --- | --- |
| PD-01 | true | not-run | 平台钱包、明确的点数来源与消费/退款账目，跨两应用共享余额，资金及权益隔离 |
| PD-02 | true | not-run | 应用自定义按次、一次、按期；用户授权自动续费、取消、到期、余额不足和幂等 |
| PD-03 | true | not-run | 一个真实受控 AI 服务的预留、结果持久化、结算、失败释放与不确定状态恢复 |
| PD-04 | true | blocked | 获准渠道的真实充值、回调/对账/退款以及第三方作者真实结算；尚缺经营主体/商户/渠道准入与经济参数，不以体验点代替 |
| PD-05 | true | not-run | 发布可用 SDK 包/托管资源，AI 接入 Skill 能照文档接入并恢复消费；Auth/Cloud 不退化 |
| PD-06 | true | not-run | docs.gemigo.io HTTPS 文档站，开始、登录/存储、点数、示例、Skill、错误及真实边界；导航与链接有效 |
| PD-07 | true | not-run | 在线知识示例实际点击进入登录/消费确认，体验点来源清楚，权益跨刷新恢复，第二应用共用钱包 |
| PD-08 | true | not-run | 实际 D1 与 UI 验证并发/不足/重试/越权/假价格/关窗/退款/重复续费与服务中断，无负余额、无重复扣和无造现金 |
| PD-09 | true | not-run | 类型/构建及适用 Review 通过，精确提交普通推送、本地 master 同步、适用部署与线上验收 |

旧→新：部署、免费应用、SDK identity/storage 保留；只有新增 points:use 路径要求项目来源精确绑定。目标→新：所有条目保持 Required，外部支付缺口不能删减。分批只代表执行顺序。全套通过才可声明整个收费闭环完成。
