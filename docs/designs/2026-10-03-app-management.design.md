# 应用管理命名与界面重设计

用户在创作者主页改版后提出“仪表盘要不要改成应用管理”“那个界面也升级一下”。采用应用管理，统一重设计 `/dashboard`，不是只改导航字样。flow=standard，风险 L2，plan=not-required；交付授权沿 AGENTS.md 全托管。

## 现状与选择

真实账号有 27 个应用；页面先搜索后竖排大统计，卡片含 draft:/local-static: 内部标识、英文状态、ISO 时间，末尾大块创作推荐。页面任务实际是私有应用管理。API getProjects(scope=mine) 分页 total 是自己的应用总数；project store/manager 是数据与分页 owner，analytics/reaction store 是访问统计与收藏 owner。/dashboard 路由和开发代码名保持稳定，用户可见导航/页标题/跳转提示统一应用管理。

比较：纯作品画廊更适合公开主页，但管理状态与操作优先级低；全表格效率高，手机和少应用场景较弱；选紧凑管理卡片配小封面、状态和固定操作，视觉沿创作者页 brand 紫色、slate、rounded 与明暗主题，不共享公共主页业务卡片。

## 冻结实现

- 简洁品牌头部：应用管理、管理说明、部署应用，下面三项紧凑概览（我的应用总数、已加载应用中上线数、已加载应用近7天访问量）。分页未加载完时显式提示已加载范围，避免把局部汇总/搜索宣称全量；访问统计未就绪/失败用 —，不伪装0。
- 应用区工具栏：全部/已上线/发布中/发布失败/未上线状态筛选及已加载计数；搜索名称、简介、来源与URL，收藏限定自己的应用；原recent/name/status排序改成清晰下拉选择和方向，并纠正已有名称/状态方向与标签不一致的比较逻辑。
- 3/2/1 列按实际内容容器宽度响应。每张卡片使用小封面与名称、应用域名或“尚未发布”、本地化状态、公开/未公开标记、格式化最后发布时间和7天访问。管理入口为键盘可用真实路由链接，访问/复制独立操作。后台内部来源标识从卡片移除，GitHub真实来源链接保留；缺图回退字母封面；复用现有封面URL/恢复hook。
- 状态只用于筛选展示，不改变发布或公开权限。保留收藏过滤；不新增收藏写入或批量删除。移除无关创作推荐与巨大的“新增”占位卡，部署入口保持在页头/真实空态。
- 项目初次加载/失败/空库/搜索无匹配/状态无匹配/收藏空/加载更多失败分别准确反馈，筛选空态提供清空筛选，有页时保留加载更多和原分页owner。图标动作复用 IconButton。
- 目录在 features/dashboard，替换既有页面布局/过滤/卡片，删除不再消费的旧 header/inspiration，重做既有 stat，不新建通用框架。状态归dashboard store；派生筛选排序以单一纯函数承载并做行为测试，无新API、持久化或数据owner。

## 黄金验收

1. 登录从侧栏“应用管理”进入 → 概览和应用状态匹配真实API → 搜索/按状态/收藏筛选 → 清空恢复全部 → 排序方向符合标签 → 管理进入原应用设置；访问和复制不误进设置。
2. 无应用/加载/网络失败时有对应引导、重试；筛选无结果时清空可恢复原列表；分页统计/搜索范围明确，加载更多仍复用 project manager。
3. 320/390px手机、桌面、窄内容容器与明暗主题：无横向溢出，长名称/URL不推挤状态与操作；键盘聚焦可管理、访问、复制。线上页面资源身份对应最终production build。

AI：定向lint、项目tsc-b、筛选排序行为测试、隔离状态UI回放、真实生产账号只读管理/搜索/复制验收；不改动真实用户应用。审美由用户在线判断。

## 方案 Review

mode=design：用户原始目标覆盖命名和界面完整升级；真实mine分页/统计/收藏owner明确，搜索不假称服务器全量；公开画廊与私有管理不混淆状态；加载失败与过滤空态覆盖。分组/搜索/排序/进入设置/访问/复制保留；辅助状态为既有store中局部UI状态，不另建数据库或服务。design-review: passed，无开放finding。

## 实现与验证

