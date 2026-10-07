# 静态发布执行计划

采用[设计](../designs/2026-10-07-static-publication.design.md)及[GEMIGO-STATIC-20261007合同](../work/2026-10-07-static-publication/acceptance-contract.md)，恢复owner为同目录status.md。

1. Worker归档/静态发布/原API状态与R2删除，复用上位设计；验证SP-01～06，实际workerd测试流式与alarm/恢复，定向回归和完整类型/lint/Review。
2. 精确提交普通推送主线，保护既有无关WIP并快进主master；部署Worker，停止原builder验证SP-07，保留安全回退与数据。
3. 按上位迁移设计及闲鱼已有单活SOP准备/切换Docker-fupf，验证SP-08～09；事实/SOP/heartbeat更新，两仓库分别推送。
4. 复盘原owner文档、复查有效合同和实际线上/主线一致性，所有Required通过才结束。

每部分有失败返回其最近owner，不停止仍可独立完成的工作。新事实改变输入兼容、状态或机器认证时更新同一设计，不把缺口移到后续。
