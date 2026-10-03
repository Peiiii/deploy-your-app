# 应用预览等待体验

当前有效行为为修订5：iframe 从挂载开始正常显示与交互，load 仅清理底层反馈；下文原始方案与修订1–3的 load 揭示/淡入描述均为历史，已被修订4取代。

来源：2026-10-03 用户希望右侧展开应用期间消除类似白屏的等待，探索加载提速，并参考产品缺口图标做吃东西的小精灵。用户授权 AI 自行选择；AGENTS.md 全托管授权包含精确提交、普通推送、主工作区同步、前端上线。feature / standard，交互 L2、发布 L4；plan=not-required（单批闭环），retrospective_state=pending。

## 现状与用户链路

首页/探索卡片 → useAppPreviewPanel → AppPreviewPanel 直接嵌入 iframe；没有 loading/onLoad 状态。图标权威外观为 frontend/public/logo.svg 与 sidebar-header 的四块紫色扇区，右上缺口。预览评论/全屏切换已经保留同一 iframe，必须继续保留应用内进度。手机沿原入口在新标签打开。

用户点击卡片后，右侧立即出现浅紫/暗紫底、小精灵吃光点和正在打开的应用名称，同时真实应用立即加载。iframe 的 load 事件到达即揭示应用，无人为最低等待；淡入仅150ms且不阻止交互。等待10秒转为“加载比平时久一些”，可重试、直接显示当前应用或新标签打开；用户仍可使用 dock 关闭/切换/评论/全屏。切换另一个应用重建加载会话，旧请求不能结束新应用的等待。

## 方案与边界

候选：静态缩略图+转圈（简单但旧截图可能与实际不同）；品牌吃光点动效（采用，短等待可感知、有品牌记忆）；隐藏 iframe 池预加载（会提前运行任意用户应用、请求与资源成本高，本次不采用）。直接 SVG/CSS 动效不增加图片、第三方脚本或运行时依赖；沿现有紫色扇区，只让嘴部开合，少量光点进入嘴部。尊重 prefers-reduced-motion，保留静态图标和文字。没有假百分比、游戏或人为拖长等待。

提速采用卡片鼠标/笔悬停或键盘 focus 后对目标 origin 发 preconnect，单个可更新 head link，有界且不预请求文档/执行应用；同源不重复建连接。收益取决于 DNS/TLS/既有连接，不能承诺秒开或具体百分比。所有应用立即加载不加延迟、懒加载或缓存覆盖。缓存/跨应用池属于独立优化，未建立足够性能证据不改底层发布链路。

最近 owner：新 AppPreviewContent 组件管理嵌入网页的本地 DOM load/慢等待/重试生命周期，AppPreviewPanel 继续拥有布局与业务操作。按 app.id+url key 重建会话，重试仅重建 iframe；评论/全屏不变 key。连接提示工具只拥有浏览器 head resource hint，无业务 store、持久化或平行预览服务。复用既有 i18n 与文本按钮。

