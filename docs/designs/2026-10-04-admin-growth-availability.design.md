# 经营报表可用性与查询成本修正

## 来源、目标与证据

用户于2026-10-04指出：几乎没有使用后台就提示限额，严重不符合预期；应调查限额是否不合理或查询是否浪费资源。附件为经营首页增长摘要429，基础存量仍正常。本项目全托管授权覆盖修复、精确提交、普通推送、主工作区同步、admin部署及线上验收。flow=bugfix，风险L3/部署L4，retrospective_state=pending；plan:not-required，单批闭环。

生产2026-10-03 UTC桶读取记账993558，剩6442，小于增长查询计数阶段10000的预留，实际查询尚未执行就失败。数据库216用户、783应用（含删除）、657尝试、8153事件。旧版多阶段预留不归还、验收中不能精确归属的预留均会留在桶；没有逐请求历史账，不能把993558当实际读取量，也不能断言全部来自用户或验收。

本地真实D1同规模合成数据：增长7日grossReservation66426，记账44322（含管理余量），耗尽状态返回429。失败基线为`/tmp/gemigo-growth-budget-baseline.mts`断言normal operations must remain available失败。该基准不是生产数据分布或生产账单证明。

## 使用链路与方案

管理员通过原独立账号打开经营首页，看到发布人数、注册、激活率和应用真人PV；切7/30日、进入增长大盘，完整口径和CSV继续可用。所有管理查看不因累计日用量受限，短时暴力请求才限流。刷新/重进在15分钟内复用同一已生成经营快照并显示其原更新时间，过期或跨UTC日重新统计；上游CF失败沿现有stale/null反馈，失败快照也短期复用，避免反复重查。

采用：经营查询归原growth owner，和现有overview/业务列表一样不使用产品事件深度分析的每日拒绝阈值。删除增长的全表规模预检与gross预留，使用实际D1 `rows_read`记录`growth_reads:<UTC日>`诊断账；所有管理员读取不再使用每日百万保护，原采集限额和历史桶保留，不清零、不猜退款。所有经营查询仍为独立鉴权后的固定SQL、7/30日闭集、现有索引与聚合输出。

用现有`analytics_settings`保存7/30日各一份版本化增长快照，15分钟有效且UTC日期必须匹配；替换原growth Cache API的机房局部缓存。增长入口和首页复用同一owner，同Worker同周期并发请求复用正在生成的Promise，完成/失败后释放。不建设通用缓存平台、后台预热或新轮询。缓存版本显式隔离旧响应。

比较：只提高日上限不能区分真实成本与旧预留，仍可能被验收挤占；只让UV变null仍降低正常经营可用性；共享缓存加经营/深度分析边界修正能完整保留指标并直接减少重复读取。代价是经营报表更新时间最多延迟15分钟（CF原30分钟不变），所有管理读取不再由产品事件日桶硬拦，真实成本须可观测。没有新增套餐、付费或账户权限。

成本验收在实现前冻结：相同216/783/657/8153合成负载、7日冷请求，D1聚合读取少于修前44322；热请求不运行业务/事件聚合，不增加growth实际读取账。同Worker同周期并发仅一份聚合；7/30和UTC日切换不误用快照。真实生产新报告保存rowsRead与生成时间，用量不再按reservedReads退款。

## 失败与恢复、owner审计

数据库失败仍显式报错，未成功批次不伪造完整报告或实际成本。CF失败保持原业务报告可用并标识stale/null，不把不可测写零。诊断记账与缓存写入是现有数据库内可恢复写入，不删除用户数据、不修改认证。服务重启后复用D1快照；缓存损坏不接受为当前快照，重新生成并覆盖。未来日期或版本/周期不匹配均不能命中。

owner为`workers/admin/src/growth.ts`；API路由只完成鉴权/传递，不再持有平行growth缓存。budget owner只投影额外诊断桶；前端使用既有日期/缓存提示。删除预检和旧机房缓存，不增加新配置、泛型manager或无消费者接口。深度分析也移除日读取保护，旧历史账保留待原UTC日自然结束。

## Active acceptance ledger

