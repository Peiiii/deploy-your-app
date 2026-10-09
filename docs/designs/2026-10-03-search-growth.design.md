# 搜索与 AI 获客优化

关联：[合同](../work/2026-10-03-search-growth/acceptance-contract.md)、[输入与记录](../logs/2026-10-03-search-growth/README.md)。

## 内容与公开入口（SG02/SG03）

用户从搜索进入中英文指南，下载单文件 HTML 或多文件 ZIP，按现有 HTML/ZIP 发布入口操作，打开生成的网址检查功能。提供一个自主创作的科学互动例子，解释相对路径、构建输出、外部接口与浏览器 Secrets 边界；不引用未经核实的价格或冻结产品定位。

复用 frontend/seo.mjs 作为静态事实与 HTML/head owner。增加一个 public-seo.mjs 负责现有公开 API 的白名单投影和渲染，Pages 与 React 使用同一投影。首页与 explore 用已有匿名 projects/explore 有界分页（12 项），原始 HTML 有直接作品网址及有公开 handle 的具名作者链接；不新建作品数据表或绕过权限的详情 API。作者页沿用 users/:id/profile，只在存在公开 Live 作品及具名 handle 时索引；匿名/空主页保留 noindex，内部 ID 访问规范到公开 handle。字段只输出作品名/描述/网址和公开作者 label/handle，不输出邮箱、源码、配置、内部用户 ID。所有用户文字转义，网址仅 http(s)，不转发请求 Cookie。后台故障返回 503/noindex/retry-after，实际不存在返回 404。动态页 cache no-store，避免撤销公开展示后仍在页面出现。React head 从现有 profile store 读取已加载的数据，不重复请求该详情；页面切换不保留上一作者元数据。公开目录 SSR 不改变现有前端预览/互动行为。

公开目录用分页 next 链接覆盖全部公开作品；查询参数规范页号，canonical 包含目录页号。静态 sitemap 保留原 10 URL，公开作品由可抓取分页链接发现，不将未验证的项目塞进 sitemap。目录分页原始内容与前端 URL 行为需对齐；若前端不支持 URL 页号，则用独立 crawlable 目录路由 /catalog，且提供真实 React 页面同一渲染，首页/explore 链接到目录。采用后者以保护现有筛选预览体验：SSR 首页/explore只展示最新12项，/catalog 明确分页，React /catalog 同 API、同渲染。

## 站长平台与 GEO（SG01/SG04）

官网 HTML 验证文件原样公开；Pages 不把该文件误识别为 SPA 路由。使用用户当前已登录的 GSC 账号添加 https://gemigo.io/ 前缀属性，提交 /sitemap.xml。所有权新授权等动作按 UI 确认政策处理，先准备可审核产物。Bing 优先既有登录/导入；未有账号且涉及条款由用户完成。IndexNow 仅在官方协议与生产 key 文件验证后提交官网公开 URL，结果仅表示请求受理。

GEO 固定品牌事实与非品牌发布需求问题，在真实可用平台中记录回答、是否提及、是否引用和引用 URL。不存在统一 AI 引用率，不将 web search 当 ChatGPT/Perplexity 实验。平台不可用记录 blocked。不把 llms.txt 当效果指标。

## 指标与性能（SG05）

2026-10-04当前查询保护修订：本文件后续涉及累计日限额、预留和结算的规则为历史设计，已被主线b7f33fa替代；正常查询可用性以[当前方案](2026-10-04-admin-growth-availability.design.md)和[指标owner](../tech/PRODUCT_ANALYTICS.md)为准。成功发布的同会话归因、观测截止和真实成功状态合同不变；生产新字段验收仍待完成。

保持原搜索/AI cohort 和注册定义。产品事件不加个人身份：同会话注册后 server deployment_accepted 的 flow_id，连接 PROJECTS_DB.deployment_attempts 的真实 succeeded/finished_at；仅计观测窗口内成功。指标明确为“同会话注册后成功发布的会话”，不称完整新用户激活率，不推断跨设备/跨会话归因。返回缺失配置 null，空观察 0，基线不回填。新增查询需预算、绑定限额与 D1 fixture证明。

性能按同一线上页面/移动尺寸记录浏览器 navigation/resource timing 及可用 LCP/CLS，不从单次实验声称 CWV 合格；字段实验与 Google field 数据分开。实际问题才修正，避免无根据性能改写。

## 验收与实施顺序

1. 上线验证文件并完成 GSC/Bing 流程；其它产品实现同时继续。
2. 公开目录/profile元数据与匿名权限边界，指南及下载样例；实际 Pages runtime 和 React UI 对齐。
3. 归因成功指标，实际 D1 fixture 与管理 UI。
4. GEO/性能真实观察，更新长期 track，完整部署、线上验收与主线同步。

