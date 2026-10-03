# 管理页面继承滚动位置修复

## 来源与证据

用户在2026-10-03提供截图：进入应用管理页时停在中下部，希望进入时位于顶部。flow=bugfix，交互L2、部署L4；完整交付已由项目AGENTS授权。reproduce：真实登录会话从dashboard较下方的「发票生成器」卡片进入 /projects/c8a878e5-5bd3-4fb7-b751-c67c2be453bb，main.scrollTop=812，window.scrollY=0，命中用户截图同一问题。

MainContent的main为共用滚动owner；路由切换只替换AppRoutes内容，main持续挂载且没有路由滚动重置。usePreviewScrollAnchor只处理预览/侧栏布局变化，不负责页面跳转。管理页局部或window.scrollTo都不是正确owner。

## 冻结方案

用户在应用管理列表向下浏览，点击应用后，路由提交且第一帧绘制前，主内容区回到顶部；从侧栏切换另一应用、返回应用管理列表也回到新页面顶部。应用名与顶部表单完整可见。

MainContent监听location.pathname，在useLayoutEffect里让自身scrollRef立即回到top/left=0。依赖仅pathname；同页筛选/周期query变化、预览展开/收起、主题和侧栏更新不触发页面重置。复用现有ref与预览anchor，无新状态、hook、定时器或额外容器，不重挂载页面以免丢失表单状态。不新增历史滚动恢复机制；此前没有此功能。

design-document=required（共享壳的导航生命周期）；plan=not-required（单批可闭环）。抽象审计：单owner、单路径，无未来基础设施。mode=design Review：入口与根因一致，pathname包含应用id，布局更新与query不触发，loading后内容展开仍保持顶部；no findings，design-review=passed。

## 验收合同

contract-id=route-scroll-2026-10-03，parent-goal=进入应用管理页时显示页面顶部；scope-revision=1。用户链路与截图为有效来源；单阶段。没有增加权限、数据迁移或接口标准。

| ID | Required | 约定 | Status | 证据 |
| --- | --- | --- | --- | --- |
| SC1 | true | 从滚动后的列表或另一应用设置跳转，新页面main.scrollTop=0，标题完整可见 | passed | 修前生产812px；生产build+真实React/API/D1浏览器验证页面/应用跳转0 |
| SC2 | true | 同页查询/刷新/布局更新不意外归零，保留既有预览锚定 | passed | 同页query导航与侧栏展开保留位置；原preview anchor未改动且pathname依赖不随预览状态变化 |
| SC3 | true | 类型/静态/真实浏览器回归、diff Review、普通推送与主区master同步，前端部署后同入口复验 | passed | ec27b69普通推送/主区0 0；生产JS身份一致；真实桌面/窄屏原入口main归零、标题完整 |

当前阶段=Completion check；retrospective_state=completed。无待决范围变化。


## 实现、验证与Review

MainContent原ref直接承担路由归零，useLayoutEffect保证绘制前完成；8行改动，无timer或页面状态迁移。复用test-app-analytics已有真实production build/React/Worker/D1浏览器fixture，补上同页query保留、通用页→dashboard、dashboard→设置、侧栏布局不归零、设置→另一个应用id的实际入口回归，全部通过。根typecheck、app.tsx/test定向ESLint、前端build与diff check通过，只有既有Browserslist/bundle提示。

首次本地Miniflare进程提前关闭socket，重启后正常；测试初版跨tab切到加载中的短内容被浏览器自然限制最大scrollTop，已改为不改变内容高度的真实query导航来验证是否主动归零，不把自然内容收缩当作新bug。项目无diff-only维护性脚本，按最终diff检查owner、pathname依赖、paint时序、相邻preview effect和fixture；implementation-review=passed，no findings。线上原触发与发布身份已由SC3验证。


## 线上交付与复盘

源码ec27b69已普通推送，主工作区master快进后0 0，实际远端SHA=ec27b69f8e76d9849a059dccfd99df83f3be03f8。pnpm deploy:pages Published，生产HTML与浏览器加载index-DFIDKL-U.js；产物SHA256=65b14abdbab16062f0c2ae7a6f983eabf3e1e3396018a5686a2934b86451d50a，本地/线上一致。

真实所有者会话沿原dashboard→发票生成器管理页复验：窄屏列表main=1545后进入settings为0、标题top=86；桌面1280×720列表main=638后同一入口为0、标题top=108。桌面临时视口已恢复。截图/tmp/gemigo-route-scroll-fixed-desktop.png。AI验收passed，用户可刷新旧标签后从应用管理列表点击任意应用检查；未声明用户已验收。主区并发admin/规则与其它草稿未触碰。

retrospective_decision=no-increment：根因是现有滚动owner缺少导航同步；已在原owner补齐并通过真实用户路径保护，无证据支持新共享抽象或流程规则。Delivery返回ready-for-retrospective，复盘完成返回ready-for-completion-check；Required SC1–SC3全部current passed，无开放产品缺口。
