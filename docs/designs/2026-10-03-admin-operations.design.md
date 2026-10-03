# 后台经营与处理链路优化

状态：scope11金融图表返工已实现，正在真实页面验证及交付；scope10固定读数栏按用户反馈退场，scope8增长判断与scope7侧栏保持（交付详见原日志）；design-document: required；plan: not-required（同一后台 Worker/UI、单批交付）。上位设计：[独立后台](2026-10-02-admin-console.design.md)。当前合同 scope-revision 11 / ADM-12、ADM-13、ADM-14、ADM-15。原始输入：用户要求整体设计并优化；前序明确增长与运营价值、CLI含Skill、库存整合且不要无限拓展。当前产品方向以 2026-10-03 direction thought 为准，教育/学习与游戏是探索重点，保留所有应用类别。

## 选择与用户价值

采用经营首页 + 应用追溯 + 原反馈处理，收敛已有页面。相比继续增加独立报表，少一次菜单跳转且无需第二套事实；相比仅改导航，补齐从看到问题到查明原因的必要链路。牺牲自动重试/独立工单能力，它们缺少重放输入及现成状态 owner，本次不引入。

首页突出所选7/30天成功发布创作者、首次成功发布创作者、再次成功发布创作者、部署成功率；累计用户/应用与访问也以数字卡置于图表前；所有数字与图表优先于待办（按用户后续纠偏）。首次/再次以最早成功部署 started_at 为历史判定，完成态 succeeded，归属以 deployment_attempts.owner_id；再次指在窗口前已有成功且窗口内再次成功，二者互斥相加等于发布创作者，不称留存率。说明仅覆盖已记录部署历史、窗口包含今日UTC。

待关注区域：当前未删除应用中状态Failed，或Building且最近部署尝试（started_at,rowid倒序）仍started/accepted且超过24小时。没有历史的Building按COALESCE(updated_at,last_deployed,created_at)超时；对齐维护超时阈值。当前Failed不代表URL不可用；展示最新错误代码，不远程探测URL。总数与列表同一SQL谓词，优先卡住再失败，每页6，可分页处理；历史失败后已Live不进队列。反馈只选未软删open，按最早创建排序6条，分页且进入真实讨论，非永久第二任务表。

导航：日常运营保留经营总览、增长大盘、应用管理、反馈管理、用户管理；部署记录/使用概览/功能使用/转化路径/事件/采集预算折入诊断与分析；账号安全/审计在系统区域。旧能力全部保留。使用原生details折叠，无新路由框架。

## 黄金使用链路

1. 管理员以现有密码从admin.gemigo.io登录，看到7天发布指标与待关注总量；切30天获得相同口径。点击异常应用进入详情，看到最新状态与错误、分页部署历史、7/30天每日访问、创作者/语言/分类。可以打开已有URL或确认修改公开设置；成功有反馈、审计，返回应用列表仍保留筛选/页码。部署诊断不会暗中触发重试。空队列明确无需处理；请求错误可重试。
2. 首页点击待处理反馈进入该条讨论，阅读并通过已有状态/团队回复处理；返回总览手动刷新待处理量变更。详情中的创作者反馈只表示同作者，不伪造应用关联。所有讨论复用反馈原写入、幂等/CAS/软删除路径。无可匹配的反馈显示空态。
3. 旧用户从折叠菜单进入部署记录/产品分析/账号安全，原交互继续；电脑和390px手机详情可读，表格内部滚动；应用和反馈可通过受限hash定位，刷新重新鉴权后恢复详情；返回、浏览器后退有正确选中态。登录失败/会话过期保持权限隔离。AI完成构建、测试、发布与线上验收，用户只判断信息布局是否符合运营习惯，不将未回复算主观通过。

## owner 与边界

不迁移DB，不新建运营任务、标签、工单或指标缓存。overview沿现有D1拓展publisher/action投影；新增project detail读取现有projects、users、immutable deployment_attempts、project_daily_stats、community_feedback_posts。详情显式字段白名单，不返回session/hash/输入payload/文件/匿名visitor identity；API复用独立管理员cookie、同源写保护及no-store。

