# 应用 Secrets 与 API 中转执行计划

上位设计：../designs/2026-10-03-app-secrets-api-gateway.design.md。active contract: gemigo-app-api-gateway-20261003 revision 1。
恢复：../work/2026-10-03-app-api-gateway/current-state.md。一个交付阶段，以下是依赖顺序而非范围缩减。

1. 基础设施预验并补上位设计的实现合同和 design Review。核实真实 Qwen/Cloudflare 可行性；有未知先调查。
2. API Secret、连接与额度持久化，复用 owner 和 SDK 身份；安全与并发测试先形成失败基线。GW-01/02/03/05/08。
3. 文字/通用 HTTP 和 WebSocket 网关，共享策略、撤销与 lease；实测供应商和生命周期。GW-04/06/07。
4. 项目设置 UI、接入示例、文档、小伴迁移。真实 UI 链路验收和原模式回归。GW-01/02/07/10。
5. 定向类型/lint/构建、Implementation Review、提交与发布，主线同步，线上验证，复盘。GW-09。

每项复用已覆盖的上位设计；新跨 owner/协议/持久化决策在该项实现前补设计并审查。发布前不可跳过撤销/额度。宿主已由真实实验冻结为Cloudflare项目DO，结果见工作目录；运行失败按相应owner返工。后续协议扩展与支付不进入本合同。
