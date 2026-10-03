# Tooltip 可见名称边界修复

用户明确要求：只有纯图标操作显示 Tooltip；带可见文字的入口不显示重复提示。截图为展开侧栏导航。flow=bugfix，风险 L2，retrospective_state=completed；授权按 AGENTS.md 完成提交、普通推送、master 同步、前端发布与线上验收。

## 证据与用户链路

本地当前源码 5297 端口、1440px Chrome 已复现：展开「探索应用」有可见文字，hover 同时出现同名 Tooltip。根因是 IconButton 无条件包裹 Tooltip，调用方的折叠状态、响应式文字隐藏没有传入；Popover 的四个实际消费者全部有可见文字。

用户进入 gemigo.io，hover/键盘聚焦展开导航与语言设置、更多发布方式时不再出现重复提示；折叠侧栏后 hover/聚焦图标继续读到名称，点击导航仍正常；再次展开，已打开的提示消失且按钮焦点、尺寸、对齐不丢失。响应式视图切换、账户与反馈按钮，文字显示时不提示，文字隐藏时提示。

## 冻结修复

- 保留 IconButton/Tooltip 为唯一图标操作 owner。IconButton 增加 showTooltip（默认 true）；带文字调用方根据真实 collapsed 或已有 useBreakpoint 与文字同断点传入，静态文字传 false。
- Tooltip 接收 enabled，以受控 open 拦截禁用时打开并清除旧打开状态；保留同一 Root/Trigger/按钮身份，避免条件移除 wrapper 导致焦点、ref、事件与布局重置。继续复用 Radix 延迟、Escape、Portal、定位，不自建提示系统。
- Popover 四个已有文字触发器统一关闭 Tooltip；保留业务与可访问名称。
- 图标加数字计数仍缺少操作名称，继续显示提示；头像缩写与「+」属于图形标识。全屏应用的进入遮罩已有 hover 提示文字，关闭额外 Tooltip。
- frontend/README.md 是规范 owner，修订同一规范；已有 icon-actions ESLint 扩展拦截有名称却未声明 showTooltip 的 IconButton，数值计数不误报。动态文字与 CSS 状态仍由 Review 核对。

抽象审计：多个现有消费者共享这一边界，新增一个布尔开关足够；文字可见性归布局调用方，Tooltip 生命周期归组件。不增加 DOM 文本探测、观察器、新 Provider 或新依赖。无传输、存储、兼容合同变化；只影响主前端操作提示，独立 admin 数据图表的数值浮层不在范围。

## 验收与 Review

真实源码页面覆盖展开/折叠导航、游客/账户、静态文字 Popover、桌面与窄屏视图/反馈、hover 与键盘、已打开提示时切换布局、按钮 DOM/焦点保持、点击导航与弹出菜单、原图标/图标加计数提示；类型检查、定向 lint、规则回归、生产构建。生产验收无 fixture 的展开/折叠/文字入口/图标提示与资源身份。

design-review: passed。反例已纳入：只隐藏浮层 CSS 会留下 aria 描述；切换 Tooltip wrapper 会重建按钮；窗口放大不能残留已打开提示；计数不等于操作名称。plan: not-required，单批闭环。

## 本地验收

- frontend tsc、12 个触达 TSX 定向 ESLint、icon-actions 规则样例与全 frontend inventory、diff-check、生产构建通过。
- 真实 Chrome 完整 `test-preview-comments-sidepanel.mjs` 通过：游客/登录导航、文字 Popover 点击/Escape/focus、卡片计数点赞、预览/密码/关闭等原图标操作；新增桌面/窄屏视图与账户、639/640px 反馈边界、管理页文字访问链接与收藏筛选，无 hover/focus/aria-describedby 重复提示。
- 700→1440→700px 实时切换：已打开提示关闭，同一按钮仍连接且保留焦点，再次隐藏文字不会复活旧提示，重新聚焦可显示且 Escape 可关闭。
- mode=implementation Review: no findings；项目没有独立 diff-only maintainability 脚本，按当前 diff 核对单 owner、状态清理、稳定 DOM/refs、Slot 链接语义、响应式条件与文字同源、规则数值计数和条件图标反例。acceptance-ready（本地）。

## 线上交付与复盘

