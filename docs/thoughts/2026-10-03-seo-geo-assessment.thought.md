# SEO / GEO 当前水平与优化优先级

评估日期：2026-10-03（Asia/Shanghai）。获客数据观察时点约16:02；今日是未完成日。来源：用户要求评估当前水平、效果与待优化项。本文是实测评估与运营建议，不是冻结的产品定位或执行计划。

## 判断

技术基础已具备，内容获客与GEO仍在起步，搜索增长效果尚未证明。没有真实站长数据、长期引用观察和充分转化样本，不给综合分、排名分或增长承诺。

| 维度 | 当前判断 | 依据与缺口 |
| --- | --- | --- |
| 基础可抓取性 | 本次检查合格 | 公开页原始HTML有正文与独立metadata，双语canonical/hreflang、schema、robots和sitemap可用；不等于已收录 |
| 内容满足具体需求 | 偏弱 | 只有首页、探索、关于、HTML指南、ZIP指南五类公开页；指南有基本步骤，缺可照做的真实作品示例、截图、文件示例与充分故障说明 |
| 作品与创作者发现 | 有明显机会 | 探索页原始HTML只有通用介绍，无作品条目；实际作品依赖客户端加载；公开创作者主页当前noindex、title为GemiGo |
| GEO信息基础 | 已起步 | 有清晰产品能力/边界与公开指南，可供读取；未验证各AI服务真实抓取、答案推荐或引用效果 |
| SEO/GEO经营结果 | 样本少，尚未证明 | 搜索入口少，真实注册跟踪刚启动；搜索展示、点击、排名、AI引用数据缺失 |

## 本次新观察

直接查询生产D1，复用`workers/admin/src/acquisition.ts`原cohort SQL，固定UTC日边界、排除管理员/非web/付费来源，只返回聚合，不读取个人明细：

- 2026-09-26—10-02完整UTC日：搜索8个观测浏览器访客、8个入口会话，入口均为home；没有观测AI入口。注册跟踪起点后可测会话为0，历史注册与转化不可测，不能解释为零注册或0%转化。
- 今日截至观察时点：搜索1个观测访客、1个入口会话、1个可测会话、0个确认新注册；没有观测AI入口。一个未完成日、一个会话不能判断转化能力。
- 注册跟踪起点仍为`2026-10-03T05:43:38.620Z`，即北京时间13:43:38。今天刚上线的基础优化不能用此前完整7日证明效果。

客户分析Skill实际7日查询的Cloudflare Web Analytics `bot=0`：官网2060次页面加载、500 visits；前一等长窗口1100次页面加载、140 visits。应用站点1880次页面加载、1450 visits；前期1470次页面加载、1380 visits。来源为自适应采样估计，visits不命名UV，也不与D1的8个入口会话计算渠道占比。7日全站新注册26、未删除新建项目113；均不是搜索注册归因，不能当SEO效果。

30日20访客/30搜索会话仍引用[首次上线记录](../logs/2026-10-03-seo-geo/README.md)，不是本次新取得的30日报告。

## 页面与外部可见性

线上原始HTML检查：首页双语、探索、关于、两篇指南有各自标题、description、canonical、h1和JSON-LD；robots允许公开路径，禁止API与Worker文件；sitemap含5种路径的10个语言URL，llms目录可下载；未知路径返回404/noindex。公开产品事实不依赖执行React后才能读到。

实际Chrome检查：首页390px文档宽390px，无横向溢出，一个h1，已加载图片都有alt；实际社区作品可展示。点击公开作者进入`/u/:handle`后，已显示作者主标题，但title仍为GemiGo、robots为`noindex, follow`。这是公开发现的范围缺口，不应直接将所有用户主页/作品一律开放收录。