替换现有管理页、过滤栏、统计和卡片；状态/排序沿原 dashboard store，纯函数仅承载派生结果。删除无人消费的 header/inspiration；公共主页与管理页保持各自功能边界。源标识不再出现在卡片，未公开展示明确为 unlisted，不暗示访问权限。导航、页标题、部署结果入口和删除提示统一命名，保留 /dashboard 路由。

- `pnpm check`：全项目 lint、tsc-b、域名注册检查通过；`git diff --check` 通过。
- `./server/node_modules/.bin/tsx --tsconfig frontend/tsconfig.app.json scripts/test-app-management.ts`：名称双向/时间双向/状态排序、无效日期、中文简介搜索、关键词空白与大小写、状态与收藏交集、输入不变和完整重置通过。
- 独立 localhost API fixture + Vite 浏览器回放：6 应用四种状态；搜索、状态过滤、收藏过滤、清空、排序、复制后反馈及剪贴板、键盘 Enter 进入管理路由通过。首屏加载失败显示重试且重试恢复；分页失败保留 3 个已加载卡片，部分范围提示准确，下一页合并为6；零应用显示创建入口，统计服务失败时卡片与概览均为 —。
- 1280 桌面三列；900 带侧栏内容容器638px双列；320与390手机单列，document scrollWidth 等于视口宽度。320 中文和英文统计行对齐，长描述/URL不溢出；桌面明暗主题截图核对。浏览器视口 override 未即时生效时使用开发者 CDP 验证实际 innerWidth，完成后清除 override。

## 实现 Review

mode=implementation，基于本任务 diff 与相邻数据合同进行 findings-first 及主观维护性复核。项目无 diff-only maintainability 专用入口，采用手工复核；既有管理分页、统计与收藏 owner 未复制，纯筛选函数测试保护可观察排序合同，图标操作使用统一 IconButton，错误态不冒充空库、不自动无限重试，状态筛选不改变发布数据。发现320px统计标题换行会使数字错位，已统一标签最小高度并隐藏手机装饰图标，重新截图与 DOM 坐标核对。最终 no findings。审美效果留给用户在线判断，未对生产应用执行发布/删除/权限修改操作。

## 线上交付

实现提交 `4a974ae285f7c23e148d715babecfba2450ac66b` 普通推送到 origin/master，主工作区 master 已快进同步，无关分析脚本和未跟踪文档/包未提交。集成当时最新主线后重新执行 `pnpm check` 和筛选行为测试均通过，diff Review 无新 finding。

