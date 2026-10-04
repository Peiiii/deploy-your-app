# 搜索与 AI 获客优化执行记录

## 关联入口

[合同](../../work/2026-10-03-search-growth/acceptance-contract.md) · [方案](../../designs/2026-10-03-search-growth.design.md) · [当前状态](../../work/2026-10-03-search-growth/current-state.md)

## 原始输入与约束

2026-10-03，用户要求 SEO/GEO 优化，选择“搜索带来的访问和注册”，要求长期关注与评估。在现状评估后明确“那你来搞定，你给你所有的任意的权限，包括浏览器的操作权限”。之后要求在其浏览器打开登录页面。项目全托管 Git/生产交付授权生效；产品定位仍探索，不默认 AI Studio、纯部署服务或收费。

## 过程记录

- 设计前确认现有 SEO 事实 owner、公开 projectFilters 和 publicAuthor 隐私合同。SSR 现状只有静态简介，无作品链接；作者 noindex。
- 最初代理 Chrome 页面账号退出；用户原 Chrome 已登录，2026-10-03 在原窗口打开 GSC 并添加官网前缀属性，下载验证文件。先前“账号都退出”的判断仅适用于代理页面，已纠正，不再要求用户登录。
- mode=design Review：核对输入→SG01–06→方案；修正目录分页与现有前端过滤不一致的候选，改用独立 /catalog 同构展示。通过范围为内容/公开入口/站点验证；指标查询预算细节须补充并 Review 后才实施。尚无实现 Review。

## 交付汇总与复盘

进行中，尚未完整交付。

- SG05 设计返工：typecheck 揭示 admin 只有 ANALYTICS_DB；核查 wrangler 后确认它即 gemigo-projects，同库含事件和部署历史。删除不必要的双DB/分批核验候选，改为原 cohort SQL 内 indexed flow join；没有新增绑定、第三 pass 或500行截断。此处是实现前绑定调查遗漏，已纠正。重新方案 Review：同库复用、成功状态/时间和隐私边界成立；通过。每日按入口日期 cohort，观测截止当前时点；期间按完整UTC日截止，今日分列。

- 主线并发 a648bbf 已增加可分享作品详情。在独立 worktree 以可恢复 stash → FF → 恢复方式集成，仅 seo known-route 联合冲突，保留 /app 和 /catalog。原暂存状态恢复为空，stash 保留作恢复凭据，核对后再删除。补充并 Review 方案后复用该详情 API/manager，使公开目录形成本站可收录作品入口。

- 当前实现验证：pnpm check（lint/typecheck/域名）通过；pnpm test:seo 原始 Pages runtime、注册与获客、同库实际成功归因全部通过；pnpm test:admin 通过；新主线 public app Worker/D1 可见性及投影测试通过。代表 cohort 600事件读取12410行，预算内。运行时回放覆盖索引/404/503/无Cookie/转义/隐藏作品、app与creator。
- 本地 Chrome /catalog 中文页与第二页已实际加载，真实作品/作者/next链接可见。Perplexity 搜索模式、匿名新会话、非品牌问题（固定原文见GEO观察记录），推荐其它工具，10个来源无GemiGo。第二个独立品牌问题被登录墙阻挡，未产生可采信回答，不能记为未引用。
- 代码 Review(mode=implementation)：没有项目 diff-only 自动可维护性入口（已检索脚本/治理规则），采用 findings-first 与主观复核。纠正 app global/profile分支无效重叠；核对新主线owner复用、SQL注册/成功时间、去重预算、撤销no-store、失败503、公开投影转义与原页面互动。检查范围本任务源码及新主线public app边界，无未关闭finding；生产性能与平台验证仍待完成。

- 55fc4c4/dacb5bc 已普通推送主线，官网 gh-pages d711ef2 构建发布，admin Worker 939110bd-8f1b-4b10-8648-5fa364991fb6 已部署，主区本地 master 已快进且0 0，无关WIP保留。
- 线上验收发现 Pages 的 HTML 静态资源 clean-URL 规则让 Google 验证文件与教学示例返回308，而旧 ASSETS fixture没有模拟该规则。已修正：两份明确的公开HTML资产在Worker内部请求clean资产地址，外部原URL返回原文件；fixture增加308/clean-path行为，避免SPA误写或验证重定向。此 finding 在定向验证和生产验收通过前保持未闭合。
- 原用户 Chrome 已登录，但 Mac 随后锁定，native app返回不可自动解锁。已请求用户解锁，仅站长平台UI受阻；浏览器独立页面/HTTP/部署继续。GSC 验证尚未执行，Bing账户未取得，不称全部完成。

