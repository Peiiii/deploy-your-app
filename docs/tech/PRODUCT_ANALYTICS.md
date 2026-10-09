# 产品分析与独立管理站

入口：<https://admin.gemigo.io>。主站账号不能登录管理站。独立管理员账号为 `admin`；初始凭据只保存在部署机器的 `~/.config/gemigo/admin-credentials.json`，不进入 Git。

## 日常使用

- 经营总览：核心指标使用增长 API 的完整7/30个UTC日及上一等长周期，优先成功发布创作者、新注册、新用户发布激活率、应用真人PV；今日独立展示且不参与比较。每日新增注册、成功发布人数与全部应用PV曲线在分析和待办之前，访问图可切官网PV/官网观测UV，绝不将官网UV命名为应用UV。首页复用增长报表类型/曲线/缓存与预算；队列翻页不触发增长重查。新用户激活摘要采用同批注册→有效应用→成功发布，当前/前期分别截至各自期末，激活率差以百分点比较；零样本显示—，不足30人提示谨慎判断。首次/再次以已记录成功历史最早started_at判断且互斥，不称留存；期间与每日人数各自去重，不能累加。CLI/Skill展示成功创作者、成功部署贡献与已结束尝试成功率。累计用户/应用为后置存量；原含今日部署/D1流量诊断折叠展示并明确独立窗口，不替代CF真人PV。增长失败可单独重试，旧数据明确更新时间，不遮掉业务队列。
- 待关注：经营首页派生当前未删除Failed应用，及Building最新尝试started/accepted超过24h（无尝试按updated_at/last_deployed/created_at判断）；历史失败后已Live不进入。当前失败并不表示原URL不可用。未删除open反馈按最早创建展示；各队列每页6条且独立分页，直接进入原详情与反馈处理；无第二套工单状态。
- 信息架构：经营/增长/应用/反馈/用户是五个日常入口；部署记录及原产品分析/事件/预算折入诊断与分析；安全与审计在系统区。受限hash定位既有页面及应用/反馈ID或精确反馈作者，刷新先鉴权；应用详情返回保留该次列表筛选和页码。
- 增长大盘：官网真人 PV、官网观测 UV、每日注册、成功部署、完整 UTC 日 7/30 天及等长周期比较；官网获客/设备（IP主机匿名合并、动态脚本子域合并为来源域）与同新客队列激活，今日未完成日独立展示，每日聚合 CSV。官网与应用流量分别来自 Web Analytics site；visits 不是 UV。UV 仅对已采集 web 页面浏览按匿名 browser ID 去重，30 日留存边界缺失不写零，期间 UV 不把日 UV 相加。
- 图表交互：`time-series-chart.tsx`为经营/增长曲线、部署诊断与事件/观测访客柱图的统一入口和业务输入类型，单个React.lazy边界在图表挂载时加载`time-series-plot.tsx`与ECharts6.1.0。ECharts原生SVG负责坐标/曲线/并排柱、最近日期axis命中、crosshair和axis labels；紧凑HTML提示通过公开position回调按当前点/实际内容尺寸换侧与上下避让，日期轴保留空间，无常驻读数占位栏或图形位移。完整UTC日期/语义单位/同日多指标由业务快照提供，零显示0，缺失“暂无数据”且折线断开。鼠标移入提示可停留，移出/外部/Esc关闭；强制关闭通过公开setOption暂时解除enterable并清原生检查，下次检查恢复，不依赖库私有字段。Tab聚焦后左右/Home/End逐日，坐标showTip可到缺失日，Esc保持焦点。7/30全期响应宽度，轴刻度可稀疏但日期数据完整；手机点选与页面纵滚兼容，拖动结束清提示，取消浏览器整块tap高亮。范围/指标或快照变化注销旧实例与选择，ResizeObserver随容器调整并清理listener/instance。GrowthChart仍只提供标题/指标/单位/脚注，无新增后台查询或统计口径变化。
- CLI 使用：增长大盘内查看 CLI / Skill 统一渠道的部署尝试、占全部尝试比例、去重用户/应用、成功创作者、成功率及每日趋势；7/30完整UTC日与前期，今日独立。依据不可变 `deployment_attempts.client_channel`，不是 ZIP 内容类型。成功率只按已结束尝试（成功+失败+拒绝），各渠道的用户/应用按期间去重且可能跨渠道重叠，不能相加为总数。日表与CSV含CLI/网页尝试。客户端自报渠道说明上传入口，不能证明AI生成；旧服务未带标记默认web，无法猜测回填。
- 反馈管理：私密反馈统一收件箱，分类/状态/关键词搜索与分页；阅读完整讨论、状态 CAS、团队回复、防重复发布及确认软删除。主站作者看到相同处理和回复，其他用户无访问权限；长讨论不静默截断，后台每页 100 条。团队 user_id 保留值 `gemigo-admin-team`，独立后台不创建或冒用客户账号。
- 用户管理：按姓名、邮箱、handle、ID 搜索，查看应用与有效主站会话；确认后撤销主站登录会话。
- 应用管理：搜索、按状态/最近部署渠道筛选、分页，查看首次/最近部署渠道，确认后修改平台公开展示；应用原链接仍可访问。渠道取真实尝试按 started_at,rowid 排序，无历史显示未记录，不冒充应用创建来源。
- 应用详情：显式白名单串联创作者、分类/实际界面语言/公开设置/首次与最近渠道、最近成功上线、不可变部署历史20条分页、7/30天含今日浏览器实际PV、周期UV及每日PV/UV趋势。周期UV按本应用浏览器标识跨日去重，未识别身份计PV不计UV；采集起点前的日期显示—，启用后的空应用显示0。查询与应用所有者页面复用product-analytics的queryAppTraffic owner，schema/采集/清理仍归API repository。作者最近6条反馈不是应用关联（现有反馈无project_id），精确作者筛选可看全部，跳原私密讨论与处理写入。公开性操作复用原CAS/确认/审计。
- 应用存量：集中在应用管理顶部，统计全部未删除应用的总数、上线数、公开/非公开/未记录、公开Live且地址非空、主分类和真实界面语言。分类/语言/公开设置与原搜索/状态/渠道组合筛选；每行显示分类和已记录语言。库存统计保持全局快照，不随列表筛选改变。主分类每应用一次，旧/未知/空归其他；语言只读有效app_language（author/detected），不读介绍翻译/locale，多语言按每种语言去重应用，比例和可超过100%。未知语言单列，不能当作英文；公开null也不能当作非公开。
- 部署记录：按应用/ID、状态、渠道筛选查看不可变尝试、来源、渠道、耗时与错误代码。
- 账号安全：验证当前密码后修改新密码（8–256 字符）；全部管理员会话立即失效，需以新密码登录。
- 操作记录：查看公开性、撤销登录及改密码记录，不保存密码；反馈审计只存操作和回复 ID，不复制私密内容。
- 使用概览：访客、会话、页面浏览、事件趋势、部署结果、来源。
- 功能使用：包括零记录功能；点击功能进入明细。
- 转化与路径：同会话有序漏斗、相邻页面路径。
- 事件明细：日期、设备、登录状态、事件、会话过滤和 CSV（最多 5000 条）。日期按 UTC，单次最多 30 天。
- 采集与预算：关闭采集、修改每日事件预算（100–2000）、查看捎带与补报批次和实际统计读取行数。

