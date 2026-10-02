# GemiGo 前端体验设计

[原始要求](../logs/2026-10-02-frontend-experience/README.md#原始输入与约束) · [合同](../work/2026-10-02-frontend-experience/acceptance-contract.md) · [恢复入口](../work/2026-10-02-frontend-experience/current-state.md)

## 设计决定与真实依据

源代码和线上画面证实：双 header、过亮 slate 底色、宽松重复卡片层级；导航装饰条与放大动效、无行为红点；等待误用 Lock；未加载完先显示 empty；项目设置只从分页列表找且无结束错误；Explore 失败无反馈；所有路由静态 import，主 JS 696.09kB。旧页面现有能力通过既有 manager 复用。

候选：只替换加载卡片（无法覆盖用户的全盘目标）；重写框架和 UI 库（迁移风险大且无法证明额外收益）；选用现有 React/Tailwind/状态模型，统一实际重复的展示边界并逐页面清理。采用第三条，牺牲全新品牌造型以保护产品识别和已用工作流，获得直接可验证改善。保留紫色为小面积品牌/主操作。

## 黄金用户链路（UX01–UX06）

1. 回访者刷新仪表板：立即看到稳定应用壳和“仪表板”标题，统计/项目骨架占住内容区域 → 会话/数据到达后显示真实项目 → 搜索既有项目 → 管理 → 设置就位 → 返回仪表板。会话网络失败显示重试，未登录才请求登录；数据失败保留标题并可重试；不存在的项目结束为明确不可用，可回项目列表。
2. 访客打开首页：主发布动作与探索在首屏清楚可读 → 输入搜索/选类别 → 卡片立即反馈筛选与加载 → 预览 → 关闭/返回恢复列表上下文 → HTML 或 ZIP/GitHub 发布。输入校验、登录、运行进度、链接和失败恢复沿用已验证部署 owner；优化视觉不删现有源分支。
3. 手机用户打开菜单：完整导航和关闭入口 → 点击探索/我的主页自动收回 → 打开登录/确认弹窗，焦点留在弹窗并可 Esc 返回触发控件 → 填写/保存仍见状态。预览有完整小屏退出路径。暗色/英文与长项目名覆盖同样流程。

## A. 视觉与应用壳

index.css 成为唯一 palette/视觉 utility owner，index.html 只保留预启动颜色/主题同步和必要静态内容；去掉 CSS 双定义、蓝色链接与紫色品牌冲突、暗色光晕。白色内容底、浅中性色侧栏、灰色细边、柔和阴影仅用于浮层。采用系统字体栈，14–16px 正文，紧凑但足够点击区域，Lucide 统一 1.75–2 stroke、16–20px。

应用壳 header 缩短，保留主题/语言/支持/账户并去掉假通知；页面标题跟内容同一最大宽度、无第二个硬分隔栏。导航用语义链接，支持新标签/键盘/active，取消装饰竖条和放大。折叠按钮进入侧栏自身；移动 drawer 完整焦点/Esc。主内容 100dvh、min-width0、稳定滚动区域，跳转回顶部与可访问焦点。

复用 PageLayout 覆盖 Dashboard/Profile/Explore/Community，部署与项目布局共享 token 和尺寸。预览改为固定可见的标题/打开/全屏/关闭工具栏，删除仅此消费者使用的拖拽logo dock与装饰玻璃边；侧栏不再因打开预览自动改变用户的折叠偏好。全屏预览和Feed通过最新共用 Radix Dialog 限制背景焦点；Feed退出始终可见，删除每次scroll触发的全局header重渲染。首页发布区域保持现有主要入口，清晰文案和轻量中性色面；卡片统一边框/圆角和 title/action 层次，隐藏本地/source 技术标识并格式化日期。

## B. 等待、失败与交互

共享 PageSkeleton、ContentSkeleton、PageState 展示实际不同内容结构（项目网格/详情/列表/主页）；只共享展示，不引入新 fetch owner。页面 title 一直存在。Auth 恢复合并重复 in-flight 请求，设置有限超时，401 才当 signed-out，网络/服务失败可重试，独立 sessionError 不污染表单错误。

Dashboard 从 hasLoaded/isLoading/loadError 判定首次 skeleton/真正 empty，缓存已有内容刷新不清空。项目设置按登录恢复后加载列表；若列表未含目标，使用现有分页 loadMore 逐页定位直到 exhausted，途中保持 details skeleton；避免页面/App 同时 loadProjects；失败重试正确 loadMore 或初始加载，不循环未授权 fetch。

Explore store 添加 error 和 hasLoaded，唯一 manager 的 request identity 丢弃陈旧响应，保留此前结果直到替换成功；过滤变化的 loading 明确，重试走同 manager；删除 mount+debounced 双取数。空结果有清除筛选，追加失败保留结果和重试。主页与反馈加载匹配真实结构。公开主页保存当前请求标识，重置前一个作者数据并丢弃过期响应；区分404和网络失败。个人主页取数失败明确重试且禁止把未加载表单保存覆盖已有资料。Toast 可被辅助技术读取，错误不自动三秒消失。

共享最新 Radix Dialog owner 承接 Auth/Confirm/名字提醒，并通过 layout=drawer/fullscreen 承接抽屉与预览/Feed；Portal、focus trap、背景隔离、Esc/关闭拦截、初始安全焦点和返回焦点归单一组件。反馈/作者现有交互另在第二批核对。页面表单标签/错误描述和禁用/运行反馈完整。移动菜单复用同一 Dialog 的 focus/Esc 管理，不存第二份业务状态。

## C. 加载与速度

路由静态 import 改为按需 import，首页维持 eager；共享 shell/骨架始终可用，Suspense fallback 与目标路由结构匹配，chunk 错误给重载入口。常用导航 hover/focus 只预取目标代码，不预取私人数据或无差别所有路由。去除 App 对 CLI/SDK/法律页的 eager import，保留相同特殊布局。

Crisp 只在帮助点击后加载/初始化，不占首屏；无配置时帮助转反馈入口，避免无反应按钮。分享卡片图像保持现有 thumbnail owner 和优先级/懒加载。交互只对必要颜色/opacity过渡，取消布局 transition-all/进场延迟；prefers-reduced-motion 覆盖 animation，主题在首帧同步避免闪白。

性能条件和门槛固定于 UX07；生产构建模拟 4xCPU、1.6Mbps 冷加载3次，测首屏/LCP/CLS与导航事件时延。优化前 build和线上基线留日志，测试专用数据/拦截只证明边界行为，生产实际数据另验证。

## 设计/抽象审计与矩阵

保留既有状态 owner/API/部署状态语义；新增仅实际被多页面消费的 skeleton/dialog 和单一路由加载函数；删除重复 Lock 等待、无功能通知、内联 palette、eager 特殊页。无 registry/provider/新设计框架。维持既有 URL、权限和 stored preferences，主题 boot 从gemigo-theme偏好读取（此前 theme 无持久化，新增只保存light/dark）。

矩阵：auth待定/登录/登出/网络失败；项目初始/已有/空/搜索空/首次失败/追加失败/缺失；Explore首次/筛选/空/失败/加载更多/预览；发布三种来源、失败和真实成功；移动/平板/桌面，中英亮暗；dialog Tab/ShiftTab/Esc/焦点返回；减少动画；生产首访与已缓存导航。每个核心页面打开真实渲染复看，不能用类型检查代替视觉。

design-document=required；plan=required（视觉 → 状态/路由 → 集成/上线的跨 owner依赖与恢复）。design-review=passed，证据见日志；新独立模型缺口先更新这里并复审。