- a787429 raw资产修复已通过生产：Google精确.html URL返回200原token，教学HTML精确URL返回200；真实ASSETS重定向fixture/build通过。此代码finding关闭。[线上页面/ZIP](artifacts/public-live.json)记录首页、explore、catalog及page2、具名作者、已有作品详情均200/单title和h1/正确canonical；dashboard noindex、缺失app404/noindex。新样例浏览器交互尚未走通（锁屏/连接受阻）。
- [手机实验](artifacts/mobile-lab.json)：Chrome390×844，当前机器/网络、无节流、3次热加载；LCP548/832/844ms，CLS约0.0037、无横向溢出。没有INP或fieldCWV，不把实验写成真实用户合格或性能提升。[指南截图](artifacts/guide-mobile.jpg)。
- [GEO固定观察](artifacts/geo-observation.md)：非品牌GemiGo0/1；品牌被登录墙挡住。没有新账号/条款操作，不把登录受阻计失败。
- [IndexNow](artifacts/indexnow-submission.json)12URL提交返回202，公开key已正确上线。只是收到请求/等待核验，不是收录或模型引用，也不能替代Bing站点验证。
- SG05生产验收缺口：本地初始admin凭据401，符合网页改密后旧初始Secret失效的现有合同，未重设密码。使用实际queryAcquisition owner与Wrangler生产D1适配器尝试读取，第一次Wrangler stdout非JSON前缀导致解析失败；修正后第二次在聚合预留时429，没有取得新聚合。两次仅成功预留countAllowance各40100，聚合预留未成功；按既有生产验收合同原子扣回本任务80200，reads日桶910670→830470，保护其它预留。7日窗口4487事件所需count40100+aggregate216376仍大于余额169530，停止重试，不绕过日预算。后台真实新字段HTTP/UI与生产成功发布聚合仍未验收。
- 复盘处置：当前父目标未完整验收，返回相应验证/平台环节。仅原地更新PRODUCT_ANALYTICS指标事实和长期track；Pages clean-URL事实已由实际回归fixture保护，没有新增上游全局规则/第二套任务状态，也未配置自动巡检。

- 最终Git收尾：本批仅提交任务文档/证据，普通推送origin/master，再从主工作区fetch与快进。验收以本地master...origin/master为0 0且ls-remote实际SHA一致为准；无关analyze.sh改动和三个未跟踪产物保留。最终Pages生产分支77654ae，源码a787429；本批仅文档不重部署。未闭合SG01/02/05，整体仍进行中。

- 2026-10-03续办：Mac已解锁；Chrome原窗口先发生用户操作冲突，用户确认可暂时独占操作。内置浏览器线上examples/addition.html实际验证2+3输入5正确、4错误、换题清空并聚焦、新题6+2输入8正确；[截图](artifacts/sample-interaction.jpg)，SG02关闭。原Chrome已定位GSC验证dialog；上传准备完成，因浏览器安全规则要求新访问权在动作时确认，已提交准确确认问题，等待回答。

- 续办SG05：原Chrome已有有效admin会话。重新加载当前线上/#seo，实际收到“今日分析查询预算已用完，请缩小范围或明天重试”；不是登录失败。最新admin HTML和272094字节主JS含publishedSessions字段，内置浏览器无会话时正确显示独立登录页。已保存[后台受限截图](artifacts/admin-query-budget.jpg)。核对hashchange订阅和Acquisition挂载发现本次地址导航与随后reload各启动一次7日请求（不是一次）；两个请求均在聚合预留失败前成功countAllowance40100，收尾分两次原子扣回共80200；未成功生成聚合，不虚构新计数，不重设管理员密码。浏览器DevTools仅查看控制台，验收后已关闭。