数据从上线后积累，不能回填历史。匿名浏览器标识不等于自然人；会话对应浏览器标签页。身份状态是服务器接收批次时的状态。部署完成/失败是浏览器观测，不把缺失结果当失败。Do Not Track、拦截器、关闭页面、队列容量、每日预算都会影响覆盖率。当前版本不做全站精确计费统计。

## 搜索与 AI 获客

入口：<https://admin.gemigo.io/#seo>，复用独立管理账号。`workers/admin/src/acquisition.ts` 投影既有 `product_events`，7/30完整UTC日及今日分开；期间访客按匿名浏览器去重，入口按窗口内每会话首个page_view，有序注册只计同会话入口后的真实新账号。付费UTM、管理员及非web渠道排除。匿名首次来源由原collector会话保存，允许search/ai类别，不存原始来源URL；AI引荐不等于模型引用。

真实邮箱、Google、GitHub新账号由API确认后生成带provider维度的`signup_success`；重登、已有OAuth账号加密码不计。旧无维度注册事件不混入新转化。启用起点由`analytics_settings.acquisition_registration_start`唯一维护，API升级后首次插入当前UTC时间，后续不覆盖，不猜测或回填历史。无配置时注册/转化显示不可测；上线前入口不进入注册分母。启用命令：

```sql
INSERT OR IGNORE INTO analytics_settings (key,value)
VALUES ('acquisition_registration_start', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
```

