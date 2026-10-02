# 主内容滚动条边界与样式

用户截图指出首页分栏滚动条离容器右边缘有空白，悬停后变粗。用户补充要求避免写死、不灵活。bugfix；布局调整L2，既有状态/滚动 owner 和行为不变，正式设计/Review，plan not-required。采用现有 development-lifecycle 与 brainstorming 方法收窄到原截图路径，无需用户重复确认。

## 证据与修复设计

线上1440×900实际打开 Geeglo，main.right=720、aside.left=752，空隙32px。MainContent 预留50vw，RightPanel却取(viewport-sidebar)/2，侧边栏展开时还会变成128px空隙。滚动条没有定向样式，使用平台原生宽度/悬停行为。

最小用户链路：首页点击应用打开预览 → 左侧列表滚动条贴齐预览分界 → 滚动/悬停仍是固定细条 → 全屏往返/关闭预览继续浏览。首次无预览时仍占满侧边栏右侧的剩余宽度；手机不预留预览宽度。

保留原MainContent滚动容器与锚点hook；MainLayout使用grid：原侧栏空间用既有间距token预留，lg以上预览打开时剩余空间由两个minmax(0,1fr)自动平分，RightPanel加入正常布局流，不再手动计算视口/侧栏/右侧margin。关闭/全屏保持单列，全屏aside仍fixed。主区域和aside均min-w-0/min-h-0，容器独立滚动不撑开grid。

只给主滚动容器添加app-scrollbar：统一--app-scrollbar-size token（默认0.375rem）、透明轨道、圆角滑块，hover只提高颜色对比；stable gutter防止内容宽度变动，Firefox使用标准thin回退。主题颜色沿既有text-secondary变量。无需新组件/滚动库/状态/监听或修改第三方iframe。相比共享手算宽度，grid直接约束相邻容器，不存在复制几何公式，符合用户追加要求。

方案与抽象审计：布局几何归同一shell，状态仍归UI store；全屏/手机行为及锚点hook保持，不增加公共API或第二owner。更新后的design review通过，no findings；实际布局/样式是验收依据，不以类名代替效果。

## 验收与交付

- 完整产品桌面：侧栏收起和展开两种分栏gap=0，滚动条遵守尺寸token；主列表正常滚动、hover前后宽度不变，主题可读。
- 关闭/全屏往返仍可用；390px手机主内容无水平溢出、不预留右侧空隙。
- frontend tsc、定向ESLint、生产构建、diff-only手工Review。
- 按现有授权精确提交/普通推送master、同步主工作区，既有Pages发布并核对线上新产物、真实分栏滚动入口。交付 https://gemigo.io/，体验待用户反馈。

## 当前验证与实现 Review

当前源码完整首页localhost:5195，生产API真实数据：1280×720收起时main=608px/aside=608px，main.right=aside.left=672px；展开时512px/512px，gap均0。实际滚动scrollTop从265.5增至985.5；真实鼠标悬停滚动条后，computed宽度与实际gutter仍为6px。明暗主题真实截图可读；全屏aside占满1280×720，退出后分栏gap0，关闭后main.right=viewport=1280。390×844主内容left0/right390、clientWidth=scrollWidth=384，额外6px为稳定滚动条槽，无横向溢出。

frontend tsc、app.tsx定向ESLint、production build、git diff --check passed；只有既有Browserslist陈旧与大bundle提示。项目无diff-only maintainability自动入口，手工审查app/css差异、原锚点hook、Sidebar fixed/移动遮罩、全屏/隐藏aside、全局反馈portal/fixed。保留同一滚动节点；grid minmax/min-width避免内容撑开，响应式单列不留下隐藏列；不存在平行计算/新store/监听。implementation-review: passed，no findings。