详情部署20条分页，7/30每日D1 human_views/bot_views/unique_visitors零填充，UV只按每日展示，绝不跨日相加；这是已采集应用流量，CF增长首页PV/visits与观测UV口径保持。缺少访问记录明确“未采集到访问”，不声称无人使用。反馈按owner_id查询最近6个未软删标题/状态，跳原讨论，可通过原收件箱按精确作者筛选看全部；该作者筛选是既有listFeedback的窄扩展。

详情公开性操作复用manageOperation CAS与审计，仅在用户确认后变更，取消不写入；409保留提示并允许刷新。已删或不存在应用404不暴露残留详情。URL仅http/https链接，React文本转义。当前密码与用户会话保护，无重置。

hash只定位既有section及project/feedback ID或反馈精确作者，不建全局registry。section是唯一导航owner；Operations内部保留查询/页码，详情返回不重挂列表；Feedback内部保留讨论草稿与列表查询。切不同详情清空旧详情防异步串页；fetch使用active guard。浏览器刷新不恢复非URL筛选草稿，这是显式边界。

## 最小证据与抽象审计

验证真实Worker+D1中首次/再次及历史缺失、同时间rowid排序、历史失败后恢复、超24h、删除排除、分页、白名单、auth401、404/400；UI登录首页→异常详情→历史/访问切换→确认取消/修改→筛选返回、反馈精确跳转/状态处理、折叠菜单、hash刷新/后退、桌面/手机与空错误状态。原admin测试/growth测试、受影响TS/lint、生产canonical聚合对账与真实入口QA；生产只用短时版本绑定QA会话并清理，不改用户密码。

保留最近owner和既有确认/审计；新增详情组件是当前用户真实消费者，首页action数据跟overview同一投影。延后远程健康检测、自动重试、复杂角色、BI建模、营销自动化。避免过小方案只有报表无查明入口，也避免过大方案平行任务状态与未来扩展抽象。

## 方案 Review

mode=design；2026-10-03：从原始用户要求和既有入口独立走查上述三条链路；原能力对账、不可推断AI来源、反馈无应用关联、每日UV不可累加、旧密码保留、24小时阈值、最近attempt排序及无历史边界已明确。无开放选择或findings；design-review: passed，仅适用于上述范围。后续模型变化须回补设计。

## 2026-10-03 首页顺序纠偏

用户明确：“经营总览这里肯定是把各种图表和数据呀，数字这些排在前面呀。”覆盖上文首页布局优先级，改为核心发布指标→累计用户/应用/已采集访问数字卡→部署趋势与部署概况→口径说明→待关注应用/待处理反馈。移除前置口号横幅，增长入口保留为紧凑按钮。不新增指标、接口或状态；待办与原详情链路保持。单组件展示层L1、trivial；验收检查桌面/手机DOM与真实布局顺序、7/30切换、数字与接口一致、待办仍能打开详情。复用原验证/Review，受影响布局由本轮复验。

## 同轮侧边栏视觉优化

追加输入：“另外，你这个侧边栏有点难看，要不优化一下吧。”采用轻量浅色导航：复用主站现有紫色品牌标记；统一18px线条SVG图标、44px左右的菜单高度、清晰字体对比与选中背景；日常/系统分组留白稳定，诊断折叠使用明确箭头和子项层级，底部主站入口整齐。相比只调整颜色，消除符号图标混杂；相比更改导航模式，不改原13个入口、hash/选中状态、折叠或手机横向滚动行为，不增加收起模式/菜单状态。纯展示改动L1，仍为trivial；文件角色为admin/src/sidebar-icon.tsx的现有菜单SVG展示，唯一消费者App，不加依赖。原生details与button键盘行为保持，SVG aria-hidden、菜单aria-current，字体/图标/hover/focus真实渲染验收。Design轻量自审覆盖现有入口/移动滚动/无新owner，无findings，按现有授权直接实现，不新增确认门。