黄金链路：搜索落地指南 → 下载并运行示例 → 发布入口已有流；访客打开目录 → 分页 → 访问作品/具名作者 → 原始 HTML 与浏览器 metadata一致；管理员 SEO/GEO 页面 → 选7/30天 → 看访问/注册/确认成功发布及缺数说明。新内容不改变注册、计费、隐私和原有发布能力。

### SG05 查询冻结与审查补充

原 acquisitionSql CTE 的 converted 增加首个注册时间，cohorts 保留同一注册事实。第三个有界 pass 只读 eligible cohort 注册后 server deployment_accepted 的 distinct session/flow，最多501行；501表示超出500个待核验对，明确 publicationLimitReached、指标 null，不静默截断。PROJECTS_DB 以50个唯一 flow_id 一批读唯一索引，仅接受 succeeded 且 finished_at 不晚于当前窗口截止。期间只算 UTC 完整日截止前成功，今日单列；不会把第二天成功回填到前一天时点。

读预算按事件48倍+1000预留（原两次 pass 32倍），第三 pass与有界业务DB lookup计入实际rowsRead。未配置业务DB或注册追踪未启用为 null。无满足条件的记录且 eligible>0 为0。测试真实两个D1：注册前请求/失败/浏览器假成功/已登录但没注册/CLI/重复flow/跨日完成/超限，核验去重与预算。现有调用者 admin 的 PROJECTS_DB 可复用；不修改 API 埋点与持久化身份模型。

mode=design Review SG05：从已确认用户目标和 acquisition/analytics/deployment repository 核对，真实权限/时间/来源是已有 owner，预算失败不会给假完整数据，无未来配置层。上述补充范围 design-review: passed。

### 生效修订：SG05 同库事实（替代上文双DB候选）

2026-10-03 核对 admin/wrangler.jsonc，ANALYTICS_DB 实际绑定 gemigo-projects，含 product_events 与 deployment_attempts。因此使用原SQL的 materialized bounds/cohorts 与 EXISTS 唯一 flow 索引 join，JSON三个分组直接返回 publishedSessions；无额外绑定、500记录上限、分批或第三 pass。原两次查询48倍+1000预算涵盖成功lookup，真实D1 fixture需验证。每日按入口日期归组并观测到当前查询时点；期间截至今日UTC零点；无可测eligible session为null。此修订保持用户结果，授权内消除无收益模型；design-review: passed（证据见日志）。

### SG03 主线能力更新

并发主线 a648bbf 新增 /app/:id 和匿名 /api/v1/apps/:id 的权限过滤、公开投影及 AppDetailManager。复用该已交付 owner，不新增作品详情模型。publicProjects 保留公开项目的 /app/:id 内链，目录/作者链接到该页面，另提供实际部署网站链接。Pages 匿名调用该详情 API，取得存在的公开 app 才索引和生成 WebPage 元数据；404/非公开内容保留404，网络失败503。React 从 AppDetailManager 同一已加载 app 调用共享 SEO hook，global hook 让出该路由，避免重复请求或元数据相互覆盖。用户内容转义，不展示源码/内部 ownerId。mode=design Review：新主线权威 owner 与黄金链路一致，详情失败/撤销边界可测，新增路径均有当前消费者；design-review: passed。

## 主线撤回后的当前入口（2026-10-03）

并行任务按用户要求在aec2660撤回creator feedback MVP，包含/app详情及依赖API。之前复用/app的集成方案在此部分被替代；本任务保留主线撤回，不恢复该功能。公开目录/首页/发现/作者投影直接指向应用部署网址，作者仍指向/u/handle；符合SG03真实公开作品和作者链接合同，未降低Required标准。已有隐私/分页/失败边界保持；不另造替代详情页。回归以当前源码的pnpm check、pnpm test:seo和线上无失效/app锚点、撤回URL404/noindex为证据。

## 历史：SG05 读取预留结算修订（2026-10-03，已由10-04查询可用性方案替代）

来源：用户看到“今日分析查询预算已用完……重试”，询问为何自己的后台数据也超过预算。调查确定读取预算是应用内每天100万的共享成本保护，不是云账户套餐额度；acquisition/growth/sql-report均先预留count再预留aggregate，成功/二阶段拒绝均保留整笔估算，重试会额外占用count预留。此为共享读取生命周期的缺口，bugfix、L3（发布L4）；保留SG05指标定义与预算上限，plan:not-required，单批完成。