- GSC验证待提交画面：[ready截图](artifacts/gsc-verification-ready.jpg)。当前只准备完成，尚未验证；用户仅确认可以占用Chrome，新的站点所有权动作确认尚未收到，因此没有将该回答扩大解释为授权。保留原Chrome验证dialog，代理已退出的登录页面不是后续入口。

- 并行主线aec2660按用户要求撤回creator feedback MVP及其后续/app SEO依赖，已合并保留该撤回，不恢复功能。此前“已有作品详情可收录”及原public-live.json中的app200只是历史，当前作品锚点直接指向部署网址。方案相关部分明确superseded；SG03范围未缩减。当前pnpm check和pnpm test:seo通过（含当前/app404/no旧锚点、公开权限和成功归因）；[新生产证据](artifacts/public-after-withdrawal.json)证明主线撤回已线上生效：首页/发现/目录分页/具名作者200、一title/h1、无失效app锚点；撤回app404/noindex。未修改并行任务的源码。

- 2026-10-03本轮续办：用户明确回复“确认”授权Google站点所有权动作。原Chrome重新添加相同https://gemigo.io/前缀后，Google显示“已自动完成所有权验证”，方法HTML文件；随后进入该资源，效果/索引/体验均“正在处理数据，请过1天左右再来查看”。sitemap.xml提交显示[成功回执](artifacts/gsc-sitemap-submitted.jpg)，列表与详情随后显示无法抓取/无法读取，未称抓取或收录成功。10:35 UTC公开HTTP200/application/xml/3277字节，Googlebot UA同样200；robots允许根路径并声明同一sitemap。按[Google官方排错说明](https://support.google.com/webmasters/answer/7451001?hl=en)启动真实URL检查，仍在检索中；普通UA检查不能替代Google抓取结果。
- Google实时测试18:39:25完成，智能手机版：是否允许抓取=是、网页抓取=成功、是否允许编入索引=是；[结果截图](artifacts/gsc-live-fetch.jpg)和[结构化记录](artifacts/gsc-observation.json)。XML无需请求页面索引；未点击该动作。sitemap报告解析状态仍需复查，Live测试通过不等于已解析/已收录。
- Bing在原Chrome打开站长平台、拒绝可选Cookies、选择Google登录后，账号选择页持续空白，刷新一次未恢复；未出现可操作授权/条款，未取得站点权限。原Chrome native控制也间歇无法捕获窗口。未尝试改密/绕过安全。SG01保持partial，SG05日预算不足仍未闭合。仅更新事实文档及证据，不改生产源码、不重复触发预算查询；diff-only检查通过，无文档Review finding。
- 实时测试通过后复查sitemap报告仍无法抓取；再次提交同一sitemap，Google显示“已成功提交站点地图”。停止重复提交，等待Google后续解析；尚未将报告错误认定为已恢复。文档证据已普通推送并同步主工作区；此前收尾实际SHA26d6343、两端0 0，WIP与暂存保持，新增并行清理日志也受保护。

- 用户追问“为什么我看到的都是无法抓取”后，明确纠正状态：GSC报告失败仍未关闭，实时测试成功只证明检索。复查四种UA均200、无跳转、application/xml/3277字节、10个url，XML解析有效。Google实际测试页面的[原文](artifacts/gsc-live-xml-source.jpg)是sitemap XML；详情AX明确内容类型application/xml、HTTP响应200 OK。Cloudflare限定host/path与已验证Search Engine Crawler，识别Googlebot在10:35和10:46 UTC各一次200/XML，区别于本任务模拟UA探测；[结构化诊断](artifacts/sitemap-fetch-diagnostic.json)。适应性抽样记录不证明每次请求，成功HTTP也不证明Google已解析。安全事件本轮窗口未查到记录，但现有Token无权读取具体安全设置（403），未据此关闭或修改防护。报告未给更细原因，根因保持unconfirmed，不认定必然是延迟、低抓取需求或防火墙；没有盲改源码、继续重复提交或触发D1预算。SG01保持partial。
- 本批仅增补诊断证据和现有状态owner，JSON口径、文档链接、diff-only检查通过；人工Review确认模拟UA与已验证爬虫分开，报告与实时测试分开，无未关闭文档finding。适用范围不含源码/部署，未重跑已通过且未受影响的源码测试。精确提交并普通推送后同步主工作区，保留当前并行WIP；整体Required仍SG01/SG05未闭合。

