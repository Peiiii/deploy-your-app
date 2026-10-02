# 前端体验执行计划

[设计](../designs/2026-10-02-frontend-experience.design.md) · [合同 frontend-experience-20261002 rev1](../work/2026-10-02-frontend-experience/acceptance-contract.md) · [唯一恢复入口](../work/2026-10-02-frontend-experience/current-state.md)

整体目标和边界沿合同；没有阶段切片式范围排除。一个交付阶段按以下依赖顺序执行。

1. 视觉/应用壳 owner：index.css、App、Header、Sidebar、PageLayout；输入设计 A；输出一致 token/导航/页面结构和 dialog/skeleton；采用上位设计，渲染桌面/移动亮暗并定向类型检查。
2. 页面/状态/加载 owner：各 feature/store/manager、routes；输入设计 B/C与1的展示组件；输出真正加载/空/失败恢复、卡片、按需代码、按需帮助；逐核心链路验证，修改运行链路/type需typecheck。若发现新状态模型，先回设计更新 B，不能以局部补丁掩盖。
3. 集成与交付 owner：Validation → Review → Delivery → Retrospective；完整UX矩阵和生产性能、打开截图质量循环，findings清零后精确提交推送前端部署/线上验收，记录有效证据。继续所有未闭合项直到整体合同成立。

Review：每部分完成定向证据，整体做 diff findings-first；项目无现成维护性脚本，不新造检查工具充数。中断从 current-state 恢复，不重复外部动作，原有WIP不归本任务。