管理员从原后台报表入口查询：成功时看到原有口径数据；查询未完成时不伪造结果。预算不足时显示明确的下一次UTC零点（北京时间08:00）日期，搜索报表不再提供无效重试按钮。过期缓存不回填，现有登录/刷新/7与30日选择保留。明日重新进入按既有预算生成报表；今日未取得成功数据不宣称已验收SG05。

选择在product-analytics/budget已有owner新增受控读取预留：仍原子reserve并受百万限额约束，返回只供本次阶段结算的对象；阶段取得真实D1 meta.rows_read后仅结算一次，原子扣回“本次预留减实际读行与100行管理余量”。重复结算无效，退款不能让桶负数，固定开始日桶防跨UTC日误减。未知/失败阶段保留预留；不退款历史未知查询，不修改采集/登录限流，不提高配额。三个当前读取消费者均复用此owner，count成功即结算，aggregate全成功后结算；保持reservedReads为原始预留上界。未知或超过预留的实际读数不归还，沿用既有保守预算边界。

候选：仅改文案不修记账；提高上限未证明必要且掩盖浪费；所选按完成阶段实际读取释放余量，额外一次有界预算写入，避免平行计费状态。抽象只服务三个已存在消费者，无新表/配置/迁移/后台任务；保留原预算bucket、SQL及真实指标owner。

验证：真实D1复现二阶段拒绝后整个count仍占额；修后同场景只保留实际count+余量；成功结算/重复结算/并发预留/日桶隔离/未知读数/额度耗尽不进入聚合。原cohort/成长/基础报表回归、类型和lint通过；部署及公开资产/生产最小预算诊断，预算不够不重复重试、不清零历史；UI真实浏览器受并行操作限制时注明边界。

mode=design Review：对照用户报表入口、三个现有调用者、原子bucket与D1结果metadata，确认固定桶和一次结算不会释放他人预留；失败未知保守保留、上限与指标不变、无新身份/权限/迁移；上述范围design-review: passed。实现后仍需实际回归与Review。

## 2026-10-08 HTML 指南非品牌获客 Action

来源：用户纠正排查只是Action子步骤；既有GSC只有极小品牌样本，两英文指南已收录，当前需要实际改善已收录入口。当前HTML指南只要求粘贴/在文本编辑器复制，未说明实际已有的“Import .html file / 导入 .html 文件”能力（HtmlSourceForm→deployment.storeActions.handleHtmlFileUpload→file.text写入htmlContent）。这是可控的内容与真实用户入口缺口；不是据极小样本推断SEO故障。

采用最小完整工作项“HTML指南非品牌获客优化”：在现有中英文URL上改写标题/H1/首段，明确把本地HTML变成在线链接的任务；补直接导入文件、无需Git仓库、单文件内嵌资源与ZIP分流的答案；示例下载后优先导入文件，并保留粘贴路径。单一copy owner仍为seo.mjs，样例操作owner为guide-examples.mjs，schema自动取同源标题/描述；不新建页面、不更换URL、不堆关键字、不虚构免费/无需登录/后端能力。不改sitemap或重复索引请求。