## 2026-10-03 经营判断优化（scope8，Implemented / production verified）

原始输入：用户询问首页关注信息与排序，AI建议成功发布人数、新用户激活、应用真人访问、复用、CLI贡献、异常反馈；用户回复“可以，那你来优化一下吧”。本批采用已建议的最小完整改进，不新增运营模块。flow=standard，风险L3（Worker报表投影与UI），发布L4；plan:not-required，retrospective_state:completed（证据见原日志）。

黄金链路：管理员沿原登录进入经营总览→默认7天→四卡看到成功发布人数/新注册/成功发布激活率/应用真人PV及上一等长周期比较→查看每日发布人数与应用访问曲线→查看同批注册→有效应用→成功发布，以及首次/再次和CLI贡献→切30天核对日期与数字→增长大盘查完整日表/CSV→回首页查看现有异常应用和反馈并进入原处理。今日是进行中，独立显示且不进入完整周期比较。桌面和手机均先数字、图表，再分析与待办。

候选：在overview复制CF/队列SQL会造成两个增长owner；把整个Growth页嵌入首页会重复大量报表。采用现有growth API/cache/budget为完整周期唯一owner，添加成功发布人数当前/上一期/每日去重、上一期注册队列和CLI成功发布人数；前端抽出原报表类型/格式工具及原曲线，供两页消费。overview保持累计存量与实时异常队列、原包含今日诊断；其诊断明确独立窗口并折叠，避免混入核心周期。首页增长请求独立于队列分页，刷新及7/30切换才重读；请求失败显示重试和明确旧数据状态，不让错误吞掉待办。无CF时PV显示—/断线，业务仍可看，旧CF缓存披露时间。cache schema升版避免旧字段缺失。

不变量：首期/再次以已记录成功历史的MIN(started_at)判定，期间去重与每日去重不能累加；pending不进结束尝试成功率；CLI/Skill合并且不证明AI来源；同一注册队列以其各自期末判定，并非固定7日成熟留存。激活率比较用百分点，无注册时—；上期零不能算无限增长。CF应用PV与官网观测UV分别命名，观测UV不冒充应用UV或自然人数。应用PV canonical为CF bot=0，自适应采样，不用D1诊断替代。沿用原权限和当前密码，无迁移、支付、自动重试或新留存模型。

验收：实际Worker+D1覆盖跨期/每日重复owner、无owner、首次与再次、今天排除、零样本、队列期末/删除应用、CLI成功去重、缺失CF/旧缓存/预算；原全量admin测试与类型/lint；真实浏览器7/30、快速切换、刷新、失败重试、队列翻页不重查增长、原增长页/CSV和详情、390px滚动；生产同API数值/日期核对与QA会话清理、普通推送并master同步。

mode=design Review：从用户接受的排序与增量反查主链路，旧后台能力保持，三个核心增量有实际入口；当前/前期队列独立期末与统计时间明确，零/缺失/失败恢复可观察。抽象审计仅复用既有Chart和Report，无平行事实/存储/生命周期；新增文件位于现有admin/src职责域，项目无planned-path preflight。无findings，design-review:passed（scope8）。


## 2026-10-03 图表交互修复（scope9，Implemented / production verified）

原始输入：用户报告图表hover无法看到反馈/点数字，要求参考最佳实践优化并考虑统一可复用组件。flow=bugfix（reproduce），L2共享前端交互，发布L4；design-document:required，plan:not-required，retrospective completed（见原日志）。调查命中growth-chart仅3.5px圆点原生SVG title、app事件柱与operating-summary部署柱原生title，无统一命中/数字状态。修前真实Chrome绘图区hover及键盘均无自定义数值提示。

黄金链路：原账号登录→首页趋势图任意绘图区横移→自动选最近日期、参考线/高亮与日期+指标+单位卡→鼠标移入数值卡保持→Esc关闭→增长大盘同样查看7/30与零/缺失→首页展开部署诊断查看两指标→使用概览事件/访客查看→手机点日期并横滚30日；键盘Tab聚焦图、左右/Home/End选日并自动带到视口、Esc关闭，离焦退出。不改统计口径、接口、账号、权限或报表缓存。