探索页原始HTML链接仅包含通用帮助导航，没有作品或作者链接；客户端作者跳转使用按钮。Google可渲染JavaScript，但对依赖JavaScript或点击才出现的发现路径更需核验。推荐给允许公开且信息充分的作品/作者提供独立可抓取入口与真实`a href`链接，复用公开性规则，避免暴露私有或低质量内容。[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[可抓取链接说明](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)。

本次公开Web搜索返回主页旧版“Free Static Site Hosting”描述，能找到作者的[V2EX介绍](https://www.v2ex.com/t/1191744)与[GitHub项目](https://github.com/Peiiii/deploy-your-app)。这说明存在公开品牌线索，但不是完整索引清单、反链审计、Google排名或AI引用证明。指南未在本次检索结果中出现，不能据此断言未收录；应使用Search Console URL检查。[Google site查询限制](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site)。

PageSpeed公共API返回429，未取得LCP/INP/CLS或Lighthouse结果；手机宽度通过不等于Core Web Vitals通过。Google/Bing已验证站点的实际权限和数据仍未取得，当前后台Search Console connected=false与字段null可由原投影实现核对，不等于判定用户没有站长账号。

## 建议顺序与衡量方式

| 顺序 | 建议动作 | 看什么来判断有效 |
| --- | --- | --- |
| 1 | 核对Google/Bing站点权限、提交/检查sitemap与关键URL，取得查询和页面数据 | 关键URL可索引/收录状态、真实查询、展示与点击；先定位发现或内容问题 |
| 2 | 扩充现有HTML/ZIP指南，增加真实代码/文件示例、步骤截图、运行结果与故障解答；按真实用户问题选2—3个场景试验 | 场景相关查询/点击、对应落地页入口、真实新注册；数量是建议，未验证搜索量 |
| 3 | 研究作品公开详情、作者公开主页及可抓取目录链接，优先复用真实社区已有内容 | 合格公开页收录、相关长尾查询、访问作品或创作者、后续发布；具体公开边界需设计 |
| 4 | 建立固定真实问题的AI答案观察，保存平台/日期/问题/实际答案与引用URL；补充真实案例与可核对事实 | 品牌提及与实际引用分开，跨次变化、AI引荐和注册；小样本只是观察，不能称全网曝光率 |
| 5 | 补性能证据与来源新客→首次成功发布的队列分析 | 字段覆盖、真实体验指标、同一来源新客成功发布人数；全站激活不替代来源激活 |

候选问题可从“如何把HTML互动练习发给别人”“ZIP发布后资源打不开怎么办”起步，都是待研究方向，未声称已有搜索量或已选定客户定位。以[当前方向背景](2026-10-03-app-deployment-direction.thought.md)为约束，不默认Google AI Studio或生产者付费定位，不批量生产空泛文章。

GEO优先提高可读取、可核对的内容与真实案例；Google明确LLMS.txt不改善其搜索/生成式搜索排名，无专属schema捷径。[Google生成式搜索优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。ChatGPT搜索还涉及OAI-SearchBot与其IP访问，当前robots通用allow不能证明真实服务未被WAF阻挡；未检查真实机器人日志，不声称全部AI平台可见。[OpenAI爬虫说明](https://developers.openai.com/api/docs/bots)。

下一次应在取得站长数据、发布一项具体内容试验或累积至少一个完整上线后观察窗口时复查；不足30个转化相关样本时保持谨慎，仍看人数和路径。观察窗口是复查条件，不是保证几天内收录或增长。

## 证据边界与持续入口

CLI首次Web Analytics请求因旧OAuth失败，经Wrangler正常凭据刷新后重试成功；不创建新权限。Wrangler文件模式执行只读SQL返回总读取数而非结果，本次实际cohort数字来自随后直接D1聚合响应，共10510行读取、0行写入；前次批量只读执行28675行读取、0写入。未修改数据、分析预算设置或生产Secrets。手机检查复原浏览器尺寸；不改产品源码或发布产品。

维护进入[搜索与AI获客长期事项](../tracks/2026-10-03-search-ai-growth.track.md)。既有指标口径仍归[产品分析说明](../tech/PRODUCT_ANALYTICS.md)，不新建平行指标系统。本次建议尚未实施。