- 源码提交 `325af714e2728ddf97e1873b4a166d2083adf7d0` 普通推送进入 master，主工作区在 master；重新 fetch 核对两端 `0 0`，实际远程 SHA 与本地一致。本任务之外的草稿未提交。
- 标准 `pnpm deploy:pages` Published，Pages `02e40cab6baef7783a72bdcae80586170849adbc` built，上一版本 `5089e4913db33296da23643ef0e617b0508104aa` 可恢复。
- 无 HTTP fixture 的真实 https://gemigo.io/ 验收通过，实际加载 `index-DEMOk9Rv.js` / `index-DMr0dao2.css`：展开导航、更多方式、语言设置与内容筛选、桌面视图切换无重复提示；折叠导航键盘名称/Escape、导航点击及 active 状态、窄屏图标与放大后焦点保持正确。线上登录用户的个人页/反馈/管理页分支未实际登录操作，其定向行为由完整源码页面 + HTTP fixture 证明。
- 用户入口：刷新首页，hover 展开导航无 Tooltip；折叠侧栏后 hover/键盘聚焦图标显示名称，再展开关闭提示。AI 先验已通过，体验可由用户继续反馈。
- retrospective_decision=updated-existing-owner：修订原 `frontend/README.md` 并扩展现有 icon-actions lint 与浏览器回归，补上迁移时文字可见性边界；不新增通用 Skill 或平行规范。此前预览操作设计的无条件 Tooltip 描述由本修订的可见名称边界替代。

## 修订 2：按布局选择提示方向

用户追加指出折叠侧栏「应用管理」提示出现在上方，要求参考 ChatGPT。真实线上折叠导航复现 `data-side=top`：共享组件默认 top，而布局调用方没有指定方向。ChatGPT 实际参考页被 Cloudflare 人机验证阻断，未进行验证或声称逐像素对照；方向选择依据左边缘导航与顶部工具栏的实际空间，定位合同核对 [Radix Tooltip 官方文档](https://www.radix-ui.com/primitives/docs/components/tooltip)。

冻结：左侧折叠导航、账户入口、侧栏展开/收起控件向右，按图标垂直居中；顶部工具栏及移动侧栏顶部关闭按钮向下；侧栏横向项目视图切换向下，列表末尾 pin 操作向右。内容区域沿用默认 top，已有预览 dock 显式 right 不改。保留已有 6px 间距、箭头、延迟、Portal、Escape 和自动边缘避让；不新增定位状态/算法/组件。文字显示与布局尺寸维持修订 1 合同。

flow=bugfix，L1，skip-design（明确方向的单 owner 局部视觉修正，无状态/API/生命周期变化）；plan=not-required。复现入口 → 折叠侧栏 hover/键盘图标 → 提示在右侧且不盖住按钮或相邻导航 → 展开不重复提示；顶部图标向下，窄视口不越界。验证为 frontend tsc、触达 TSX lint、规则回归、真实页面矩形/方向/截图、生产资源身份及同入口复验。Review 在有效视觉证据后执行。

修订 2 本地证据：frontend tsc、6 个触达 TSX 定向 lint、icon-actions 全 inventory/规则样例、测试脚本语法与 diff-check 通过。通过 CUA 在真实源码页面验证 4 项游客侧栏、登录入口与展开控件全部 right；图标 x=11.5/width=40，提示 x=62.5，中心差 0.25px，没有覆盖图标列。主题/帮助/通知/GitHub 全部 bottom，提示 y=60.5，按钮底部 y=49.5；390px 菜单/主题/GitHub/侧栏关闭提示向下且位于视口内。展开导航 hover/focus 无提示、Escape 正常。已有浏览器回归脚本增加方向/矩形断言，本轮使用 CUA 执行真实交互证据，没有重新运行完整评论测试。局部页面未连接 API，不用其应用列表加载结果证明线上可用性，部署后直接核对真实线上数据与导航。

mode=implementation Review（修订 2）：no findings。只在布局 owner 显式指定已有 tooltipSide，未新增全局默认、定位状态、CSS 依赖或抽象；尺寸、对齐、业务事件、名称可见性与 Radix 避让未变。项目无独立 diff-only maintainability 脚本，已审查本次 diff。复盘继续收敛到 README 的方向规范与现有定位回归，不另建规范 owner。