SEO方法按当前SEO Skill使用，既有站长/抓取/样例审计有效证据复用，不为文案调整全量审计。2026-10-08核验[Google标题建议](https://developers.google.com/search/docs/appearance/title-link)、[AI功能文档](https://developers.google.com/search/docs/appearance/ai-features)及[Netlify手工部署一手文档](https://docs.netlify.com/manage/projects/add-new-project/)：任务导向标题、可读正文与真实操作为参考；没有搜索量/难度工具证据，不声称该词高流量或保证排名/引用。Google AI文档不要求新增专用AI标记；本次不增加FAQ schema或llms文件。

验收HC01：英文/中文原始HTML与真实渲染均展示新标题、导入步骤、资源分流和发布入口，既有canonical/hreflang/schema/样例/10URL sitemap通过原Pages边界测试。HC02：从指南到部署页面，用实际.html文件导入后输入框含样例内容；这不是新用户注册/线上成功发布经营证据，不为文案变化制造生产应用。HC03：精确提交、主区master同步、沿既有deploy:pages生产发布并以线上HTML/资源hash验收。HC04：实施验收与获客效果分开，实施通过后状态仍“效果待复查”；10-16 09:00为第一效果检查点，实际GSC处理和覆盖未知，以可得完整UTC窗口7天为目标，不写不可测为零。按本页/本地语言、非品牌查询/展示/点击，以及可测同会话注册/成功发布复查，极小样本不算增长。无曝光先核对新版本抓取和查询覆盖；有点击但未转化沿真实漏斗找障碍，而非无限改标题。

standard；局部copy实施风险L1，生产交付按L4边界验证；plan=not-required。本部分设计Review从真实按钮/导入实现核对能力承诺、样例操作、渠道与数据口径，未关闭finding=0，design-review: passed；沿原合同新增子批证据，不将SG01或整体增长标记完成。

## 2026-10-09 指南搜索/AI流量发布承接 Action

用户要求“继续优化”。当前授权含实现、主线同步、部署及生产验收；选完整改善工作项“指南发布承接优化”，而非把复查指标当改善。现状：seo.mjs把指南发布链接放在整篇正文/示例后的页底，且两指南都指向/deploy（中文仅lang参数）；NewDeployment已支持source=html/zip/github并由既有部署manager恢复输入类型，SourceType值为小写，无参数默认HTML。这一入口没有把ZIP指南用户的选择传给发布界面。手机修前发布入口分别位于文档Y=2280/2172px（390×844），ZIP实际落地HTML输入已复现，记录归本批artifact；未知不外推真实流失率。

用户从搜索/AI进入中英文HTML或ZIP指南，开头看到直接发布、下载对应示例及另一文件格式指南；选择发布后进入该格式的既有输入界面，导入文件后看到文件名/内容，再按原登录与发布流程继续。AI验证止于真实输入，避免制造生产注册/应用；已知的服务端成功发布合同不变。阅读正文、底部导航和例子路径仍可使用，顶部/底部发布链接均带相同source及语言；不增加独立部署状态或入口。对应输入选择限定首次/无进行中的发布；原owner在已有登录用户从项目更新返回时恢复草稿、正在部署时保留状态的优先规则不覆盖，源类型仍可由原控件选择。

选开头自然链接，而非只改页底（不解决阅读前操作）或悬浮条（遮挡手机正文且增加状态）。owner仍seo.mjs的SSR/React共享输出；按钮视觉复用现有发布帮助动作样式，index.html补最窄指南作用域；不新增依赖/React组件/埋点/身份，不动标题、canonical、hreflang、schema和sitemap。发布按钮进入既有source参数，下载真实addition.html/zip，跨指南链接明确格式，语言参数安全编码。正文可读与真实内部链接也符合[Google AI文档](https://developers.google.com/search/docs/appearance/ai-features)及[链接文档](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)，不增加AI特供文件/引用保证。

验收GC01：中英文两指南手机390×844首屏可见类型明确的发布操作；CTA有合法href、source和语言，下载与格式切换存在，无横向溢出/焦点问题，保留单H1/原内容及元信息。GC02：每个指南真实点击进入对应HTML/ZIP已选按钮（aria-pressed），HTML导入真实示例内容一致、ZIP选真实示例后显示文件名；手机和桌面、浅深色定向检查；不会自动创建项目/发布/登录。GC03：原Pages组装测试/前端build/定向lint，精确提交推送、主区同步、既有deploy:pages生产环境HTML及构建资产hash核对，实际线上两格式/语言路径验收。GC04：实施通过与效果成立分开，第一效果检查点10-17 09:00，以上线后实际可得完整UTC日目标7天；读取指南的非品牌搜索点击/展示，已有管理员报表的指南→deploy相邻路径、可测注册/同会话服务端成功发布与留存覆盖。缺会话/登录/细分数据保留null，现有来源总体不冒充指南归因，匿名不等于人。未测修前转化不编造提升，10-08文案与本轮入口共同上线区间不能隔离归因。无入口访问先查指南发现；有访问无开始查实际入口路径；有开始无注册/成功沿漏斗核实障碍，继续/调整/停止由证据决定。原HC04 10-16检查保持，但注明入口共变，完整Action未闭合。

standard；实现局部L1、生产交付L4，design-document=required（原文补批次），plan=not-required（一批可闭环）。设计Review从现有source参数/默认HTML、可读链接、输入表单和原权限合同反查Golden链路；无新状态/跨层传播/未实现承诺，首屏与格式类型直接验收；未关闭finding=0，design-review: passed。整体Required SG01及增长效果保持开放。

### GC04 效果衡量落地补充（2026-10-09 13:16）

具体指标归[产品分析效果口径](../tech/PRODUCT_ANALYTICS.md#seogeo-优化的效果衡量2026-10-09)。GSC可按URL/语言读，现有D1把HTML/ZIP及语言合并为guide；获客landings已给出同来源S/E/R/P，直接计算R/E、P/E及P/R，不拿全站summary冒充指南。基础paths只有前20条相邻跳转次数，没有独立guide→deploy会话或CTA点击指标，不算开始率。此为核对真实能力后明确原GC04的可测边界，未缩减Required SG01或宣称结果成立；若后续必须按指南/语言或CTA拆分，按原事件owner新增并验证采集后才从启用点测量，不回填。