浏览器 iframe load 不能证明第三方 SPA 首次交互完全就绪，也可能在失败后触发；不虚构跨源错误检测。加载后网页自己的异步白屏暂无法通用判断；超时明确是等待过久而非报错。官方依据：[iframe load/error](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#error_and_load_event_behavior)、[preconnect](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect)。后续若真实应用仍有 load 后长白屏，再沿该边界验证就绪信号。

## 验收合同与方案 Review

contract-id=preview-loading；parent-goal=线上点开应用时有品牌反馈、完成即进入应用、慢等待有可用出口；scope-revision=5（当前行为见修订5，之前修订为历史证据）。

| ID | Required | 可观察判定 | 状态 |
| --- | --- | --- | --- |
| PL1 | true | 真实首页卡片打开立即有小动效且无可见文字，iframe 始终可见可操作，load 只移除反馈 | passed |
| PL2 | true | 10秒非阻塞慢提示、重试、收起提示、新标签、关闭/切换可用；旧请求隔离 | passed |
| PL3 | true | 评论/全屏不重载应用；暗色、窄桌面、reduced-motion，中英文可读且无溢出；手机保持新标签 | passed |
| PL4 | true | 悬停连接提示有界、不加载应用文档；frontend tsc/定向lint/build与真实浏览器回归通过 | passed |
| PL5 | true | 本任务精确提交、origin/master和主工作区master同步；线上新资产与真实入口验收 | passed |
| PL6 | true | 单缺口开合、没有眼睛，身体固定且小；无分离扇形/双缝 | passed |
| PL7 | true | 正文可用但非关键图片挂起时，load 前可见且按钮立即能点，首次/重复打开均无需等待 | passed |
| PL8 | true | 普通切换保留同一窗口和旧画面至原生提交，retry后切换也保留，快速切换旧请求隔离 | passed |

黄金链路：默认 gemigo.io 首页 → 点开应用 → 看到精灵和应用名称 → 网页出现后实际操作 → 展开评论/全屏保持网页进度 → 关闭返回浏览。慢网络：同一入口 → 等待提示变化 → 重试或直接显示/新标签 → 可以继续或关闭。

实现前 mode=design Review：从原需求反查反馈、实际加载与用户可逃离性；iframe load 的可观测边界明确，没有假就绪承诺。反例包括缓存秒加载不强制播放动效、A→B旧load、超时后晚到load、评论/全屏保留节点、减少动态效果、hover不执行文档。路径符合既有 kebab-case home components/utils/scripts；项目无 planned-path preflight 或 diff-only maintainability 自动入口，使用路径核对与 findings-first diff Review。抽象仅局部 DOM 生命周期与一个连接提示，no findings；design-review=passed。

## 验证与实现 Review

隔离工作区 /Users/peiwang/.codex/worktrees/preview-loading/deploy-your-app；源区本任务草稿精确迁移并反向撤回，保留其它任务改动。复制现有三项公开 VITE 配置，未复制生产 Secrets 或 GEMINI_API_KEY。集成当时最新主线 a8bc0f7，production bundle index-Rj9bBp4_.js。

PL1–PL4=passed：frontend tsc、5文件定向 ESLint、production build、diff-check；完整 production preview localhost:5195 的真实 UI / 可控 HTTP 延迟浏览器回归通过。脚本 scripts/test-preview-loading.mjs 用卡片点击而非注入 store，证明等待隐藏 iframe、SVG 嘴部真实动画、10秒超时、重试新 iframe、旧 attempt/旧 app 请求隔离、直接显示与焦点恢复、新窗口/手机弹出、无最低停留、评论/全屏保留 iframe 和点击计数、中英文、系统减少动态效果、主题/窄桌面及有界 preconnect。HTTP 数据和应用为 fixture，仅证明开发边界，生产读路径随后单独验收。截图 /tmp/preview-loading-light.png、slow.png、dark.png、narrow.png 已逐张查看；等待主题匹配、文本可读且无横向溢出。

实现 Review(mode=implementation)：no findings。项目无 diff-only maintainability 自动入口，按本次 diff 和相邻 preview/key/ref/焦点/计时合同审查。修正慢等待计时回调采用条件状态迁移，防止已揭示网页被晚到计时回调重新遮盖；随后重验 tsc/lint/build/production UI。无新增依赖、后端改动、持久化或预执行任意应用；加载后网页内部 SPA 就绪/错误边界仍按设计披露。构建的已有 Browserslist 与大 bundle 警告不是本任务新增错误。PL5 待主线和生产验收。


## 上线、同步与复盘

2026-10-03 使用既有 pnpm deploy:pages 发布前端成功；源码 986c73f（主线合并 1ebc0f1），gh-pages 880964c7c0fd9c0d8cae299b36a7afa5618e437b。前一版 gh-pages 3f332a2faabbccac4d06eee667d75443ddf47b62 保留为回退依据。默认 https://gemigo.io/ 与实际 Chrome 均加载 index-Rj9bBp4_.js / index-BiFfGay1.css；线上 JS 与本地产物 SHA256 都是 30908bfbf8ac248686db7521a75add68feec131111122ce7ec51cb1ef21ac85e。只发布 frontend，不修改 Secrets 或发布后台。

PL5=passed：默认线上首页使用真实 API 找到「element」(939bbb9f-f25c-4d05-9ba9-fe1f87ee5d33)，打开 https://element.gemigo.app/；400ms真实网络延迟用于观测初始反馈，无 HTTP mock / store 注入。实际看到精灵/名称后加载元素周期表，点击氢元素详情成功；评论/全屏往返 iframe 节点身份不变，关闭可用。390px手机真实新窗口 URL 为同一应用，无内嵌 iframe / 横向溢出。证据 /tmp/preview-loading-production-evidence.json 与 production.png 已核对。上线自然秒数没有作优化前后对比，未声称百分比收益；第三方 SPA load 后自己的异步加载仍为已披露边界。

主工作区本地 master 当时有另一任务独有提交 34a219e（smart favicon），保留其归属后普通合并已交付主线并推送，master/远端实际 SHA=f6b783909f51157a8cde034fa95561c5f537583e，fetch 后 rev-list=0 0。同步前只有两份 locale WIP 与本任务触达文件重叠，精确 stash+备份→合并→apply --index，JSON 去除新 previewLoading 后与原草稿完全相等；原暂存区为空，恢复后仍为空，其它 WIP 未进入提交。恢复验证后删除临时 stash；本收尾记录另精确提交并同步。

最终 implementation Review no findings；有效证据覆盖 PL1–PL5。retrospective_decision=no-increment：这次局部浏览器加载状态已在既有 owner 与回归中闭环，iframe load 的可观测边界和用户逃离入口已经记录到本设计，无需新增通用规则或平行状态机制。retrospective_state=completed。交付入口为默认 gemigo.io，AI 功能/上线验收通过，主观动效偏好仍待用户反馈，不声称用户验收通过。

## 修订 2：嘴部为一个连续缺口（实现前）

2026-10-03 用户反馈扇形两边都有缝，像舌头，希望圆形缺口一张一合。bugfix；SVG/CSS 单 owner、局部视觉 L1，发布 L4。根因直接可核对：旧实现只转动第一块60°扇形，转至27°时，其起点从-90°变-63°，留下-90°至-63°的额外缝隙，而末端与下方扇区还有独立缝隙。skip-reproduction（直接几何证据 + 修后逐帧真实渲染）；不声称已有修前浏览器帧基线。plan=not-required，retrospective_state=pending；旧视觉通过结论不能替代用户新标准。

唯一修复路径：四个静态完整紫色象限组成圆形，整个圆形共用一个向右的扇形缺口裁剪；只连续改变上下两条嘴边角度，开到约62°、合到0°，身体保持完整。根据用户追加“眼睛不一定需要”的偏好去掉眼睛，仅保留品牌四象限、光点和既有加载生命周期；reduced-motion 固定小开口。复用 preview-sprite-jaw 动效 owner，不新增组件、JS 动画循环或逐帧 React 状态。CSS clip-path polygon + fill-box 用整体绘制范围定位，依据 [MDN clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/clip-path)。

contract-id=preview-loading，scope-revision=2；PL1/PL3/PL4/PL5 受本修订视觉/产物影响转 stale，PL2 状态逻辑证据继续有效；新增 PL6 Required=true / not-run：一张一合全过程始终只有一个嘴部缺口，无分离扇形/双缝，身体固定且没有额外眼睛，合嘴接近完整圆形，减少动态效果保留静态小开口。验收沿首页真实点击，在张开、收合和中间帧检查实际浏览器像素；同一回归更新嘴部检测为 clip-path 而非旋转，保留现有等待和退出矩阵。

实施前 design-review=passed：用户修正与连续整体模型对齐；静态四象限+单一裁剪不能产生独立舌片，没有新增依赖/状态/错误边界；局部修改复用原组件/样式/脚本及设计，无新路径。实际渲染而非类名断言证明缺口外观，随后线上新资产验收；no findings。

补充方案 Review：移除两枚眼睛圆点，SVG 与静态品牌更一致，不影响单嘴裁剪/光点/加载状态；PL6 同时验证无额外五官，design-review=passed。

修订2开发验收：PL1/PL3/PL4/PL6=passed，PL2 继续有效，PL5 等待新部署。最终无眼睛版本 production build index-BFUTbLjP.js / index-DDECKSYj.css；frontend tsc、定向 ESLint、diff-check 及原完整 production preview 回归通过。/tmp/preview-mouth-{0,150,300,450,599}.png 逐张核对：整体圆形一直连通、只有右侧嘴部缺口、合嘴形成完整圆形，中间帧没有分离舌片，眼睛已删除。减少动态效果的静态小开口由同一 CSS 基础裁剪提供。实现 Review no findings：一个整体绘制组拥有裁剪，保留原紫色四象限与光点，不引入 JS 动画或生命周期变化；没有项目 diff-only maintainability 自动入口，按这4个文件的 diff 审查。已有浏览器回归更新观测到的新动画属性，未增加仅镜像源码的视觉单元测试。

## 修订 3：等待反馈轻量化（历史）

用户继续纠正：角色太大、信息太多，等待应尽量不消耗注意力；文字可不展示，或仅有加载提示。完整交付继续授权，无需再次审批。选择无可见文字的常规等待：SVG 从176×96降为80×40，身体实际直径约22.5px；去掉应用名称、陪伴文案与中心大范围渐变，眼睛继续删除，嘴部采用修订2单缺口。辅助技术保留不可见“加载中”状态；iframe 仍有应用名称。10秒后才出现一行“加载较慢”和低强调的小型重试/直接显示/新窗口操作，保留用户逃离等待的能力。

scope-revision=3；修订2视觉尺寸/信息量证据转 stale。PL1 调整为常规等待只有小动效、无名称/说明文本且完成立即揭示应用；PL6 保留单缺口/无眼睛且符号小；PL2 异步状态逻辑不变，PL3/PL4/PL5 随新视觉/产物重验。实现前 design-review=passed：用户的轻量偏好直接可落实，无新组件/owner/状态；辅助技术与慢等待退出仍完整。原黄金链路只改变等待的视觉信息量，不改变进入应用/评论/全屏/手机链路。当前 plan=not-required、retrospective_state=pending。

修订3开发验收及实现 Review：PL1/PL2/PL3/PL4/PL6 passed；当前 production preview localhost:5196 的完整浏览器回归、frontend tsc、定向 ESLint、build 与 diff-check 通过。新增验证只匹配用户可观察标准（80×40以内、普通等待无标题文案且辅助技术仍能读状态），原慢等待/退出/新标签及旧请求隔离回归继续有效。亮/暗/窄桌面等待截图已复核：只有约22.5px身体和三枚小光点，10秒前没有文字，慢等待操作为小型低强调文本按钮。构建 index-CZMeDsWc.js / index-B3KwzcsA.css。diff-only Review no findings，用户三次反馈全部在同一组件/样式路径落实，无新增抽象/依赖或应用重载；发布前再次 fetch 整合最新 master（其它任务的 favicon/发布交付记录不属本任务变更）。


修订3上线与收尾：既有 pnpm deploy:pages 发布成功；源码包含 670ca14（单缺口/去眼睛）、8d749ab（轻量等待）与最新主线整合73d2620，gh-pages=32e0858c75eb26f26b5f13252cabb844b85cf2f2，前一版f215ff8b630296db2b4289df6699ca0937b6eab2保留作回退依据。默认gemigo.io及实际Chrome均消费index-CZMeDsWc.js/index-B3KwzcsA.css；线上与本地JS SHA256=186aa8747ebe2945817ee531d7c1a7aa90575e906c352d42d5c24b65e47e54d4、CSS SHA256=36f2689e1a17c139d4a9e24468e39e9bec1ac746b523bf834ef84b970ec751f6。

线上真实首页再次打开element：实测SVG不超过80×40、只有三枚光点圆形（无眼睛）、统一polygon嘴部裁剪、无h2/可见等待文案；截图 /tmp/preview-loading-production.png 已核对。实际元素周期表加载后点击氢详情成功；评论/全屏保留iframe，手机真实新窗口访问element.gemigo.app。无HTTPmock/状态注入，仅400ms网络延迟方便观察中间反馈。PL1–PL6当前passed，production证据/tmp/preview-loading-production-evidence.json。

源码精确提交并普通推送；主工作区master快进到73d2620、rev-list=0 0；其它任务analytics脚本及未跟踪文件保留，无暂存或草稿混入。收尾记录继续精确提交并重新fetch/实际远端SHA核对。两次非快进推送按正常merge整合其它任务主线，没有强推；一次提前开始的Pages命令在推送未就绪时停止，确认远端gh-pages仍是原版本后才执行本次成功发布。

retrospective_decision=no-increment：用户反馈已纠正同一视觉owner的形状、五官与注意力强度，必要事实及证据保留在本设计，无通用流程/技能新增价值。retrospective_state=completed，用户视觉偏好仍待反馈。仅前端发布，无Secrets或后台部署；最终diff-only Review no findings。


## 修订 4：应用渲染和操作零额外等待（当前有效）

用户怀疑加载反馈导致变慢，并明确“千万不要增加延时”。bugfix / L2，发布 L4；plan=not-required，retrospective_state=pending。根因复现：完整产品首页卡片打开一个正文/按钮立即返回但图片请求被挂起的跨源网页，DOM 已有可用按钮，旧实现仍为 opacity=0、inert，点击超时；不是网络下载被动画拖慢，而是额外的展示/交互门槛。证据 /tmp/test-preview-no-delay.mjs 修前退出1。此前 load 才揭示与150ms淡入的验收不能满足新硬约束。

唯一修复路径：iframe 从挂载开始始终正常可见、可聚焦、可操作，删除 opacity/inert/aria-hidden 门槛与淡入。小精灵作为指针事件穿透的底层背景置于 iframe 下方；浏览器实际绘制网页时自然覆盖反馈，load 只负责移除背景提示，不决定网页可用性。不加入最低播放时间、延迟显示、就绪轮询或跨源注入协议。初始空白 iframe 透明可显示底层精灵、正文白背景绘制后覆盖，Chrome实际截图 /tmp/preview-behind-wait.png 与 ready.png 已核对。

10秒保留为非阻塞慢提示，放底部小面积区域，只有操作按钮承接点击，其余区域穿透；不再盖住整页或中心正文。原“直接显示应用”改为“收起提示”，仅撤去背景/慢提示并保留焦点交接。重试仍重建 iframe，评论/全屏仍保留节点，旧导航隔离不变。正常状态继续没有可见文案、80×40符号和无眼睛单嘴；透明网页可能短暂透出背景反馈，load 后消失，这是通用跨源背景方案的边界，不为此加入内容探测或等待。

contract-id=preview-loading，scope-revision=4；parent-goal=首页预览等待有轻量反馈，应用内容一绘制就可见可操作，完全不额外等待。PL1 更正为立即显示正常 iframe、背景反馈不阻挡网页，load 仅清理；PL2 直接显示更正为收起提示；PL1–PL5 受行为/构建影响 stale，PL6 视觉未变保留已通过证据。新增 PL7 Required=true / not-run：正文可用但非关键图片仍待下载时，实际按钮能在 load 前点击，iframe 无透明度过渡/隐藏/交互锁；快应用无需播放完整周期。固定条件为相同产品入口、相同受控 HTTP 文档、挂起同一图片请求，修前失败/修后成功，不宣称整体网络提速百分比。真实线上入口同时验证正常应用操作和加载途中 frame 没有门槛。

实施前 mode=design Review：no findings，design-review=passed。反查用户硬约束，应用渲染不再依赖状态或动画；背景反馈不能挡 pointer/keyboard，底部慢提示不阻挡正文主体；快/慢/重试/切换/评论/全屏/主题/减少动态效果/手机继续由同一 owner 回归。只有现有组件、两份 locale、原脚本与本设计变更，无新增路径、状态服务或依赖。MDN [load](https://developer.mozilla.org/en-US/docs/Web/API/Window/load_event) 支持全部依赖资源完成晚于文档可交互的边界；验证不把 load 当首次可用信号。


修订4开发验证：同一个 /tmp/test-preview-no-delay.mjs 修前 opacity=0/inert/不可点击，修后 opacity=1/无inert/可点击，退出0；原 scripts/test-preview-loading.mjs 新增真实卡片到跨源应用的挂起图片回归，连续3次打开在 load 前计数按钮均可操作，10秒慢提示后继续可点。保留完整快应用/慢导航/重试/旧请求隔离/评论全屏节点保留/中英文/主题/减少动态效果/手机回归，全部通过。frontend tsc、组件定向 ESLint、production build、diff-check passed；构建 index-v9NcXinQ.js/index-CvP_PGYz.css。实际截图位于系统 tmpdir（/var/folders/gp/ls0ngf8d1qn97_g1t48670zc0000gn/T/preview-{loading-light,loading-slow,loading-narrow,ready-before-load}.png），已复核：初始小精灵可见、正文绘制后覆盖精灵、慢提示在底部小区域，亮暗/窄桌面无溢出。

implementation Review：no findings。项目无 diff-only maintainability 自动入口，按5文件diff与相邻 iframe/key/ref/焦点/计时边界审查：状态不参与应用可见性或可操作性、无淡入/最短周期、背景穿透；10秒仅决定小型辅助操作、条件计时避免已结束反馈回流。未引入协议、资源预加载、跨源脚本或运行依赖。PL1–PL4/PL6/PL7 current passed，PL5 等待本次源码同步和线上新资产验收；网络本身的总耗时改善未测量，不声称提速比例。


修订4上线和收尾：源码8dcd520已普通推送到origin/master，主工作区master安全快进，原有admin文档/analytics脚本与未跟踪文件保持不动。既有pnpm deploy:pages成功，gh-pages=ccea91d19530f9aee08c550417f2ca5598c672cd（前一版3847c7b保留作回退依据）；仅发布frontend，没有后台/Secrets变化。默认https://gemigo.io实际Chrome使用index-v9NcXinQ.js/index-CvP_PGYz.css，线上/本地SHA256一致：JS05436bfdde492c0e6d4748a261da25c82e803ef762e6cc24fb1a62dd8ee4a5d3，CSS88bc7081a64d841aa83ba488b86a6bb139900479e6ff52ead2a8838c8c1f1a7d。

真实默认首页→element元素周期表→氢详情，全部通过；400ms网络延迟仅用于观测加载中状态，实际iframe始终opacity1、transition0s、无inert/aria-hidden，精灵是底层反馈；评论/全屏保留同一iframe，390px手机真实新标签element.gemigo.app。无HTTPmock/状态注入，证据/tmp/preview-no-delay-production-evidence.json与production.png已核对。PL1–PL7 current passed（PL7的慢非关键资源直接操作由受控浏览器边界证明，不声称真实应用普遍耗时比例）。源码同步rev-list=0 0、实际远端master SHA与本地相等；本记录精确提交后再次同步复查。最终diff-only implementation Review no findings。

retrospective_decision=原owner事实纠正：加载提示的load清理边界与用户可用边界必须分离；旧设计“无最低停留”不足以证明零额外等待。当前组件取消门槛，原设计和原真实浏览器回归均已更新，复用最近owner记录，无必要新增通用规则或平行机制。retrospective_state=completed。已交付默认站点，AI功能与生产验收通过；主观体感待用户反馈，未声称用户验收通过或网络传输本身提速。


## 修订 5：沿用浏览窗口，让旧内容接上新内容（当前有效）

来源：用户指出以前点击不会马上清空旧界面，而当前立即进入加载态让体感变慢，要求尽量减少无内容与变化；“不增加延时”继续是硬约束。bugfix / L2，发布L4；plan=not-required，retrospective_state=pending。调查沿真实首页卡片→useAppPreviewPanel→同一AppPreviewPanel→AppPreviewContent：旧986c73f之前直接iframe src切换、没有key；新增加载组件的app.id+URL key，以及重试attempt key销毁了原浏览窗口，立即回到空about:blank。修订4取消隐藏门槛仍没有纠正这一点。完整产品浏览器修前复现 /tmp/test-preview-continuity-baseline.mjs：A已操作、B文档请求挂起时，原iframe断开，断言失败（exit1）。独立Chrome原生导航实验表明，同一iframe更新src时旧文档在请求期间保留，新文档返回即替换。

用户黄金链路：默认首页打开A并操作→点击B，新请求立即启动而A画面继续保留→浏览器接到B文档直接切换、B先就绪的按钮即可点击（即使非关键图片仍未结束）→评论/全屏保持窗口、关闭返回首页。首次打开没有旧预览时沿用现有极小背景动效；关闭后重新打开不额外缓存或偷偷运行已关闭应用。超慢导航仍可用底部重试/收起提示/新窗口或关闭；用户主动重试仍启动全新导航以恢复卡住的请求，快速A→B→A交给浏览器取消被替代的导航。

brainstorming比较：推荐同一iframe原生src导航（恢复旧交互、单个浏览窗口、零新就绪门槛）；保留两层iframe直到load（会延迟已经可用的新文档、双倍运行任意应用，违背修订4）；旧页面截图占位（跨源截图不可可靠获取，新增资源与陈旧占位）。冻结第一种方案：删除AppPreviewContent app/URL key；iframe attempt key仅保留用于用户主动重试，URL切换不重置attempt；URL变化只重置本地反馈会话，浏览器DOM节点始终复用。会话只有url/status/attempt，timer检查当前会话防旧回调；retry增加attempt并重建iframe，保证卡住的导航有真实恢复出口；普通切换仅更新src。焦点交接、sandbox、手机与preconnect不变，无最低时长、淡入、延迟启动、预加载池或隐藏就绪探测。

scope-revision=5，contract-id=preview-loading。PL1/PL2/PL3/PL4/PL5/PL7受会话变化转stale，PL6视觉继续有效；新增PL8 Required=true / not-run：A已点击计数1，B文档请求挂起时同一iframe保持连接、旧计数仍显示，新导航已开始；释放B文档后立即出现B，图片仍挂起也可点击；经过retry后再次切换仍保留节点/画面；快速切换被取消旧请求不能替代当前内容。固定对比用相同受控HTTP和产品入口，不以总体毫秒或感知量表声称网络提速。真实线上使用400ms网络延迟观测A→B期间节点与旧body保留及B之后的操作。

边界：浏览器一旦提交新HTML，新应用自己的脚本/样式/异步请求仍可能出现空白，当前仅消除我们主动销毁窗口造成的空白，不承诺所有跨源应用没有内部加载。原生请求/文档提交生命周期参考[HTML导航](https://html.spec.whatwg.org/dev/browsing-the-web.html)。失败后页面/错误文档由浏览器接管，load不是成功就绪判断。保持旧内容指旧预览请求期间，首次从列表打开没有旧iframe不延迟右侧展开。

实施前 mode=design Review：no findings，design-review=passed。原用户“少空白/少变化”与零延迟约束同时覆盖；旧→新比较确认原生浏览上下文复用为最近owner，不发明状态池；固定回归覆盖首次/重复/重试后切换/快速切换/取消/旧回调与load前交互。当前范围4文件内（组件/调用方/回归脚本/本设计），不新增组件或公共接口，无计划路径检查需求。没有双frame后台执行或load门槛，旧内容允许继续可见/可操作至原生导航提交，dock沿原行为选中目标应用。


设计返工与复审（实现迭代证据）：Chrome在同一iframe里对正在加载的同一URL重新赋src或location.replace会合并请求；挂起文档的产品回归中retry没有发出新请求，不能替代原恢复出口。故保留显式retry的attempt key，只有用户主动retry重建窗口；普通URL切换保留同一attempt值，尤其覆盖retry后A→B的旧画面保留。用户要求的普通连续切换不增加任何等待，原重试能力也不丢失。上述当前方案已同步，mode=design复审no findings/passed；不加入cache-bust、跨源stop调用、第二iframe或隐藏导航绕路。


验证方法补充：保留旧文档的请求期间，Playwright locator动作会等待新导航，不能用counter.innerText()代替当前页面观测；实际截图/tmp/preview-switch-debug.png明确仍有旧正文与计数1。普通evaluate也可能等新上下文，因此改为对比同一区域的浏览器实际截图PNG（切换前/挂起请求期间完全相等），同时验证新导航请求已发出；不注入/改变页面状态来假造保留效果。


修订5开发验收：scripts/test-preview-loading.mjs完整回归passed；切换前/挂起B文档期间同一预览区域PNG逐字节相等（不是DOM标志推断），/tmp/preview-switch-retains-content.png已核对旧正文与计数1仍显示；释放B后按钮可点。初始重试之后再切换也保留iframe，A→B→A取消旧导航后只显示当前目标；非关键图片未结束前三次打开均可操作，原慢提示/主动重试/焦点交接/布局保留/中英/主题/减少动态效果/手机/preconnect回归通过。设备emulation与主题配置移至独立导航之前，避免浏览器工具等待挂起导航；iframe外层既有布局过渡期间测试点击等待元素稳定（只影响自动化坐标，没有产品延时）。frontend tsc、两组件定向ESLint、build和diff-check passed，产物index-DcgZIxNw.js/index-CvP_PGYz.css。

implementation Review：no findings，项目无diff-only maintainability自动入口，按4文件及相邻预览owner/key/timer/focus审查。浏览器文档生命周期保持单一owner，url仅更新feedback会话，attempt只由显式retry增加；正常切换不能再误重置attempt并销毁浏览窗口。state渲染期只在url不同有限调整当前组件状态，无effect延迟加载或循环；旧timer通过url/attempt/status条件隔离。PL1–PL4/PL6–PL8 current passed，PL5等新主线与线上验收，retrospective_state=pending。


修订5上线与收尾：源码e2632b4经正常merge集成同时发生的产品方向/SEO文档任务后，30d3162普通推送到origin/master；一次非快进拒绝后重新fetch/merge再推送，没有强推。主工作区master安全快进到主线，rev-list=0 0，analytics脚本及未跟踪文件原样保留、暂存区为空。pnpm deploy:pages发布成功，gh-pages=c5561547a432165989c23321ed1b5eb890af6688（前一版ccea91d为回退依据）。只发布frontend，无后台/Secrets变化。

默认https://gemigo.io实际Chrome消费index-DcgZIxNw.js/index-CvP_PGYz.css，线上与本地JS SHA256均2699e22184224d4f4d8a39bbbdc85c423c90ff50b8ea4cfd3ebd7462e55987ab。真实API/应用、无HTTPmock或状态注入：首页element→点击氢详情→点击Geeglo；使用1500ms网络延迟只为观测请求阶段，真实旧页面头部截图PNG与切换前逐字节相等、iframe同一节点，新Geeglo内容接上后非空且不同，回element仍同一窗口；评论/全屏身份保留，390px手机在真实新标签打开element.gemigo.app。最初加载观察用400ms网络延迟，新frame opacity1/transition0s且无inert/aria-hidden。证据/tmp/preview-continuity-production-evidence.json与production-switch.png已核对；截图明确Geeglo请求期间仍显示氢详情而没有加载页。生产实验延迟是网络条件，不是产品增加的时间；没有网络耗时收益百分比或所有应用内部零白屏的承诺。

PL1–PL8 current passed，最终diff-only implementation Review no findings。retrospective_decision=原owner事实更新：取消load展示门槛仍不足以保持视觉连续，普通src导航应保留浏览窗口身份，用户主动重试与URL切换是不同生命周期；本组件、原设计与真实像素回归已同步。无需新增通用规则/预览池/就绪协议，retrospective_state=completed。已交付默认站点、AI线上验收通过，主观顺滑度待用户反馈，不声明用户验收通过。此收尾记录精确提交后再次fetch、主工作区同步及实际远端SHA核对。
