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

## 2026-10-13 用户修正：反馈面积与上下留白

截图确认导航首项紧贴上边，操作区仅有下内边距；IconButton ghost 和 dock hover 都作用在32px按钮本体，导致反馈显大。共用组件保留32px点击区，用居中24px伪元素承载 hover／active／selected／focus反馈；handle也复用同一反馈规则。操作区改为上下各4px，折叠时同时归零；导航总高度保持78px，避让仍测量真实组件。禁用项不显示 hover／active反馈。选中评论和关闭的危险色统一在组件内部表达，不保留调用方的大块背景。

方案 Review passed：共同组件唯一 owner、点击与键盘命名保持、既有切换和避让范围不变。验收覆盖真实伪元素尺寸／背景／focus、上下padding相等、disabled，以及浅深主题、两个控件与线上真实切换。

## 当前完整修订：网站身份与弹性停靠

用户追加要求：导航顶部显示当前网站标签页图标，hover显示应用名称；两处顶部身份图标不应作为可点击按钮或显示背景反馈；上方操作条拖离时四角圆润，重新停靠恢复贴边形状。

复用 gateway smart-favicon runtime 选出的原始／恢复／动态图标，通过 parent request（带本次文档 nonce）返回给预览。前端验证 iframe source、origin、nonce 和图像 URL；同源不同路径的旧回复也不能串到新网站。仅分享公开图标，既有 CSP 不改写；没有 runtime 的外站／受限页面尝试根 favicon，加载失败显示通用网站图标。两处身份槽使用同一非按钮 div + image语义和 tooltip；上方保留鼠标拖动，hover/focus展开，取消点击 pin。下方身份图标无操作，悬停和键盘聚焦显示当前应用名称。导航真实高度测量自动适配新增图标及divider。拖动时完整圆角和边框，松开恢复停靠边缘；圆角300ms回弹曲线，减少动画时禁用过渡。

active contract `preview-dock-2026-10-13`，parent-goal 为同组件、一致且合理的反馈、当前网站身份和弹性停靠，单阶段交付；risk=L3（跨iframe/runtime消息边界）。方案 Review passed：复用图标 owner，来源与nonce验证、无点击身份语义、既有CSP保持、无图标可观察恢复、整体避让和发布入口均覆盖。

| Required ID | 标准 | 状态 |
| --- | --- | --- |
| PD-01 | 共享组件、对称留白、24px反馈、32px点击区，禁用无hover | passed |
| PD-02 | 当前favicon随网站切换，hover/focus显示当前名称，无按钮身份反馈 | passed |
| PD-03 | favicon跨域来源／nonce验证、原图标／动态图标及失败恢复 | passed |
| PD-04 | 拖离四角圆润，停靠恢复，短窗口两控件不重叠 | passed |
| PD-05 | 原首页／探索／管理切换、评论、类型／lint／build回归 | passed |
| PD-06 | 主线同步、frontend与gateway上线、真实网站验收 | stale |

当前本地证据：扩展后的 preview 浏览器测试通过（24px反馈、对称padding、被动身份、名称tooltip、favicon切换、错误origin／旧nonce拒绝、坏图恢复、拖动形变／恢复、避让及三入口回归）；真实Miniflare gateway／Chromium 20类图标与3类跨域parent交换通过，并保留CSP、源码、缓存和重部署验证。frontend和favicon模块类型检查、定向ESLint、build、gateway dry-run、diff check通过；实现Review无未关闭finding。复盘：身份与操作语义在共同组件分开，favicon复用现有owner；本次事实已更新该设计及gateway README，无全局规则增量。

生产验收（2026-10-13 23:57 Asia/Shanghai）：前端 `index-CZgveXI1.js`、gateway version `2db2584e-5f80-4ddf-9bc4-874ee743a350` 生效；真实 `wenyu-relay.gemigo.app` 加载且导航favicon与其标签页图标一致，名称tooltip、被动身份、24px反馈／对称padding、短视口避让、拖离圆角与松开停靠恢复、前后切换／全屏保持均通过。实现提交 `16c8cb8` 已进入远程及本地主线；所有 Required ID passed。旧版hash等待和一次SSH断连未作为成功证据，重试后新资源身份与真实链路已确认。

## 2026-10-14 修正：统一拖拽与即时等待反馈

用户要求左下角同样可拖动，所有代码复用；点击上下切换后，左下角身份槽立即显示与页面加载同源的张嘴／闭嘴小精灵，加载完成恢复favicon，反馈不占用网站区域。

共享 FloatingDock 接管 useFloatingDock、身份拖动绑定、pointer capture、停靠与形变；指针捕获避免经过跨域iframe后丢失mousemove／mouseup，identity统一阻止原生HTML图片拖拽，避免favicon进入浏览器另一个拖动状态机；业务壳只给身份内容、操作内容和默认位置。hook 增加底部初始锚定和上下限，两个控件沿同一状态机；面板测量两个真实控件的位置／高度并保留12px间隔，固定上下顺序，拖动、展开与缩放都不会相交。默认导航贴左下，拖动后使用实际停靠位置并记忆；全屏禁止停靠到屏外。

AppPreviewContent 保持唯一加载状态 owner，新增真实 loaded 状态，手动收起慢加载提示不代表网站已经加载。面板按URL映射此状态，URL切换时在首次渲染就显示加载图标，不等待iframe事件；onLoad后恢复favicon。共用 LoadingSprite 图形和张嘴动画，大图和身份槽仅布局不同。

方案 Review passed：已检查两个当前消费者、共同拖拽生命周期、底部锚定、双方实时避让、点击不触发拖动、失焦取消、全屏／半屏记忆、URL即时反馈／慢加载／实际完成及减少动画。未增加第二个拖拽实现或独立加载状态来源。Required PD-01..06 在本次修订全部置 stale；PD-07 新增双方拖拽／停靠／避让，PD-08 新增即时小精灵／动画／实际完成恢复，均 Required、not-run。

| PD-07 | 两处同一拖动／停靠／形变实现，导航底部默认、拖后记忆、互相避让 | passed |
| PD-08 | 切换首次渲染立即显示张嘴精灵，等待时动画、实际onLoad恢复favicon | passed |

修订本地证据：preview-navigation 浏览器回归验证双方拖动（包含favicon真实img的原生DND抑制）、跨iframe移动／mouseup、左右停靠、失焦取消、短窗口不相交；持有真实文档请求时验证首次渲染busy和紧凑精灵、张嘴clip-path动画、慢提示关闭仍busy、旧导航完成不清除新状态、减少动画及完成恢复favicon。原preview-loading真实UI延迟／重试／取消／非遮挡／内容保留／移动端回归通过；该脚本的页面精灵选择器现按页面loading owner定位，导航精灵另有定向验证。frontend tsc、定向ESLint、build、diff check通过，diff Review无未关闭finding。复盘：修复发生在共享拖动owner和加载owner，新增事实／测试更新原设计；没有跨项目规则增量。