候选：各图独立加提示会留下三套状态/命中；引入图表库能提供很多未使用能力，但现有三处简单日序列无需新增依赖或替换业务报表。采用admin/src/time-series-chart.tsx为日期序列交互与渲染唯一owner，GrowthChart保留既有标题/脚注外壳并适配单指标；部署诊断与事件Trend映射数据到同组件的分组柱模式（明确总尝试含成功，不是堆叠相加）。折线保留缺失断线与零值点，柱零值不伪造最小非零高度。SVG绘图区全宽最近日期命中，参考线/高亮；HTML数值卡在滚动区之外，局部容器内横向限位、不被裁切。日期显示完整UTC日，单位由调用方提供，多指标同日统一显示，缺失写“暂无数据”。小图/30日/手机保留横向滚动。

交互状态仅本图局部选日，日期范围/指标改变时旧选择失效，刷新同日数据更新；鼠标离开图和数值卡且无键盘焦点时关闭，数值卡可hover且不自动计时隐藏。触摸点选保留，外部点按关闭；滑动/取消不拦截页面与横滚，拖动不当点击。键盘焦点显示最近日，方向/Home/End受范围约束，选日自动横滚到可见，Esc不移动焦点也能关闭（hover也支持文档Esc）。SVG保留图像描述；操作区提供键盘说明与aria-describedby，提示role=tooltip/只读不抢焦点，键盘选日有可读数值。

参考主源：[W3C WCAG 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)的可关闭、可hover、持续；[WAI tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)的Escape/焦点描述（APG该模式仍为work in progress，不声明完整无障碍认证）。只参考上游原则，不采用未安装图表库。

架构审计：三个实际消费者共享最近日期/触摸/键盘/缺失/限位边界，新增一个组件有当前收益；保留业务报表owner和GrowthChart外壳，删除两处title-only柱图及退场无消费者旧bar CSS。无registry/context/tooltip全站框架/新依赖。项目无planned-path preflight，新增路径核对同admin/src组件域。模式line/bar仅局部消费，非公开持久协议。

验收：真实Chrome修前/修后同入口，hover点间、首/末日、数值/单位精确、move进tooltip、Escape/leave/焦点、7/30与指标切换清旧值、零与null、不破坏滑动；3个消费者与多指标非相加、390px真实触摸/横滚/键盘带到视口、无根溢出/JS错误；admin tsc/build/lint/diff Review，生产真实三入口验收、保护密码/QA会话与查询预留、精确提交普通推送/master同步。

mode=design Review：用户目标覆盖所有已查日趋势，三处消费者路径完整；仅最近日期选择不新增跨图同步、tooltip无交互控件，不把缺失解释零；横滚和触摸拖动区分/键盘自动可见/切换失效已纳入。本方案无开放findings，design-review:passed（scope9），随后实现。


scope9交付：`4e6e63d`统一组件与三个业务消费者已部署Worker `8e225b64-ab82-441b-ace8-36d3e62057fa`。本地和生产真实Chrome1440×1050/390×844验证hover最近日期/数值单位/保持/关闭、键盘/7与30日切换、折线/分组柱与手机点选和滑动；生产使用概览以真实一天报表核对事件/访客柱，既有7日报表最终也正常加载。统计接口、预算合同、认证与密码未修改；原事实owner与可复跑验收脚本已更新，无全局规则增量。


## 图表数值遮挡纠偏（scope10，Implemented / production verified）

用户附件`codex-clipboard-3019e2f8-a18f-4c87-849e-d2236640397f.png`与原话“这种有点遮挡，感觉体验也不好啊”明确覆盖scope9浮层位置选择。现有HTML提示虽然逃出横滚裁切，但absolute top18仍叠在曲线上，边缘限位检查不能证明趋势可读。flow=bugfix，L2交互/L4发布；skip-reproduction：用户实际截图与当前CSS/DOM直接锁定重叠边界，采用同入口真实页面几何与视觉替代修前运行；不把截图视为其它要求。原ADM06/15受影响，原数据/认证证据保持。

