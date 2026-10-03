# 应用预览等待体验

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

contract-id=preview-loading；parent-goal=线上点开应用时有品牌反馈、完成即进入应用、慢等待有可用出口；scope-revision=1。

| ID | Required | 可观察判定 | 状态 |
| --- | --- | --- | --- |
| PL1 | true | 真实首页卡片打开慢应用立即有名称/精灵，无初始白屏，load 后可操作且无最低停留 | passed |
| PL2 | true | 10秒慢等待、重试、直接显示、新标签、关闭/切换可用；旧请求隔离 | passed |
| PL3 | true | 评论/全屏不重载应用；暗色、窄桌面、reduced-motion，中英文可读且无溢出；手机保持新标签 | passed |
| PL4 | true | 悬停连接提示有界、不加载应用文档；frontend tsc/定向lint/build与真实浏览器回归通过 | passed |
| PL5 | true | 本任务精确提交、origin/master和主工作区master同步；线上新资产与真实入口验收 | passed |

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
