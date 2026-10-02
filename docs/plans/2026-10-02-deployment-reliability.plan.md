# 发布可靠性执行计划

上位：[设计](../designs/2026-10-02-deployment-reliability.design.md)，[合同](../work/2026-10-02-deployment-reliability/acceptance-contract.md) revision 1；唯一恢复入口：[current-state](../work/2026-10-02-deployment-reliability/current-state.md)。每项复用已 Review 的上位设计；出现新 owner/模型缺口先返工设计。

1. Node：receipt、GitHub/ZIP materialization、超时/有界运行、静态输出校验及错误分类（DR-03/04/06）。
2. Worker：流式 R2 源文件、D1 诊断、授权恢复和 cron、客户端状态边界（DR-01/02/03/06）。
3. Frontend/CLI：二进制上传、清晰失败、断线恢复和真实成功（DR-01/02/04）。
4. R2 provider/gateway：先完整上传，再切换版本指针；兼容旧站点（DR-05）。
5. 组装测试、适用类型/lint/build、diff-only Review；仅提交本任务，安全合并最新 master，发布 gateway→Node→Worker→frontend，私有 QA 线上链路验收和清理（DR-07）。
6. 更新合同/交付证据，复盘判定，所有 Required current passed 才关闭。