选择固定数值栏，位于绘图区上方且在文档流内。另一个候选是移动浮层避开点，但仍会盖住其它日期曲线；栏下置会增加数字与标题的距离。因此采用上方日期/单位/多指标读数条：未选择时显示选择日期与—占位，按同样的指标行提前保留空间，进入/离开/切日不推移绘图区。桌面日期左、指标右，手机窄宽日期另起一行且指标完整；取消悬浮投影/移动定位，曲线只显示参考线与点/柱高亮。复用现有TimeSeriesChart选择owner、tooltip语义、mouse保持/Esc/keyboard/touch；删除left坐标状态与tooltipLeft函数。无新组件/第三方库/业务请求或报表口径变动。

黄金链路：登录原后台→首页hover不同日→上方数值实时更新且整条曲线与日期轴清晰→移入读数栏保持→Esc/移出恢复占位且绘图区不移动→增长与双指标部署/事件柱同样查看→手机点选/外部关闭/30日横滚与键盘逐日定位。验收增加读数栏与SVG矩形不相交、交互前后SVG的y/高度不变；1440/390/320及单/双指标显示完整、零/缺失、原hover/切换/键盘/touch回归，并实际查看截图而非仅凭坐标宣称美感。生产入口及Git同步按原授权完成，plan:not-required；retrospective completed（证据见原日志）。

mode=design Review：截图原目标是同时读数与看趋势，顶部静态栏覆盖；保留所有读数与关闭路径，空占位明确未选择、不是0/缺失数据。无需新框架或owner，容器几何稳定不依赖数据值，移动端断行只在尺寸边界发生。已有共享组件三个消费者自动统一，无范围扩张；no findings，design-review:passed（scope10）。


scope10交付：`f966b5e` / Worker `b8c2f370-8e3a-43a8-b1cd-1e4752ea3d86`；1440/390/320实际Chrome和截图已验证读数与绘图区分离、进入/退出无位移、单/双指标与原hover/键盘/touch完整。对照用户附件，真实10月2日11人读数移到栏内，整条曲线及轴可见；事实owner更新与本地/生产几何验证保留。无进一步高价值范围内缺口，停止本批视觉迭代；美感仍可由用户反馈，不冒充主观验收。


## 金融图表交互返工（scope11，Design Ready）

用户明确认为scope10固定栏“交互很怪”，要求参考顶级图表库并指出交易/股票软件。scope10体验方案失效，scope9自绘浮层与scope10占位条均退场；完整目标是自然查看日期与数字、趋势仍清楚、鼠标/键盘/手机通用，而不是机械保证整张SVG永无浮层。flow=bugfix，L2 UI/L4发布；skip-reproduction基于用户实际线上评价和现行固定栏源码，原图表统计、账号与处理路径继续保持，ADM06/15 stale。plan:not-required，retrospective pending。