`pnpm deploy:pages` 成功；Pages 部署 [37098087553](https://github.com/Peiiii/deploy-your-app/actions/runs/37098087553) completed/success。最终 production 资源为 `/assets/index-BKuj5GEZ.js`、`/assets/index-CNGsVJnD.css`；gemigo.io 返回的 HTML 和实际浏览器加载脚本一致。构建保留既有 Crisp 前端配置；构建仅有既有 Browserslist 数据过期和大 chunk 提示。

线上 [应用管理](https://gemigo.io/dashboard) 真实登录账号验收：27 个应用、4 运行中、23 未上线；三列卡片和统计与原 API 对齐。运行中筛选显示4个，搜索“小小怪事”定位唯一应用；访问 href 与复制后剪贴板均为 `https://odd-little-lab.gemigo.app/`，管理链接键盘 Enter 进入原项目详情路由。返回后清除筛选恢复27个。未改动真实应用数据，测试视口已复原，隔离测试服务已关闭。

截图：`/Users/peiwang/.codex/visualizations/2026/10/03/01a0ffe8-b91c-7242-9ef1-721cc0eb46a9/app-management-live.jpg`。剩余边界：错误/空库/分页分支以本地 fixture 覆盖，未在生产制造失败；最终视觉偏好由用户在入口判断。

复盘：命名反映私有管理任务、统计范围随分页明确、手机多语言标签对齐均已落入现有组件与测试，没有需要新增知识 owner 的可复用增量，不另写复盘规则。

## 用户验收返工：参考首页重新组织界面

用户拒绝首版视觉与使用效率，要求多参考首页。原先视觉通过结论不再有效，返回 Design；flow=standard、L2，沿同一记录返工。首页真实页面与 ExploreAppCardView 的有效参考是16:9大封面、彩色回退、紧凑正文、圆形搜索/筛选和预览入口。首版问题是大概览占据首屏，80×56封面无法识别应用，卡片域名/简介/范围/日期/数据逐行堆叠，管理操作太低。旧行为测试可保留；新布局/预览/视图切换须重新验证。

本轮设计：删除大渐变概览框，以普通标题、简短说明、创建按钮和一行低权重统计呈现；搜索、收藏、排序与网格/列表切换集中在轻工具栏。默认画廊采用首页16:9封面、彩色回退、紧凑名称与描述；状态覆盖在封面角落，范围/日期/访问合并紧凑信息行，管理/访问/复制一直显示。封面有URL时复用首页 useAppPreviewPanel 与 mapProjectsToApps，桌面侧栏预览，手机新标签；无URL封面直接进入原设置，标题和管理始终进入设置。预览显式 closeOnUnmount，避免离开管理仍保留详情。新增列表视图，复用同一卡片数据与操作，以小缩略图/名称+状态/紧凑访问+日期/操作横排，窄屏自动换行，保留同一筛选owner与排序合同。视图只在 dashboard store 中保存内存状态，清除筛选保留用户选择的视图。

质量标准：1. 管理首屏不被概览遮挡，320px可见第一个应用和管理操作；2. 大封面/正文/控件与首页视觉一致，操作能直接辨认；3. 网格适合视觉识别，列表可快速扫读多个应用，预览保留筛选和上下文；4. 真实长名称、无URL、多离线应用、明暗主题与预览窄容器均不溢出；5. 原筛选/排序/空/错误/分页能力保留，未知统计仍用 —。

mode=design Review：原用户目标与纠偏覆盖，复用既有预览/封面/分页owner，不改公开权限或部署行为；默认画廊兼顾首页参照，列表提供管理密度；移动预览的外链行为与首页一致，真实无URL应用仍可管理。design-review: passed。独立本地fixture回放网格/列表/预览、320/390/900/1280与明暗主题；重新执行行为测试、pnpm check与生产构建；上线后真实账号验证。首轮截图检查整体比例和首屏，必要时只修最大剩余差距，审美由用户最终判断。

返工首轮观察：桌面采用大封面后与首页卡片比例一致，列表可见更多应用；手机第一张卡片操作仍偏低。改动：创建入口并入标题行，手机隐藏重复说明，状态沿首页采用单行可横滑筛选。复看：320px首张卡片操作底边由722px降至630px，390px明暗主题和网格/列表无横向溢出。1280三列、900侧栏内容638px双列，预览内容506px仍可筛选/管理，进入详情预览自动关闭。筛选空态清除后保留列表视图；无应用创建引导、加载失败不显示虚假0统计均复验。卡片的GitHub来源入口保留。

返工最终 Review：按当前任务diff手工检查（项目无独立diff-only入口），封面与预览沿首页owner，业务数据仍沿原store；同一卡片只用CSS调整布局，没有平行状态/数据模型；图标动作统一IconButton，链接和封面按钮可键盘操作，布局不依赖点击根div。pnpm check、筛选/排序/视图保留测试、production build通过；暂无开放finding。主线并发升级访问统计，集成后须保留其新数据字段与“已采集”口径，并重验相关证据，不能用旧UI断言覆盖新合同。

主线集成复核：并发 app-analytics 已将 views7d 改为 pageViews，并区分统计周期与采集覆盖。冲突按新字段/7d周期/加载及错误保护整合，概览明确“采集”而非完整访问总量；卡片沿 appAnalytics.observed7d 标签。集成后 pnpm check 和 test-app-management 通过；新版 fixture pageViews=21 的6卡片与概览126对齐，加载过程显示 — 后转为已采集值。上游 test-app-analytics 额外尝试因隔离环境未安装其 Playwright 依赖无法执行，本任务未改动统计服务/采集逻辑，服务端回归沿上游交付证据；本次以浏览器回放验证新统计UI，未将该额外脚本记为通过。新统计口径、两种布局、预览生命周期与旧操作保留复核无开放finding。

## 返工线上交付

实现提交 `376da1a7d15df26ef1303cb8486d1f4f6d50e9d0` 普通推送到 origin/master，主工作区 master 快进同步，未提交并发分析脚本与未跟踪资料。`pnpm deploy:pages` 完成 Published，production HTML 与真实浏览器脚本均为 `/assets/index-qH1uhbdk.js`，样式为 `/assets/index-B59n9eqJ.css`。

线上真实账号：27 应用、4 运行中；1280px三列大封面和列表横排均核对，430px手机无横向溢出。运行中与“小小怪事”搜索组合只显示1个；封面打开首页同款侧栏，真实 iframe 内容加载，筛选与列表选择保留。关闭后复制反馈及剪贴板均正确，管理链接键盘 Enter 进入原项目设置。返回后清除筛选恢复27个，恢复默认卡片视图与浏览器原视口，预览已关闭。验收浏览产生正常采集PV，概览从3到4与卡片3+1对齐，不把测试前数值当固定断言。未更改真实应用配置或权限。

最终截图：`/Users/peiwang/.codex/visualizations/2026/10/03/01a0ffe8-b91c-7242-9ef1-721cc0eb46a9/app-management-home-style-live.jpg`；列表截图 `app-management-home-style-list.jpg` 同目录。隔离测试服务和自建测试标签已关闭。错误/空库等分支沿本地fixture验证，未在生产制造故障；最终审美仍由用户判断。

返工复盘：无溢出和功能可用不足以证明视觉验收；本轮先对照首页完整首屏比例，再按首张卡片操作位置修正移动布局，用户明确否定时回到设计。该过程已记录于同一设计owner，无需另建知识或规则。

## 加载态与速度纠偏（2026-10-03）

用户明确要求取缔进入页面时低质的“加载中”，参考首页，并优化实际加载速度。flow=standard、L3（跨鉴权与只读API响应）、plan=not-required、retrospective_state=pending。最小结果是刷新应用管理时即出现稳定标题/工具栏与同尺寸骨架，登录恢复后直接填充自己的应用，统计不阻挡操作，往返管理不重复请求刚加载的统计。全托管授权包含精确提交、普通推送、主区同步与API/Pages发布。

基线为生产真实27应用、4运行中，430px视口普通缓存刷新：JS结束1004ms，/me 1070–1918ms，mine projects 1923–2830ms，27个stats从2849ms并发至4224ms；3张首屏图请求在列表后，不阻止操作。源码证据：authLoading分支仍返回锁头加载卡；项目加载须等待auth；dashboard每次挂载为每个项目调用单项stats，且返回时无缓存。首页已使用16:9卡片骨架。

选择：仅改骨架不能解决实际串行等待；提前匿名请求mine会制造无效请求与身份竞态；采用现有 /me 的显式 include=projects 可选扩展，复用同一已验证session与 projectService.getProjectsForOwner 首页100，避免额外一次网络往返。普通 /me 响应保持不变；匿名不查项目，扩展项目失败仍返回已恢复身份，前端沿原mine入口重试加载。前端auth只返回响应快照，项目/统计仍交原manager/store；App负责初始化协调，不新增会话缓存或持久化。仅首次dashboard刷新使用扩展，其它入口维持原轻量鉴权。

统计由现有analytics owner增加最多100个ID的owner限定批量读（请求混入其它owner/删除项目统一404），数据库按slug分组读取相同事件、时间/覆盖/UV口径；单项与批量共用组装逻辑，/projects/:id/stats 保留项目详情消费者。Dashboard一批请求替代27个HTTP与重复鉴权/查询，数值仍独立异步展示；manager合并在途批量与60秒内成功同周期结果，切换周期/失败后可重新加载，不缓存错误，不生成假0。

应用管理专属骨架复用真实management-card/grid/list类与首页灰阶脉冲：auth与首次项目阶段为同一页壳、6卡片占位，概要和状态计数占位而非0，工具栏在身份未确认时不可操作；列表视图保持自己的占位结构；加载更多用卡片骨架，文字仅供读屏。登录确认匿名后仍显示真实登录提示，失败仍显示重试，无空库闪烁。

active-contract=app-management-loading-2026-10-03，parent-goal=应用管理加载更快且等待画面与首页统一，scope-revision=2。单阶段交付，采用本设计内等价活账本。

| ID | Required | 合同及验证判定 | Status | 证据 |
| --- | --- | --- | --- | --- |
| AML-1 | true | 慢鉴权/慢列表/分页等待用稳定骨架；无锁头加载大卡、可见加载中文字或假0；320/桌面/暗色/列表无溢出，读屏有状态 | passed | 本地真实浏览器慢鉴权/慢列表/3卡分页回放，320与1280、深色、列表检查 |
| AML-2 | true | 27项目冷启动列表首屏只需1个认证bootstrap往返；统计1次批量请求；同固定800ms RTT模型较旧两次串行至少减少35%列表等待；生产3次正常刷新报告中位数及波动，不能用最佳单次宣称通用倍数 | passed | 固定800ms模型中位数降低50.09%；生产3次新版/旧版数据就绪中位数2567/4337ms，1个bootstrap与1个27-ID stats批量 |
| AML-3 | true | Bootstrap与批量仅返回session自己的未删除项目；匿名/过期/混合owner不能泄露；覆盖/PV/UV/周期与原单项等价，100+分页与失败可恢复 | passed | test-app-management-loading真实Miniflare D1与HTTP route；105应用分页、混合owner/删除/过期/匿名、可选扩展失败 |
| AML-4 | true | 搜索、视图、预览、复制、管理/返回保持；热往返60秒内不重复成功统计，错误可重试、不同周期竞争不覆盖 | passed | manager缓存/过期/失败/在途合并/周期竞争回归，浏览器搜索、列表、键盘管理返回保留且无新增bulk请求 |
| AML-5 | true | 检查与diff Review通过，普通推送并同步主区master，API与Pages线上资源确认及真实账号验收 | passed | pnpm check与实D1/manager回归、人工diff Review；普通推送与主区同步，API与Pages已上线且真实账号通过 |

方案Review(mode=design)：原要求两项均覆盖，性能门以真实27项目与固定RTT共同约束；不把换骨架当速度证据。数据owner复用、session隔离、附加加载失败与批量原子授权明确；新增传输能力只服务当前消费者，未新增后台或持久层；API先于Pages部署可避免版本错配。design-review: passed，无开放finding。抽象审计：保留原manager/endpoint，删除dashboard单项fan-out，新增局部骨架和现有service的批量方法；不建立通用加载框架或缓存数据库。

用户追加“其他里面有…类似的加载中的卡片…统一优化”。scope-revision=2，明确扩展所有当前可达的同类读数据等待画面：项目详情旧居中转圈大卡改为真实头部/标签/表单骨架；首页/探索分页加载文字药丸改为同款卡片骨架，合并重复首页/探索卡片骨架owner；探索全屏初次加载使用作品布局轮廓；最近应用与评论用各自紧凑行骨架；SDK授权恢复身份用按钮轮廓等待。已有创作者主页骨架保留；预览已有品牌动画、超时恢复与读屏状态保留；保存/上传/部署运行中的按钮/业务进度并非空白加载占位，保留真实进度；旧AdminProjects页面已无可达路由，实际后台独立项目且当前无该大卡，不修改不可达遗留或并发管理后台。

新增 AML-6（Required=true，Status=passed）：上述可达页面无泛化“加载中”占位大卡，浅/深主题与窄屏用同一灰阶、圆角、motion-safe骨架基元，延迟回放验证详情/列表/评论/授权可从等待恢复，业务错误与登录/授权按钮不得被骨架遮挡。新增基础Skeleton/LoadingStatus只提供共同样式与读屏状态，布局仍由各页owner承担，不用一个万能页面取代不同内容。scope修订依据为用户直接补充，mode=design复审通过，无开放finding。


加载纠偏实现验证：`pnpm check`（全项目lint、tsc-b、域名登记）、`test-app-management-loading.ts`、原`test-app-management.ts`、`pnpm test:profile-name`、diff whitespace均通过。真实D1统计2次同visitor PV=2/UV=1、bot排除、7/30天点与覆盖、空应用0及未开始采集null均验证。固定800ms网络模型3次旧串行等待1655/1608/1613ms，新bootstrap802/805/810ms，中位数降低50.09%，超过预设35%；这是模型结果，生产耗时另测，不用它宣称线上通用提升。原线上3次数据就绪2730–5412ms、中位数4337ms，原始资源证据在同日loading日志目录。

AML-6 current passed（本地延迟浏览器）：详情320px头部/标签/表单骨架释放后显示真实设置；探索桌面网格与全屏流骨架释放后恢复6作品；最近应用320px三行缩略骨架释放后恢复；评论桌面三行头像/正文骨架释放后显示真实无评论；SDK320px按钮轮廓释放后显示允许/拒绝（未执行授权）。首页与探索共享原16:9结构，分页复用同组件的2/3卡；已有公开主页骨架、品牌预览及发布真实进度保持。role=status保留翻译读屏文本，截图没有可见“加载中”占位。

加载纠偏Review(mode=implementation)：项目无独立diff-only维护性脚本，手工findings-first与跨模块主观复核。鉴权/项目/统计owner与单项详情接口保留，首页与探索重复骨架合并，通用基元只负责共同样式和读屏、不承载页面状态。统计批量必须全量owner匹配；可选身份扩展失败不注销；成功缓存按owner/id/range且失败可重试。已修正“旧同周期批量被中途30d查询废弃后，返回7d仍等待旧批量”竞态，加入新请求替代及旧完成不得删除新在途请求的回归。相关check与测试重验通过，无开放finding。授权恢复只替换等待视觉，不自动同意或改变权限。


## 加载纠偏线上交付

实现`379aae3`与测试初始化补充`da0c368`已普通推送origin/master，主工作区master安全快进，保留无关analyze.sh及未跟踪资料。合入主线时仅app.tsx React导入冲突，同时保留上游useLayoutEffect与本任务useState；其它探索页overlay/SEO/鉴权事件改动自动合并后检查diff与相邻合同。集成后全pnpm check、实D1/批量manager测试、原管理行为测试、profile-name回归和production build通过；新上游analytics启动需要document.referrer，两个直接加载manager的测试补齐最小浏览器启动变量，不改断言。Review无开放finding。

先执行API专属部署，gemigo-api version=`7d78a65d-0044-4379-bacc-74a6d370987f`；再执行仓库pnpm deploy:pages，gh-pages source=`65ef042`，Cloudflare production=`ad6bdaec-bf93-4adc-94eb-b060923931c0` Active。域名真实浏览器消费`/assets/index-C9OzvWaK.js`，与本次生产构建一致；CSS=`index-CgQmOvuR.css`。保留Crisp公共构建配置，未改变生产Secrets或发布其它Worker/Node。

真实账号430px普通缓存刷新3次：首批27应用的数据响应结束5333/2028/2567ms，中位数2567ms；实际可操作卡片在5369/2070/2595ms出现。旧样本数据就绪5412/2730/4337ms，中位数4337ms；本次观测中位数约降低40.8%，但单次区间仍重叠，网络和并发主线产物有变化，不宣称保证提速比例。固定RTT模型提供往返减少证据。源码与线上请求均确认/me?include=projects只有1次，无额外mine列表请求；统计/projects/stats一次包含27ID，无27单项fan-out。最终27应用、4运行中、5采集PV与卡片3+2相符。原始样本与最终请求数量在本节同日日志目录。

线上搜索小小怪事得到1个，列表视图保留，管理链接键盘Enter进入原项目设置，返回保持搜索/列表；成功统计仍只有原1次bulk请求。复制反馈与剪贴板为真实odd-little-lab.gemigo.app地址，清除搜索并恢复默认网格27个；document clientWidth/scrollWidth均430，无溢出。等待画面在延迟本地fixture截图复核，生产不制造故障，不改应用元数据或授权。视口恢复，测试标签关闭，测试服务收尾关闭。截图：同日期visualizations目录app-management-loading-skeleton.jpg（受控慢网络等待）与app-management-loading-live.jpg（生产页面）。

当前AML-1..AML-6全部passed，open-required=none；最小结果、有效证据、线上入口与黄金链路成立，主观视觉偏好待用户反馈。入口https://gemigo.io/dashboard，刷新会先显示内容骨架后填入自己的应用；可按原路径搜索、预览、复制与进入管理。错误/空库/慢网/越权等分支以本地真实HTTP/D1/浏览器验证，不在生产制造异常。

复盘决定：no-increment。等待布局必须对应真实内容、实际串行往返与重复请求需分别验证，已落在当前组件/批量owner及本设计证据，不新建跨项目规则或通用缓存框架。retrospective_state=completed，parent_status=ready-for-completion-check。