- 用户再次要求继续处理常规sitemap操作。按[Google官方排错](https://support.google.com/webmasters/answer/7451001?hl=en)核对资源前缀与精确URL、格式、robots和真实抓取；扩展Cloudflare窗口至2026-10-02 12:00—10-03 11:41:54 UTC，已验证Googlebot robots两次200/文本、sitemap四次200/XML（含19:17、19:24 Asia/Shanghai新请求）。历史普通Python UA两次sitemap403，其中09:01 UTC安全事件source=bic，但不是Google请求，未关闭防护或认定为根因。Wrangler既有OAuth过期按owner刷新后重试，未新授权；query字段无权读取，删除该维度后取得记录，不匹配具体提交。
- 单次零代码对照：sitemap.xml?fetch-test=20261003返回同一有效XML，Google回执“已成功提交站点地图”，列表两条均无法抓取/0发现；不继续变换地址或重复提交。人工处置报告已尝试打开/刷新，正文未成功读取，安全报告未读取；Chrome控制与截图持续受并行切页/空白干扰，误采到的非本任务图片已丢弃，未作为证据保留。没有源码变更，未将配置已查证写成报告修复。
- 按用户此前长期关注与当前继续托管的要求，创建当前聊天每日09:00 Asia/Shanghai的heartbeat自动化gemigo-ai，ACTIVE；自动化工具创建成功并view核对，调度配置归Codex，不复制脚本/系统cron。续办SG01/SG05和长期SEO/GEO观察；无实质变化安静，有完成/失败性质变化/需用户动作才通知。记录见[结构化官方步骤排查](artifacts/sitemap-official-checklist.json)。本轮仅补证与安排续办，Required范围未缩减，报告失败根因仍未确认，整体继续进行中。
- 收尾真实浏览器操作明确返回Mac已锁屏且无法自动解锁；已请求用户手动解锁，保护既有登录与授权，不尝试自动解锁、改密或绕过安全。人工/安全报告仍未取得，不能把未读到正文称为Google没有处罚，也不将电脑锁屏解释为sitemap报告失败根因。文档/JSON口径、链接及diff review通过，无源码更改或新代码finding。

- 用户解锁后继续：原Chrome实际站点地图列表两条仍无法抓取/0发现；人工处置报告导航/刷新、安全报告导航均未取得可读正文，不推断无处罚或安全问题。Chrome反复切换到其它任务，扩展控制不可用；已请求短暂暂停并行浏览器操作，等待协调，未重复提交sitemap或绕过生产日预算。
- 顺链发现并修正后台搜索报表的Search Console入口：此前硬编码sc-domain:gemigo.io，而当前实际已验证资源是https://gemigo.io/前缀；直接将既有链接指向已验证资源，无新增配置或第二套状态。局部单owner bugfix，直接源码与实际已验证资源锁定原因，skip-reproduction/skip-design（L1惯例链接修正）；验收为目标URL匹配已验证资源、TypeScript与定向lint通过、构建和生产资产包含修正链接。此修正不代表sitemap报告已修复。
- 本次局部修正的定向ESLint、admin tsc --noEmit、build:admin通过，构建JS验证新资源链接且不含旧资源链接；构建仍有既有大chunk提示。项目无自动diff-only maintainability入口，采用实际diff轻量Review：链接与Google已验证资源一致，权限和后台connected状态不变，无未关闭finding；文档/JSON差异检查通过。
- 链接修正09ceaac经合并并行内容研究主线后普通推送，8417f21已同步主工作区master，两端0 0、实际远端SHA核对一致。admin版本32e82c85-3c79-4f17-a038-b37d00b04e7c部署成功；线上根页面及index-DD5Izc6P.js均200，编译产物含已验证URL前缀链接、不含旧domain链接，见现有[结构化证据](artifacts/sitemap-official-checklist.json)。未读取Google报告正文或绕过D1日预算；SG01/SG05继续partial。

- 用户询问后台“今日分析查询预算已用完……重试”及“自己的后台信息为何超预算”。确认应用内共享reads日桶百万上限、三类报表保守两阶段预留，成功或二阶段拒绝均未归还未用额度；不是Cloudflare账单/套餐或Google限制。修前真实D1回归在“unused preflight estimate is released”断言失败，完成复现。补充最近设计SG05读取生命周期并完成design Review，通过后修改共享budget owner及三个现有消费者，不抬高额度、不清零历史、不修改登录/采集限流。
- 修后实际D1：600事件/30日grossReservation161900，记账13211（聚合实际12410）；二阶段拒绝的count预留40100仅记账1301；重复结算、并发预留、未知usage、固定日桶隔离及耗尽不扫描均通过。原注册鉴权、成功发布归因、成长和基础分析回归通过；受影响tsc与定向ESLint通过。当前生产仅诊断单个reads桶，实际读取1行、0写入；2026-10-03桶974608，未篡改历史或在不足预算下反复生成报表。
- 实现Review(mode=implementation)：项目无自动diff-only maintainability入口，按实际diff检查共享预留owner、闭包一次结算、固定日桶、原子条件扣回、未知失败保留及三调用者覆盖，无未关闭finding；源码类型/定向lint、admin构建及适用真实D1回归通过。100行管理余量不是云套餐定价；生产窗口尚无新成功聚合，SG05保持partial。
- 0540f19读取结算修正普通推送后合并并行探索推荐主线，7532581已同步主工作区master，两端0 0、实际远端SHA一致；未发布并行实验/API变更。admin部署版本5f448740-7e56-4b39-ac72-b7a08fee40e8，线上根页面和index-DvMDtNpe.js均200且与已测试本地build字节一致，含预算错误重试隐藏条件；未登录acquisition仍401。生产有效会话下新成功响应/截图尚未获得，当前剩余额度不足，Required SG05仍partial，每日09:00自动续办原验收不变。

- 当时的局部复盘：保守预留必须在已完成且读取量已知的阶段释放余量；不根据未知历史或错误提示清零共享桶。方法由当时真实D1回归保护；10-04取消正常查询累计限额后，此预留方法退为历史，当前事实维护现有PRODUCT_ANALYTICS owner，无新增上游全局规则或并行状态。

## 2026-10-04：对齐正常查询可用性与续办边界

- 对齐主线b2d5616；b7f33fa已取消正常管理员查询的累计日限额，10-03预留结算规则退为历史。当前鉴权、异常短时保护、真实读取诊断与缓存以[后台可用性owner](../../designs/2026-10-04-admin-growth-availability.design.md)及[产品分析说明](../../tech/PRODUCT_ANALYTICS.md)为准；不修改生产源码、密码、采集限额或历史reads记录。最小旧桶查询确认reads:2026-10-04无记录，D1 metadata 0行读/0行写；旧桶不再用于拒绝，不推断流量、成功发布或云账户配额。
- 公开admin根页面与index-nTFOgyix.js均200；主JS SHA256 f3867b8ad3da69f32f7996118878e5ba95da0352579fa2af804a06ff8331ca9a，与当前部署owner记录一致。此为资产证据，不替代生产登录后成功发布报表的HTTP/UI验收。
- 09:01续办时浏览器工具明确Mac锁屏且自动解锁失败，需要手动解锁；已请求用户解锁，保留已有会话。没有重新读取Google/Bing或私有获客报表，没有重复提交sitemap。Google两条报告失败、人工处置/安全正文未读到和Bing权限未取得均为10-03最后观察，今天状态未知。SG01/SG05继续partial，原验收范围不变。
- 更新同一heartbeat自动化gemigo-ai的过时日预算条件，工具确认ACTIVE；既有每日09:00、目标聊天与通知策略保持不变。现有track、current-state、合同及历史设计指针同步当前owner。仅本轮有实际政策变化与用户解锁输入需求，未创建重复日报或平行状态。
- 文档diff-only、相对链接和内容Review通过；纠正历史结算复盘落入新日期章节的问题，当前/历史状态和私有数据未验证边界分开，无未关闭文档finding。仅维护既有事实与调度条件，未触碰源码，不重复运行未受影响的源码测试或部署。