主源核对：TradingView官方[tooltips](https://tradingview.github.io/lightweight-charts/tutorials/how_to/tooltips)区分跟数据点/光标的紧凑浮层，[crosshair](https://tradingview.github.io/lightweight-charts/tutorials/customization/crosshair)说明磁吸读数；[Highcharts Stock](https://www.highcharts.com/docs/stock/understanding-highcharts-stock)和[tooltip](https://www.highcharts.com/docs/chart-concepts/tooltip)说明准线与同日多指标；[Apache ECharts axis](https://echarts.apache.org/handbook/en/concepts/axis/)以及官方TooltipView源码有axis tooltip、edge flip、enterable和公开定位回调；[Recharts Tooltip](https://recharts.github.io/en-US/api/Tooltip/)支持偏移/越界/portal。不是所有库只允许一种提示位置，固定栏也不是必须，但本产品用户已明确不接受该形态。

候选：继续自绘SVG+新定位仍会自维护命中/坐标/自适应与触摸；TradingView Lightweight Charts金融时间序列成熟，但内置无tooltip且现有并排两指标柱仍需额外定制；Recharts声明式适合React，但本批Home/End/缺失日期可编程检查的完整输入适配不如ECharts公开dispatchAction直接；采用Apache ECharts6.1.0模块化core/Line/Bar/Grid/Tooltip/SVG。最小真实Chrome实验已验证原生axis hover可命中null日期与0、axis crosshair随动，showTip(seriesIndex,dataIndex)不能定位null点；改用公开坐标showTip(x,y)后首个缺失日也能读取。该实验只证明机制，正式页面与生产仍必须验收。

黄金链路：现有账号进入首页→直接看到干净趋势，无永久占位读数栏→横移时最近日期竖线/点高亮，横向准线与坐标轴标签辅助读数，紧凑浮层随选择更新→首末日期自动换侧，当前数据点与日期标签保持可见→移入提示保持/Esc关闭→7/30/指标切换清旧值，零和缺失语义保持→增长4曲线/并排部署和事件双指标同样看→手机点选/拖动检查并保留页面纵滚，外部关闭；Tab与左右/Home/End通过原生showTip坐标动作逐日，缺失日期也可到达。

TimeSeriesChart继续是三个消费者的唯一业务适配owner，输入API不变；ECharts负责坐标轴、图形、最近日期命中、准线、高亮、tooltip DOM及生命周期。只适配指标单位/完整UTC日期/null、键盘与外部关闭；定位走ECharts公开position回调，优先当前点侧方，空间不足翻转或上下避让，使用实际内容尺寸与chart边界，不再持久化left或自绘图形。浮层约单行/双行，透明淡阴影，不挡当前选点和日期轴；去掉永久栏与重复操作脚注。7/30全期按可用宽度响应显示，保留所有日期可读，时间轴自动省略部分刻度但不省略数据；原强制480px SVG横滚路径退场，用户仍可读取完整时间窗与触摸逐日检查，页面纵滚保持。此为用户授权的交互替换，不删除指标/日期可达性。ResizeObserver负责resize，effect创建/清理instance及listener，业务快照变化替换后旧选择清空；无新后台查询/权限/SDK/存储或通用插件体系。

验收先复用正式页面和实际响应：null/0/多指标的数字单位、所有首末日/邻日/plot中间命中、准线/axis label、紧凑提示内外hover/关闭/键盘、范围和metric失效；几何判定改为当前点/日期标签清楚、边缘在画布内、图形显示/关闭不移动、闲置无占位栏；1440/390/320全期及点选/滑动/纵滚无根溢出/JS错误。实际看截图/对照附件与官方交互示例，不凭类名或“用了库”宣布体验达标；静态types/build/lint、diff Review及最终生产/QA/Git闭环保持。记录模块化后的真实bundle变化，不为此新增加载框架。

mode=design Review：用户当前指定金融图表常见交互已覆盖，旧读数/缺失/键盘链路逐项保留；缺失日不能用series点动作的反例已试验并选择坐标动作。所有数据仍可访问，响应时间轴替代强制横滚但原指标不减；库负责坐标而非两套图形平行运行，组件仅必要业务适配，初始化/resize/dispose明确。无新状态表或未安装未来图形能力；no findings，design-review:passed（scope11）。


scope11依赖落地补充（Design Review passed）：首个模块化构建gzip265.25KiB，对比原86.82KiB多178.43KiB；登录页不需要图表运行时。采用一个现有React.lazy/Suspense边界：time-series-chart为唯一消费入口/业务输入类型/固定高度加载反馈，time-series-plot为ECharts实例与图形交互owner；模块只在实际图表挂载时加载，不建新loader框架或三个入口各自懒加载。目标目录admin/src现有组件域，无planned-path preflight；新文件有当前3消费者且隔离已测第三方运行时成本。原SVG/定位逻辑完全退场，无并行引擎。单批实现/验证与原验收保持，no findings。
