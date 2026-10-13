# 预览网站切换控件

用户从首页、探索网格或管理列表打开一个网站，在左下角按上／下箭头浏览打开时当前列表中的上一个／下一个可访问网站；iframe、选中卡片和操作对象同步变化，半屏／全屏模式保持。到首尾禁用对应按钮，单个网站两个按钮均禁用。移动端沿用原来的新标签打开行为。

采用独立可复用 `FloatingSiteNavigation` 组件，默认左下角，输入两项可用状态与回调，不拥有网站列表。两处共同使用 FloatingDock、FloatingDockAction、FloatingDockHandle 和 FloatingDockDivider，统一 41px 外宽、32px 操作按钮、16px 操作图标、表面、布局和 toolbar 语义；沿用 IconButton 反馈和国际化。`useAppPreviewPanel` 接受列表快照并负责同一预览会话的切换，调用方提供当前实际排序／筛选后的列表；无 URL 的项目跳过。openRightPanel 原子更新内容、选中 ID 与 layout，避免全屏切换中间态触发半屏滚动锚点。切换不重新请求或建立第二份业务 feed。快照范围为已加载列表；如需新加载网站，关闭预览并从更新的列表重新打开。

布局在 existing `useFloatingDock` 增加可选底部保留空间，按父容器高度和控件真实高度约束 top、拖动和最大高度。左上角控件占用上部可用区域，内容过高可滚动；ResizeObserver 按底部导航真实尺寸和位置保留底部空间，并加 12px 间距（当前78px胶囊、16px底距，共106px）。半屏沿用 outside-left 的边缘位置，全屏位于 inside-left。保留底部区域比仅把导航移到右边更符合左下角要求，也避免两个 draggable 状态和碰撞规则。新增控件无需拖动，用户未要求此能力。

验收：三网站连续前后切换、首尾／单网站、无 URL 跳过、筛选后的顺序、全屏保持、关闭重开；半屏／全屏／深色、展开、拖到底部、短视口和窗口缩放时两个矩形无交集且按钮可达；原评论与操作回归。运行 frontend tsc、targeted ESLint、生产 build、真实 React 浏览器测试（HTTP fixture）和生产浏览器冒烟。提交推送 master，沿 gh-pages 发布，核对线上资源身份和真实站点切换。

flow=standard，risk=L2，plan=not-required（单批闭环）。设计 Review：目标、owner、首尾、快照范围、模式保持及短视口反例均已覆盖，passed。复用现有 preview owner 与浮动 hook；不增加全局 registry、第二个 feed 或新依赖。

## 实现验证与 Review

- `scripts/test-preview-navigation.mjs` 通过：真实 React 页面配 HTTP fixture，覆盖首页／探索／管理列表顺序、键盘、首尾、单项、无 URL、全屏保持、iframe 可操作、评论不重载 iframe、关闭、展开／拖动／缩放／短视口、深色。矩形断言覆盖最短 240px 高度；真实截图位于系统临时目录 `gemigo-preview-navigation-{half,dark}.png`，已目视检查。
- frontend tsc、变更文件 ESLint、生产 build、diff whitespace 检查通过。仓库无已注册 diff-only maintainability 入口，使用 diff Review；内容／选中 ID／布局原子更新，ResizeObserver 监测父级及胶囊自然高度，未发现未关闭 finding。
- 旧 `test-preview-comments-sidepanel.mjs` 停于现页面已不存在的 GitHub 链接；旧 `test-preview-actions.ts` 停于其 Node 测试缺少 `document` 环境。二者未作为通过证据；本次定向浏览器脚本覆盖触达的评论与 iframe 行为，不扩展修复无关测试环境。
- 复盘：新增事实和约束已在此设计与定向回归脚本保存；无跨项目方法增量，不新增全局规则。

## 2026-10-13 用户修正：复用同一悬浮组件

原导航单独写了胶囊和 40px 按钮，未满足用户要求的同宽、同格式和同语义。改为共同 `FloatingDock`（41px 外宽、表面、方向、布局、展开区和 toolbar 语义）、`FloatingDockAction`（32px 操作按钮、右侧提示、焦点和状态反馈）及 divider。业务组件只提供操作内容；左上角独有的品牌拖动／展开 handle 属于其内容，保留行为。左下角通过同一定位 utility 默认停靠底部；没有单独外壳或按钮样式。导航为78px，底部避让带改为读取实际组件尺寸与位置（当前106px），消除调用方复制公共布局尺寸的维护风险。

验收新增：半屏／全屏／深色／禁用／hover／focus 状态，实际 DOM 的两个外壳宽度、surface computed styles、action bounds 与 computed styles一致；上方展开／收起／拖动及原网站切换回归。方案 Review passed：共用边界覆盖两个真实消费者，没有引入第二份 dock 状态或改变导航含义。

修正后的验证：扩展后的浏览器回归通过，逐项比较两处外宽、边框、圆角、背景、阴影、模糊、按钮／图标宽高、间距，以及 resting／hover／focus 的计算样式；覆盖半屏、全屏、深色、禁用。导航占用空间通过实际 DOM 测量，窗口缩放和上方展开／拖动避让回归通过。frontend tsc、变更文件 ESLint、build 和 diff check 通过。实现 Review 未发现未关闭 finding；复盘修正已归入现有设计和回归测试，不新增长期规则。