缺失明细日期和历史注册在界面/CSV显示空缺；零分母转化率null。搜索/产品分析报表缓存15分钟、无轮询，namespace为acquisition-v3/analytics-v2；经营报表在analytics_settings的growth_report_v5_7/30共享15分钟快照，跨UTC日立即失效，同Worker并发生成合并，CF失败报告也复用避免重复查询。正常查询、筛选、切换日期和导出不设每日/每月读取额度；旧reads日桶仅保留历史，不参与拒绝或猜测退款。增长、搜索、基础分析和明细移除仅服务估算的预检/预留，按成功查询的D1 rows_read记录growth_reads/analysis_reads实际统计成本；不包含鉴权、缓存和管理语句开销，不是Cloudflare全账户账单。经营与分析原日期/指标/留存定义保持。

仅在独立鉴权之后，growth/acquisition/report/events四个读取入口按有效管理会话每UTC分钟最多120个请求做暴力保护；超过返回短暂429及距下一分钟的Retry-After（1–60秒），下一分钟恢复，其它管理会话不受影响。身份复用原adminSessionToken解析，额外cookie不能绕过。此为异常短时频率控制，正常用量不按天累计拒绝。登录/改密/采集原安全限额不变。注册口径起点不是产品分析全部历史的起点。

新增成功发布会话：可测来源入口→API确认的新注册→同会话服务端deployment_accepted→同flow的deployment_attempts为succeeded且web渠道，尝试开始不早于注册、完成早于观察截止。同一会话最多计一次；不新增用户ID，不用浏览器部署成功事件替代。期间截至各自完整UTC日末；今日及按入口日期的日cohort截至查询时点，日行不能累加代替期间。可测分母为0时publishedSessions为null，有分母且无成功才为0；不能表示跨会话新客激活或长期留存。权威为同一gemigo-projects实例中的事件和不可变尝试，不新增数据库绑定。

Search Console展示/点击/CTR/排名尚未通过API接入后台，返回null，不能用主站采样事件代替。站点所有权验证与后台API连接是两个状态，验证成功不能自动把connected改为true。Google搜索的AI概览不能从referrer单独识别；真正引用需站长平台来源证据。公开静态产品事实和metadata由`frontend/seo.mjs`维护，指南示例由`frontend/guide-examples.mjs`维护，安全公开作品/作者/目录投影由`frontend/public-seo.mjs`维护；Pages原始HTML与React复用对应owner；不承诺即时收录、排名或AI引用提升。

### SEO/GEO 优化的效果衡量（2026-10-09）

用户要求每次优化有指标衡量。本段拥有指标定义和现有能力边界，具体版本、基线、检查点和实际值归[原长期事项](../tracks/2026-10-03-search-ai-growth.track.md)及Action证据；不新增第二套增长口径。目标是搜索/AI带来的真实新注册与获得发布价值，实施验收不替代效果。

| 指标 | 定义与数据入口 | 当前可测范围 |
| --- | --- | --- |
| 非品牌搜索展示、点击、CTR | GSC网页报告按指南URL/语言和可见非品牌查询筛选；CTR=点击÷展示，零展示时无比率 | GSC人工读取，未接后台API；品牌gemigo及明确拼写变体单列，隐藏/无法分类查询保留未知，不把站点总数当本页非品牌数 |
| 指南真人PV | CF Web Analytics官网site的指南路径页面浏览，bot=0 | 真人流量唯一权威，可能自适应采样；不把D1匿名访客称真人，不与GSC点击要求一一相等 |
| 搜索/AI指南落地会话S | 获客报表landings中page=guide、source=search或ai的sessions；窗口内该会话首个已采集page_view为指南，付费UTM/admin/非web沿原排除规则 | 两来源分别报告；HTML/ZIP及语言都合并为guide，现有事件不能回填拆分；S是观测会话，不是人数 |
| 新注册会话R与注册率 | 同一guide来源行registeredSessions；注册率=R÷eligibleSessions(E)，只计入口后API确认的新账号 | 启用起点前入口不进入E；重登不算注册，registrations账号数与R会话数分别报告；E=0时率为null |
| 同会话成功发布P及两种率 | 同一guide来源行publishedSessions；入口到成功发布率=P÷E，注册到成功发布率=P÷R | 沿原signup→server deployment_accepted→同flow真实succeeded及截止定义；零分母为null，不代表跨会话激活/留存；既有基础分析的浏览器deployment_success不可替代 |
| 指南→发布页跳转次数 | 基础分析paths中guide → new_project的transitions | 是相邻页面跳转次数、全指南/该报告来源范围、只展示前20条；同会话可多次跳转，不能除以S称开始率，也不能当CTA点击数；未出现在前20不写零 |
| 固定GEO问题引用数/有效回答数 | 固定平台、问题、语言和复查方式，保存实际回答及GemiGo引用URL；报告引用数/N及来源 | 不可用/登录墙不进N；AI引荐和Google AI Beta展示分别报告，不替代引用、不与网页展示相加，不能外推平台总体 |