- contract-id: ADMIN-GROWTH-AVAILABILITY-20261004；parent-goal: 所有正常后台查看不因累计日用量受到人为限制；仅异常暴力请求短期限流，查询成本减少且可观测。
- scope-revision: 6；scope-confirmation: authorized-implementation-choice（用户明确纠偏，具体技术方案由全托管授权执行）。

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| GAV01 | true | 旧日桶993558及100万均不能阻断增长/搜索/产品分析/明细/导出，原口径与鉴权保持 | passed | 组装Worker+真实D1证明5类入口在百万旧账下200，另会话热缓存；独立鉴权保持 |
| GAV02 | true | 冷成本低于基线、热/并发避免重复聚合；不同周期/跨日/过期/失败恢复正确 | passed | test-admin-growth：34313 vs 44322；10热请求/12并发；跨日/15分钟/损坏/失败恢复 |
| GAV03 | true | 实际reads可观察，旧预算/客户数据/Secrets/并行改动保持 | passed | 精确diff、tsc/admin+api、ESLint；真实D1精确记账；原子120/min、跨分钟/会话隔离/额外cookie不能绕过 |
| GAV05 | true | 单人正常浏览的边际成本几乎忽略；20次代表查看统计读取≤100万，热增长不重查，无新增付费资源 | passed | 本地真实D1代表20次495683统计reads；生产7/30冷快照22218/27408 reads；官方超额读价折算，不冒充账户账单 |
| GAV04 | true | 精确提交推送、主master同步、部署admin并原生产页面7/30及搜索/事件/CSV成功显示 | partial | 已部署且原经营7/30快照恢复；搜索/事件/CSV完整线上登录流程未验证，Chrome连接不稳定且本地旧凭据失效 |

契约Review：不能以只隐藏提示或抬额度通过；必须有原页面真实新响应、完整数据及成本证据。无必要的新套餐选择、通用账单告警、全仓重构或其它产品需求不进入本任务。

## 用户补充后的有效方案（2026-10-04，修订2）

用户明确：“除非是暴力的那种，否则正常使用应该永远也不会遇到这种限制。”本条替代上文“保留深度分析每日百万保护”的范围选择；旧方案的该约束不再有效。GAV01扩展到全部现有读取，GAV02/GAV03补充真实读取记账、取消旧预留及暴力保护的证据，GAV04扩展到搜索/事件真实入口。

删除所有管理员报表的每日reads预留/拒绝及reset日提示；原历史桶保留但不再参与拒绝。增长、搜索、产品分析、事件明细统一记录已完成SQL实际读取量（growth_reads/analysis_reads），不记录假想gross allowance；去掉只用于估算的规模COUNT。事件总数COUNT服务分页，仍保留。预算页显示实际统计读取量，不再呈现每日百万上限。

资源保护从累计日量改为独立鉴权后4个重查询入口（growth/acquisition/report/events）每个有效管理员会话每UTC分钟最多120次请求：约每秒2次，已明显超过手动页面浏览/筛选/导出；超限仅短暂429，返回Retry-After到下一分钟，正常次日/重复多年查看不积累拒绝条件。复用现有reserve原子计数与已有过期清理，session哈希不保存明文cookie/IP；非管理读取、登录/写入安全/采集限额不变。无全日或全月用户配额。

增长保留共享D1 15分钟缓存和同Worker并发合并；搜索/产品分析复用原15分钟缓存，namespace升级以避免旧reservedReads响应。范围1–30日、SQL聚合、分页50/导出5000及现有留存保持。这些是查询结果边界而非日累计额度。GAV01验证正常筛选及导出在百万旧账下成功；额外暴力测试同一有效会话121次短请求只在最后限流、别的会话可用；跨分钟恢复用固定时钟原子限流边界测试。

方案Review(mode=design，修订2)：用户预期与4个报表producer/owner/HTTP/UI消费者已对账；全部日读取拒绝路径包含events直接reserve，不能遗漏；旧账保留且不退款，实际统计与日请求量区别明确。短期限流按真实频率而非估算扫描，缓存/有界SQL仍节省资源。无未关闭finding，修订2 design-review: passed；旧保留深度日限额的Review结论失效。

