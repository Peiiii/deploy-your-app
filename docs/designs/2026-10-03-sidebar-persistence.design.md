# 侧边栏收起状态恢复

## 目标与证据

用户明确要求侧边栏收起/展开在刷新后恢复，并建议使用 Zustand。当前 `SidebarHeader` → `ui.store.actions.toggleSidebarCollapsed` → `Sidebar`/页面布局链路已经共用 Zustand，但 `sidebarCollapsed` 初始化固定为 false，未落盘。bugfix，局部 UI 偏好风险 L2；reproduce：真实 store 收起后重建断言失败（false !== true），用同一边界验证修复。

## 用户链路与方案

桌面访问首页，点击侧边栏收起按钮，侧栏变窄；刷新后仍收起。再次点击展开，刷新后仍展开。首次访问保持默认展开。状态在同一浏览器、同一站点保存，无需登录。用户入口为部署后的 https://gemigo.io/。

沿用唯一 `useUIStore` owner，在现有 store 使用 Zustand persist；只 partialize `sidebarCollapsed`，同步 localStorage 恢复，首次 React 渲染前可用。key 为 `gemigo-ui-preferences`。只接受布尔值，不允许恢复其它字段或覆盖 actions。读写存储失败退回当前会话内状态；损坏 JSON/字段类型不改变默认值。移动端 sidebarOpen、toast、dialog、预览内容与布局等临时状态不持久化。原语言存储保持原 owner/key。

既有 `useAppPreviewPanel` 自动收起也通过同一 action，记录当前实际侧栏状态；不增加手动/自动偏好双状态。候选手工读写可实现，但 persist 将状态过滤与恢复集中于 store，无需每个 action 增加写入；选择 persist。无新增依赖/组件/通用存储框架。

## 验收与交付

- 真实 Zustand store + localStorage 边界重建：首次默认；收起/展开及 setter 跨重建恢复；其它临时状态不恢复；语言与 actions 保留；损坏 JSON/非布尔值、存储不可用时切换仍可用。
- 当前 frontend tsc、定向 ESLint、生产 build、diff-only 手工维护性和实现 Review。
- 完整产品浏览器真实按钮切换并刷新，两种状态均保持，正常访问入口保留可用；按现有授权精确提交/推送 master 并同步主工作区。使用已有 Pages 交付流程发布前端并核对线上产物与交互。

design-document: required（改变刷新恢复生命周期）；plan: not-required（单批可闭环）。抽象审计：入口、状态与消费者不变，仅增加该 UI 偏好的存储边界。

方案 Review（实现前）：目标/刷新两方向/默认值/异常边界、preview 与 mobile 相邻状态及实际交付入口均覆盖；唯一 owner、标准 middleware、白名单保存及恢复，无新增平行路径。design-review: passed，no findings。

## 实现验证与 Review

- `node scripts/test-sidebar-persistence.mjs`：真实 store 与实际 Zustand middleware 组装，刷新恢复两方向、程序 setter、临时状态排除、语言/actions 保留、损坏和额外字段、读写失败/无存储 API 均 passed。
- frontend tsc、触达 store/脚本 ESLint、production build、diff whitespace passed；构建仅有现存 Browserslist 陈旧和 bundle 大小提示。
- 当前源码完整产品 `http://localhost:5195/`，经实际收起按钮 → reload → 仍显示展开按钮；实际展开按钮 → reload → 仍显示收起按钮，passed。
- 项目无 diff-only maintainability 自动入口；手工 findings-first 检查该 diff 与 Sidebar/app layout/preview 消费者，白名单读写保持单 owner、actions 不被恢复数据覆盖、同步恢复无额外 effect、存储失败不会中断 action。implementation-review: passed，no findings。
- retrospective_decision: no-increment。现有开发与存储边界方法足够，本次修正不新增通用规则或平行知识条目。