本次“指南发布承接优化”优先观察R、P以及R/E、P/E；非品牌搜索点击与指南真人PV解释入口量，跳转次数只诊断路径。期待同条件下真实注册/发布增加、入口效率改善；目前没有已测修前转化率，不编造百分比目标或增长幅度。10/10演练通过、首屏可见和source正确只说明实施可用。

首次目标完整UTC后期为2026-10-10—10-16（发布日10-09剔除）；13:16开始明确口径，10-17 09:00 Asia/Shanghai检查实际可得窗口，Google处理延迟不保证全部日期届时可读。前期候选10-02—10-08，仅在同来源/页面/实际覆盖与分母一致时比较；注册追踪10-03中途启用，前期完整7天转化不可假装可比。拿不到同等完整窗口先建立新基线，不计算提升。原10-08文案与10-09入口共变，前后差只描述变化，不隔离因果；HC04原10-16检查保持。

每轮留存来源、实际from/to、生成时间、语言/页面/查询筛选、S/E/R/P、各率及覆盖缺口；率变化用百分点，计数带实际值和前期差值，零基数不算百分比增长，独立期间去重不能累加日UV。有效查询/窗口内确无符合记录才记0；登录、接口、追踪起点、留存或细分不可测均null。已知合成QA访问单列并排除经营结论；不足30个相关分母只描述计数/路径，达到30仍不自动构成统计显著或因果证明。

复查决策：无有效窗口/覆盖先接续原测量依赖；无有效曝光核对发现与查询覆盖；有曝光少点击研究意图/标题；有入口但R/P不足沿真实路径定位并交付下一项改善；同条件多轮改善则保留版本继续验证。两轮完整7天窗口后仍无可用信号，按原事项停滞重评重选入口/内容策略，不无限等待或反复改标题。未取得有效数据时不将Action效果关闭。

维护验证：`pnpm test:seo`覆盖真实Pages/D1/组装API注册链路；`pnpm test:analytics`保护原采集预算与协议。发布顺序为API兼容新来源/注册→首次设置起点→admin→Pages；后续升级保留起点及现有Secrets。

## 免费额度设计

1. 事件只进入内存队列，最大 100 条；优先捎带现有同源 API 请求，每批最多 20 条。
2. 无业务请求时至少间隔 120 秒，跨标签页锁和 localStorage 限制每天最多 6 次独立补报。无 Web Locks 或无法保存预算时不补报。不立即重试，不创建独立配置轮询。
3. 主站现有 Pages 转发层意味着一次补报最多涉及 Pages 与 API 两次 Worker 调用；六次浏览器补报不宣称等于六次 Cloudflare 调用。捎带没有新增 HTTP 请求。
4. 每天最多预留 2000 个事件，每浏览器最多 200。超限整批丢弃；去重和写入失败不会返还预留预算。实际 D1 写入还包括索引、额度行等写放大。
5. SQLite 完成报表聚合，避免把大量数据放入免费 Worker 的 JavaScript 内存/CPU。报表缓存 15 分钟；无自动轮询；正常读取不设每日或每月查询额度，只有独立鉴权后的异常短时请求触发限流。查询仍限最多30天，分页与导出有界，记录成功SQL的实际统计读取量。
6. 每日先把即将删除的事件写入日级聚合，再删除 30 天以前明细；日级聚合保留 90 天。同步清理过期会话、限额、访问去重键，并把超过 24 小时仍在 Building 的项目/部署标记失败。本系统预算不是 Cloudflare 全账户剩余额度。
7. 关闭采集后数据库停止接收事件；浏览器在下次已有请求收到策略后清空队列并停止补报，可通过后续业务请求恢复配置，无额外轮询。

