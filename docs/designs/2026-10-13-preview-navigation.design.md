# 预览网站切换控件

用户从首页、探索网格或管理列表打开一个网站，在左下角按上／下箭头浏览打开时当前列表中的上一个／下一个可访问网站；iframe、选中卡片和操作对象同步变化，半屏／全屏模式保持。到首尾禁用对应按钮，单个网站两个按钮均禁用。移动端沿用原来的新标签打开行为。

采用独立可复用 `FloatingSiteNavigation` 组件，默认左下角，输入两项可用状态与回调，不拥有网站列表。沿用现有 IconButton、胶囊视觉和国际化。`useAppPreviewPanel` 接受列表快照并负责同一预览会话的切换，调用方提供当前实际排序／筛选后的列表；无 URL 的项目跳过。openRightPanel 原子更新内容、选中 ID 与 layout，避免全屏切换中间态触发半屏滚动锚点。切换不重新请求或建立第二份业务 feed。快照范围为已加载列表；如需新加载网站，关闭预览并从更新的列表重新打开。

布局在 existing `useFloatingDock` 增加可选底部保留空间，按父容器高度和控件真实高度约束 top、拖动和最大高度。左上角控件占用上部可用区域，内容过高可滚动；底部导航独占 118px（90px 胶囊、16px 底距、12px 间距）。半屏沿用 outside-left 的边缘位置，全屏位于 inside-left。保留底部区域比仅把导航移到右边更符合左下角要求，也避免两个 draggable 状态和碰撞规则。新增控件无需拖动，用户未要求此能力。

验收：三网站连续前后切换、首尾／单网站、无 URL 跳过、筛选后的顺序、全屏保持、关闭重开；半屏／全屏／深色、展开、拖到底部、短视口和窗口缩放时两个矩形无交集且按钮可达；原评论与操作回归。运行 frontend tsc、targeted ESLint、生产 build、真实 React 浏览器测试（HTTP fixture）和生产浏览器冒烟。提交推送 master，沿 gh-pages 发布，核对线上资源身份和真实站点切换。

flow=standard，risk=L2，plan=not-required（单批闭环）。设计 Review：目标、owner、首尾、快照范围、模式保持及短视口反例均已覆盖，passed。复用现有 preview owner 与浮动 hook；不增加全局 registry、第二个 feed 或新依赖。

## 实现验证与 Review

- `scripts/test-preview-navigation.mjs` 通过：真实 React 页面配 HTTP fixture，覆盖首页／探索／管理列表顺序、键盘、首尾、单项、无 URL、全屏保持、iframe 可操作、评论不重载 iframe、关闭、展开／拖动／缩放／短视口、深色。矩形断言覆盖最短 240px 高度；真实截图位于系统临时目录 `gemigo-preview-navigation-{half,dark}.png`，已目视检查。
- frontend tsc、变更文件 ESLint、生产 build、diff whitespace 检查通过。仓库无已注册 diff-only maintainability 入口，使用 diff Review；内容／选中 ID／布局原子更新，ResizeObserver 监测父级及胶囊自然高度，未发现未关闭 finding。
- 旧 `test-preview-comments-sidepanel.mjs` 停于现页面已不存在的 GitHub 链接；旧 `test-preview-actions.ts` 停于其 Node 测试缺少 `document` 环境。二者未作为通过证据；本次定向浏览器脚本覆盖触达的评论与 iframe 行为，不扩展修复无关测试环境。
- 复盘：新增事实和约束已在此设计与定向回归脚本保存；无跨项目方法增量，不新增全局规则。
