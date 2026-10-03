# 探索流推荐完整交付

- delivery-mode: major; flow: standard; risk: L3/L4; retrospective_state: completed
- parent-goal: 探索全屏流低成本、可替换、可关闭、可测效果的完整推荐实验已部署并生产验收。
- contract-id: explore-recommendation-2026-10-03; [合同](acceptance-contract.md)
- [设计](../../designs/2026-10-03-personalized-explore.design.md); [完整交付/证据](../../logs/2026-10-03-explore-recommendation/README.md)
- 当前阶段: 工程完成，已交付待用户体验验收；R1–R10 passed，最终并发修正与生产协议验收通过，Review no findings；retrospective_decision=no-increment，事实已回原owner。
- 生产: Explore全屏流enabled=1、percent=20、ranker=content；API bbd675ab-4793-4ce1-b7cf-b160ec1c723b，Web index-DgnKTc_a.js；所有其它排序路径保持旧链路。
- 性能: 32个真实浏览器主路径样本Worker p95=213ms、客户端p95=1708.6ms；完整异常样本保留。可选bge实调/失败回退成立但整体网络速度未通过，未选择为默认。
- 成本: 首批546件公开索引，末次报告548条向量记录，生产累计保守预算责任$0.002802，非供应商最终账单；$10/月AI原子预算，基础设施另计。
- open-required: none。真实增长样本不足，不自动推广；用户只需确认体验，无需补工程验证。主区其它WIP持续保留。
