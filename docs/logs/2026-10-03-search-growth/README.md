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