## 验证与实现Review（待生产验收）

适用tsc（product-analytics/admin/admin-worker/API）、定向ESLint、admin构建、test:admin、test:analytics、真实D1 acquisition/publication/analytics及组装API注册验证通过。冷成本代表性合成分布与生产实际分开；统计计数不包含数据库所有开销。项目无自动diff-only maintainability检查，采用实际diff Review。

mode=implementation：逐条核对日拒绝移除、4个HTTP保护入口、固定统计口径、实际counter原子更新、缓存单一owner/并发释放/UTC边界、UI预算投影和旧账保护。发现按整个Cookie头生成身份会被额外cookie绕过，已复用认证owner的adminSessionToken并补组装HTTP回归，重验通过。无未关闭finding。GAV04继续not-run，须部署和现有真实管理员页面验收后更新。

## 单人低成本补充（修订3）

用户补充：“我一个人使用的话，它的成本应该几乎忽略不计，不应该很昂贵。”保持修订2的无限日常读取能力，新增GAV05。冻结代表任务为同一管理员15分钟内20次普通浏览/刷新/7↔30/报表/明细/CSV操作；统计查询实际读量累计≤100万（成本门槛，不是产品拒绝额度），缓存命中的经营读取不得重新聚合，不引入新增付费资源/订阅。按Cloudflare官方D1/Workers定价区分新增读写与既有账户固定费用；免费/付费包含额度和全账户其它业务用量不能由本统计诊断推断。

修订3方案Review：复用已实现缓存/删除预检和实际读取counter即可验证，无需另造预算或抬高限额；生产还需按冻结任务取证。GAV05 not-run，其余本地证据保持有效。


## 每日注册展示补充（修订4）

用户补充大盘缺少每日新增注册用户。现状：完整增长大盘已有 registrations 日曲线和每日明细/CSV，经营首页只有期间合计及今日注册，未直接展示每日注册趋势。黄金链路：原登录管理员打开经营总览 → 在趋势区直接看到每日新增注册用户 → 切7/30日查看对应日期和人数 → 进入完整增长大盘查看每日明细或导出CSV。注册使用现有 users.created_at 聚合，全部登录方式的新账号，重复登录不增加注册；完整UTC日与今日进行中仍分开。

复用GrowthSummary现有report.daily与GrowthChart增加独立注册图；保留原发布者和访问图，避免藏进切换菜单。无需新请求、SQL、状态或存储，不改变已有空/加载/错误与周期保护。同步首页缓存文案由遗漏的5分钟修正为真实15分钟。plan:not-required。设计Review：用户目标覆盖，两入口数据owner唯一，无新成本，7/30与零新增日由既有数据链支持；无finding，revision4 design-review:passed。

GAV06 Required：经营首页直接显示每日新增注册用户曲线，7/30周期正确，完整大盘明细/CSV继续可用，无新增后台请求。Status:passed（后台真实渲染7/30图表及明细；下载CSV文件7行逐日注册与生产聚合快照完全一致，注册合计26；不冒充生产登录验收）。


## 交付证据与验收边界（2026-10-04）

已交付源代码b7f33fa（取消累计日拒绝/实际记账/共享缓存/短期暴力保护）、cf2a0e7（首页每日注册图/代表成本测试）、60683bd（所有缓存说明15分钟）。生产首次修复版本fbd739c4-1fb8-4f51-a9c5-9f363aeb6476；每日注册版1f1488cc-d329-4335-8622-09bc1e1233ea。发布产物已通过HTML引用和完整JS字节与本地构建一致检查；最终文案补丁版本cdb5877e-6e3d-4873-888d-763b8d098920，JS /assets/index-CukOZAPo.js与本地构建完整字节一致。

