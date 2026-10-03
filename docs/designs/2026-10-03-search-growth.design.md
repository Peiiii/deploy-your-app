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