Cloudflare 免费账户的 D1 数据库名额已满，因此使用 `gemigo-projects` 物理实例中的独立分析表。管理 Worker 在独立认证后查询业务表与分析表，不调用主站身份服务、不使用主站 cookie。列表使用显式字段白名单，不返回用户密码哈希、OAuth 凭据或应用源码。管理账号的持久密码权威为 `admin_account`；初始 Secret 只在表为空时初始化，网页改密后不能继续用旧 Secret 登录。

## 维护命令

```sh
pnpm check
pnpm test:analytics
./server/node_modules/.bin/tsx scripts/test-analytics-d1.ts
pnpm build:admin
pnpm deploy:admin
pnpm admin:password
pnpm test:admin
```

日常使用管理站“账号安全”改密。`admin:password` 是运维恢复入口，隐藏输入新密码、更新同一持久账号并撤销所有旧管理会话，不影响主站用户。首次部署使用 `python3 scripts/configure-admin.py --generate` 自动生成高强度密码并保存本地凭据。网页修改后本地初始凭据文件不会自动更新，使用新密码登录并自行保管。不要把 `.dev.vars` 或凭据文件加入 Git。

升级后台先执行 `workers/admin/migrations/0001_admin_console.sql`（仅新增表，不修改旧会话结构），再执行 `pnpm deploy:admin`。管理员会话哈希绑定密码版本，防止改密竞态留下旧有效会话。登录每 IP 每 10 分钟最多尝试 20 次；网页改密不会清除此限额。迁移后不要回退到只验证 Secret 的旧认证版本；故障恢复应保留持久账号及当前认证语义，必要时用运维恢复入口重设密码再部署修正版。

数据库迁移按文件名顺序执行：

```sh
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file packages/product-analytics/migrations/0001.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file packages/product-analytics/migrations/0002_attribution_and_rollups.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/api/wrangler.toml --file workers/api/migrations/0001_customer_analytics_foundation.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/api/wrangler.toml --file workers/api/migrations/0002_privacy_safe_app_traffic.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file workers/admin/migrations/0001_admin_console.sql
```

增长服务的真人流量权威遵守 `skills/gemigo-customer-analytics/references/metric-contract.md`：CF Web Analytics RUM `bot=0`，账号/两个 siteTag 由 admin Worker vars 定义，使用现有后台服务账号的持久 API token，通过 `ANALYTICS_CF_TOKEN` Worker Secret 安装；不得使用短期 Wrangler OAuth、不进入浏览器或 Git。查询固定字段，流量缓存 30 分钟（既有 analytics_settings 命名 key）与报表共享缓存 15 分钟，失效上游明确 stale/last fetched，首次失败指标 null。业务查询不依赖产品事件日预算，删除规模计数预检；实际统计读取量单独记账，短时暴力请求才限流。采样、DNT、预算和留存分别限制指标覆盖；Cloudflare visits 不能被命名为 UV。运营激活只对同一新注册 cohort 计算，截至周期末持有有效应用与该有效应用成功部署。

事件合同与查询公共接口由 `packages/product-analytics` 唯一维护。新增功能时添加语义事件/允许的维度、在具体交互或确认结果处接入，再补充对应测试。禁止直接采集 DOM 文本、搜索词、邮箱、代码、密钥或原始 URL。

生产验收使用现有正常管理员会话，保存非缓存报告的rowsRead与生成时间，重复请求应命中同一快照并不增加统计读取账。真实查询成本正常记录，不按旧reservedReads退款，不清零历史预算；升级namespace会重新生成一次，验证覆盖受影响经营、搜索、基础分析与明细/CSV入口即可。


流量展示对象必须显式命名：官网PV/官网观测UV（官网页面），全部应用PV（独立apps Web Analytics site汇总，不含官网），本应用浏览器PV/周期UV及当日UV（详情仅按该slug查询project_page_views）。官网观测UV不是应用UV；单应用浏览器采集与全应用CF真人流量来源/覆盖不同，不能要求二者数值直接对齐。各应用UV或每日UV不能相加冒充全应用或期间UV；没有跨应用去重的UV不得显示为已有指标。网页标题、图表、今日指标和CSV列名保持同一对象说明。
