# 探索流推荐完整交付

- delivery-mode: major; flow: standard; risk: L3/L4; retrospective_state: pending
- parent-goal: 在探索全屏流交付低成本、可替换、可关闭、可测效果的完整推荐实验，部署并线上验收。
- contract-id: explore-recommendation-2026-10-03; [合同](acceptance-contract.md)
- [设计](../../designs/2026-10-03-personalized-explore.design.md); [输入与日志](../../logs/2026-10-03-explore-recommendation/README.md)
- 工作区: /Users/peiwang/.codex/worktrees/explore-recommendation/deploy-your-app，隔离主区其它 WIP；本任务设计已核对字节迁入，主区无本任务草稿。
- 当前阶段: 本地集成验证与实现Review通过，执行发布/生产验证。设计实测复审选择content主路径；服务/数据/流UI和运维已接通。
- 下一步: 精确提交、同步主线，部署API附加migration/secret/Worker，预建索引，再发布前端并核对生产速度/链路和远程SHA。
- open-required: R5/R6生产证据、R8发布/同步和最终R1–R10线上验收仍待关闭；OpenAI/TypeSafe 直连密钥不可用，Cloudflare AI OAuth 可用、BGE reranker 已实调成功。供应商可选，不因无可选凭据缩减推荐闭环。
