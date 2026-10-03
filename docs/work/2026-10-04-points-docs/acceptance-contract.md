# 点数与文档站整体验收

contract-id: gemigo-points-docs-20261004
parent-goal: 作者借助公开文档与 Skill/SDK 为应用接入收费；用户获得统一点数并消费、恢复权益；作者产生可核对收入并结算；有在线示例并充分验证。
scope-revision: 1
来源：[原始输入](../../logs/2026-10-04-points-docs/README.md#原始输入与约束)

| ID | Required | Status | 合同与证据 |
| --- | --- | --- | --- |
| PD-01 | true | passed | 实际 D1 跨应用共用来源/余额及权益隔离通过；生产领取20点、重复领取不增、原来源退款恢复；实付来源拒绝。真钱来源仍归 PD-04，不据此通过现金验收。 |
| PD-02 | true | passed | 生产按次购买/核销、永久解锁重复请求不二扣、30天按期授权与取消已操作；到期/重复cron/不足/停用应用/退款停止续费用实际 D1 及受控时间验证，未伪称线上等待30天。 |
| PD-03 | true | passed | 生产实际 Workers AI 调用，预留→running→granted，关窗后恢复持久化结果；迟到/已释放竞争、无结果和不确定故障用受控上游＋实际 D1 验证，故障注入不冒充生产 AI。 |
| PD-04 | true | blocked | 获准渠道的真实充值、回调/对账/退款以及第三方作者真实结算；尚缺经营主体/商户/渠道准入与经济参数，不以体验点代替 |
| PD-05 | true | passed | SDK v0.3.0 托管 UMD/ES/types 与可安装 .tgz，真实 npm URL 安装通过；App Skill/CLI Skill 已公开并用于真实示例发布；既有 Cloud/token 隔离通过。npm registry 401 未发布，不宣称 registry 可安装。 |
| PD-06 | true | passed | docs.gemigo.io 七页 HTTPS200、真实404、Markdown/Skill/SDK/示例下载、导航/搜索/复制/移动菜单通过；[截图](../../logs/2026-10-04-points-docs/artifacts/docs-live.png)。 |
| PD-07 | true | blocked | 知识示例真实登录→确认→消费→核销→刷新恢复通过；两个真实项目均已发布。最后进入创意示例时 Mac 锁屏，已请求用户解锁；第二应用的线上点击消费/刷新仍待验，不能用 D1 跨应用测试代替这项 UI 证据。 |
| PD-08 | true | passed | 实际 D1 并发20次、事务回滚、不足/越权/假价/续费/退款/服务中断通过；生产取消确认不扣、永久二购不扣、未使用提示退款并回冲权益通过；实际示例源码的超时原ID恢复回归通过。 |
| PD-09 | true | passed | 完整 pnpm check、SDK/CLI/前端/docs构建、SEO Pages runtime及实现 Review 通过；核心代码3642aa2普通推送，API56af31ea已发布，本地master与实际远程master核对0 0。最终验收记录同路径精确提交与同步；PD-07待验不被此交付项替代。 |

旧→新：部署、免费应用、SDK identity/storage 保留；只有新增 points:use 路径要求项目来源精确绑定。目标→新：所有条目保持 Required，外部支付缺口不能删减。分批只代表执行顺序。全套通过才可声明整个收费闭环完成。

证据 owner：[交付记录](../../logs/2026-10-04-points-docs/README.md#线上验收证据)与[生产快照](../../logs/2026-10-04-points-docs/artifacts/production-evidence.json)。整体保持 blocked：PD-04 与 PD-07 未通过，未缩减 Required 合同。