原管理员首页实际显示7日26注册、30日151注册、今日7注册，无旧限额错误；生产共享快照7日22218 reads、30日27408 reads，growth诊断桶49626，旧reads桶仍993558。后台隐藏IAB用部署构建和生产真实聚合快照渲染首页：7/30日注册曲线分别7/30个日期，完整增长入口有逐日新增注册明细。该渲染使用本地session/overview替身，证明UI消费与渲染，不冒充生产登录或经营存量。IAB下载事件等待超时，但随后实际Downloads文件出现，核对7行CSV逐日注册与生产快照一致，证明真实浏览器下载成功；Chrome原页面导航/刷新后内容观察不稳定，不能据地址变化推断完整线上成功。生产匿名4读取入口401正确。旧本地保存凭据一次正常登录401，停止尝试，未改变账号或读取生产会话令牌。

代表负载20操作495683实际统计reads；按[Cloudflare D1官方定价](https://developers.cloudflare.com/d1/platform/pricing/)超出包含额度后的$0.001/百万读取，单次代表任务统计读边际约$0.000496，包含额度内可为0。此值不含会话/限流/缓存诊断和索引写放大、存储、Worker及账户其它业务，不能作为全账户实际账单；未新增数据库、订阅或付费资源。官方当前Free日含500万reads，Paid月含250亿reads；实际套餐和全账户剩余额度没有推断。

实现Review（修订4）：新增图表复用report.daily，无新请求/生命周期，保留原趋势；tsc/admin构建与targeted ESLint通过，真实渲染7/30和明细正确。两个遗漏的旧5分钟说明已统一为15分钟，修正文案后重验构建/静态检查。无未关闭代码finding。仅GAV04上述真实登录验收边界未通过，parent-goal未关闭。

复盘判断：产品成本防护误用了预留扫描量作为正常读取拒绝条件；已在原PRODUCT_ANALYTICS owner更正事实并用真实D1回归保护百万旧桶下正常操作、冷热并发成本及cookie不能绕过暴力限流。无新增通用流程规则；当前结果尚有线上验收缺口，retrospective_state保持pending，交回Validation，不以已发布代替整体完成。


## 官网与应用流量明确分开（修订5）

用户明确官网PV/UV与每个应用自己的PV/UV是不同对象，必须区分。现有producer已独立：growth官网PV来自platform Web Analytics site、官网观测UV来自web page_view匿名浏览器去重；全部应用PV来自另一个apps site；单应用详情按slug查询project_daily_stats的human_views及当日unique_visitors。无需新采集或SQL。用户链路：经营页查看明确标注的官网/全部应用趋势 → 应用管理进入某应用 → 只看该应用的采集PV和当日UV；不把官网观测UV当应用UV，不把各应用或各日UV相加为全平台或期间UV。

仅修正标题、CSV列名、图表标签和来源说明。保留单应用D1诊断与CF RUM headline的区别，不把全应用PV/UV改造成单应用值、不显示虚构全应用UV。范围L1展示/文案，flow=bugfix，skip-reproduction：直接源码证明“产品观测UV”“应用PV”标签对象不明确；替代验证为admin构建/tsc、targeted lint、真实隐藏浏览器渲染与原采集隔离回归。Design Review：来源/消费者和去重范围一致，不改变指标或查询成本，无finding；plan:not-required，revision5 design-review:passed。GAV07 Required：标题/CSV对象明确、单应用仅本应用数据，跨对象UV不可相加；passed。admin构建/tsc与targeted lint通过，assembled Worker+D1应用详情隔离回归通过；隐藏IAB使用生产聚合快照渲染官网UV/全部应用PV及真实下载7行CSV，列名已区分，数据未改。单应用标签沿原同slug查询，未新增请求。实现Review实际diff检查：无新状态/SQL/预算、类型和CSV字段顺序一致、诊断来源与日去重范围保持；无finding。旧GAV04生产登录缺口保持。

修订5复盘：已在原PRODUCT_ANALYTICS知识owner明确三种展示对象与跨对象去重边界，复用既有数据隔离回归，无新增全局方法规则。当前修订可交付；上一修订GAV04生产搜索/事件登录验收缺口继续披露，不将其标为通过。


## 官网与应用均提供PV/UV（修订6，进行中）

用户纠偏：“不仅是要区分，而且都要有”。仅标签的修订5不满足新增有效目标。官网已有CF真人PV及官网浏览器观测周期UV；应用所有者已有浏览器确认PV/跨日UV，但管理员详情仍读历史daily诊断。生产project_page_views与collection起点已有，不新增采集、身份或数据库。当前独立开发切片：管理员应用详情近7/30天同时有本应用浏览器PV、周期UV、每日PV/UV、未识别身份访问数与真实采集覆盖，日期缺历史为null而非0，同应用同浏览器跨日只计一次，另应用不混入。

复用事实owner：browser随机UUID按应用origin保存，gateway用slug+UUID HMAC；不能由现有哈希跨应用识别同人。已向用户异步明确“每应用都有即可”还是“还需跨应用去重总UV”，后者为待定方案，不能把应用UV相加或COUNT app-scoped哈希宣称跨应用独立人数。原官网与全应用CF流量headline继续分别展示。

当前切片设计：将既有analyticsService的浏览器查询/覆盖投影收敛至product-analytics公共queryAppTraffic，API service保留owner/slug解析并复用，admin detail复用同一读取owner。schema/collector/migration/retention保持API repository owner；不在管理员读取里ensure/create schema，不新增订阅或跨应用追踪。传入days/slugs/collection起点/now，API保留原ProjectStats形状。admin详情去除旧daily诊断查询消费者，显示新browser结果，统计实际reads，详情读取纳入原分钟保护。只引入两真实消费者共同需要的窄查询，删除旧同语义查询/投影重复。新文件在packages/product-analytics/src现有查询职责内，项目无planned-path脚本。单批plan:not-required。

方案Review：两消费者同UTC含今日7/30窗口、日期coverage与COUNT DISTINCT保持原合同，历史缺口不伪造；跨应用去重不会由代码默默决定，依赖用户答复。无当前切片finding，revision6 per-app design-review:passed。GAV08 Required：官网PVUV和管理员每个应用周期/每日PVUV可用、跨日去重及应用隔离、缺历史/禁存储明确，原接口owner可回归；not-run。GAV09 全应用UV定义/实现待用户澄清，不以修订5取代。


修订6当前切片验证：product-analytics/admin/admin-worker/API tsc与admin构建、targeted ESLint通过；API dry-run成功。assembled Worker+D1回归覆盖其他应用/机器人/旧服务器诊断排除、同浏览器跨日周期UV=1而每天UV=1、无存储PV计入UV不计、缺历史null、覆盖内空应用0、admin与原owner服务结果完全一致。隐藏IAB走真实本地管理员登录→应用详情，7/30均显示周期PV3/UV1、7/30行明细、历史—、1个未识别浏览量；真实查询及页面消费通过，不冒充生产会话。

实现Review：公共查询同时替换旧API查询/覆盖投影和admin旧daily消费，无平行口径；复用slug解析避免旧url应用错误归属；无schema/采集/Secret变更，详情分钟保护与实际reads诊断保持正常使用不设日量。实际diff无finding。生产发布与鉴权后的线上详情尚待执行；全应用跨应用UV澄清仍pending，不以没有答复推断新识别授权。


修订6切片发布：5f4c6b2已普通推送；API版本27938b50-5bde-45aa-8b23-c28eed7ffe5a、admin版本0ed9213b-4111-443b-a316-b6d26f51bcba。最终线上JS /assets/index-nTFOgyix.js与本地构建完整字节一致（sha256 f3867b8ad3da69f32f7996118878e5ba95da0352579fa2af804a06ff8331ca9a），含官网UV及本应用周期PV/UV。生产浏览器采集起点2026-10-03T05:11:14Z；只读D1核对公开应用33data在当前7天实际采集PV156/UV58，未识别0。此为数据层证据，不冒充生产登录页面截图；没有新采集或跨应用身份。

GAV08本地真实管理员链路/共用owner/类型/部署/产物已验证；生产登录后的详情视觉验收仍unverified，与GAV04同一会话可用性边界。GAV09等用户选定跨应用总UV语义；当前已补齐官网与每个应用PV/UV，未擅自将应用身份汇总宣称跨应用同人去重。复盘增量已修正原PRODUCT_ANALYTICS与应用analytics设计事实，并以真实D1回归保护周期去重/隔离；不新增通用规则。parent保持未关闭直到必要澄清/生产会话验收完成。
