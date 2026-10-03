# SEO / GEO 与搜索获客指标

原始目标：用户要求“seo 优化。并且最好拥有指标”，选择“搜索带来的访问和注册”，追加“geo 也要优化”。有效设计见 [设计](../../designs/2026-10-03-seo-geo.design.md)，验收状态只在 [合同](../../work/2026-10-03-seo-geo/acceptance-contract.md) 维护。

## 已验证实现

- 公开首页、探索、产品事实与 HTML/ZIP 指南共五种路径，各有英文/简体中文原始 HTML；Vite、Pages Worker 与 React 共用 `frontend/seo.mjs`。逐路由 title、canonical、hreflang、JSON-LD 与可见正文一致；移除无事实支持的评分和不存在的分享图，私有页 noindex、未知页 404；API 和流式转发沿原路径。
- 首次匿名会话来源留在原 sessionStorage，严格域名分类搜索/AI，原事件协议承载，不存原始来源 URL。邮箱和 OAuth 只计服务器确认的新账号，重登与已有账号加密码不计注册；匿名 OAuth 上下文复用十分钟状态 cookie，不参与鉴权。
- 后台复用 D1 与认证，7/30完整UTC日、今日分开，期间 UV 在 SQL 去重；注册转化以同会话先入口后注册且真实跟踪起点后可测会话为分母。缺明细留存、未启用注册和零分母显示缺失，无伪造历史。
- `pnpm test:seo`：真实 Miniflare HTMLRewriter、D1 cohort、组装 API email/Google/GitHub 链路全部通过；涵盖旧cookie、无上下文、无配置、禁采、错误state、注册顺序、多注册会话及预留读额度。
- `pnpm test:analytics`、`pnpm test:admin` 已通过；`pnpm build:admin`、`pnpm check`（lint/全项目类型/域名）通过。构建提示既有前端 chunk 超500k和 Browserslist 数据过期，非本次行为失败。
- IAB 对完整 Pages 本地实例11987验证中文指南、English真实切换、canonical/title/唯一h1及390px手机无横向溢出。

## 实现 Review

Findings：无未关闭问题。审核原目标→公开原始内容→可见指南→来源采集→真实新账号→后台投影→生产交付链路。修正过缺配置时注册文案、空UTM首次来源被覆盖、D1共享类型边界与前端桌面渠道误纳入后，受影响验证已重跑。项目无 diff-only maintainability 专用入口，采用 findings-first 和跨模块主观复核：单一文案owner、既有状态/认证/预算复用，无平行采集或注册数据库。

前提与边界：无可用 Search Console 已验证站点数据；展示/点击/CTR/排名明确 null。AI引荐是访问来源，不能代表被模型引用。GEO按真实可读事实、公开指南与一致结构化信息实现；`llms.txt` 只是附加目录，不承诺搜索采纳。[Google AI指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)；真正Copilot引用观测来自[官方 Bing AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)，本次未接入站长账号。

## 历史参考基线

2026-09-26—10-02完整UTC日，部署前旧事件搜索类别有18次page_view、8会话、8匿名访客；这不是经过新首次入口cohort重算的指标。CF RUM bot=0观测 Google 6 visits、百度1 visit；visits不命名UV，Google登录域和Google Sites不算搜索。真实注册新口径从生产 API 上线后 `analytics_settings.acquisition_registration_start` 首次设置时开始，无历史回填。

## 生产验收（2026-10-03）

- 精确实现提交10dbf69；集成最新主线并普通推送f51b60e；读预算修正31f13c9集成推送f259a19。主workspace正常快进，无stash/强推/reset，无关图表脚本、客户分析脚本及未跟踪文档/包保持。
- API版本`0b34f640-d223-4412-b01c-e2ed86c936bd`；admin最终版本`fdfe2351-54f0-47a8-8ce1-f32edcd1c5c1`；Pages生产部署`d81cd17f-c9e0-455f-a30d-836e7240a4b1`，gh-pages产物SHA`916888a785958dcd171ba30dd1d83675e28711d4`，生产状态success。公开资源`index-eFvIeaL0.js`与admin资源`index-CWBe-KaD.js`核对有效，预算修正后admin前端产物未变。
- gemigo.io十个双语公开URL返回200，原始HTML标题/canonical/hreflang/唯一h1/真实schema与新构建asset均核对；私有页noindex、未知和缺图404、斜杠308、HEAD、XML10条sitemap/llms纯文本/robots sitemap通过。原`/api/v1/me`匿名返回200及`{user:null}`，不是鉴权失败401。
- 生产IAB实际中文HTML指南→English→英文canonical/title/唯一h1通过；admin真实7/30切换、载入过程、实际指标、留存缺口、入口来源表、SearchConsole缺失通过。390px根页面无横向溢出，原管理导航布局沿主线。
- 生产7日（09-26—10-02）搜索8访客/8入口会话；30日实际可覆盖09-04—10-02搜索20访客/30会话，09-03缺失；AI两窗口暂无观测会话，不推断不存在AI引用。注册起点`2026-10-03T05:43:38.620Z`，历史注册与转化不可测显示“—”。
- UI实际CSV下载至Downloads，校验UTF-8 BOM、62条source/day记录、缺留存及历史注册为空、完整日搜索会话合计30，与真实响应对账。IAB download事件等待超时，但文件已实际保存；未将工具通知缺失当产品失败。临时离线真实刷新→失败/重试按钮→恢复联网→重试成功，无残留模拟网络状态。
- 验收前读预留413582；仅精确归还本次7日320520、30日失败计数132100、修正后30日382920，共835540。两次成功实际SQL读取19899与37054，缓存UI不重复预留。最终余额322446，与并发任务独立归还/使用相容；未清零共享额度、未动采集预算。15分钟version绑定QA会话按确切hash删除，原密码版本不变，删除后401；浏览器QA cookie删除，生产Secrets保持，临时本地Pages服务停止。

## 收尾 Review 与复盘

读预算修改后`pnpm check`、真实D1代表负载与所有来源/cohort反例重验通过，admin重新构建部署，30日线上报告及实际UI/CSV再验通过；findings-first复核无未关闭问题。调小专项投影预留没有改通用报表/每日额度/采集预算，测得读取与预留有余量。SearchConsole真实连接仍为明确外部缺口，不伪造指标。

retrospective_decision：已更新原事实owner `docs/tech/PRODUCT_ANALYTICS.md`，补齐首次来源、注册真值及首次启用配置、指标/预算/发布顺序；证据来自实际Worker/D1/线上报表。未新建通用流程或重复知识owner。parent_status=ready-for-completion-check；最终文档提交后再次fresh fetch、实际远程SHA与主workspace 0 0复核。

线上返工：7日生产报告可用，30日按原64倍通用漏斗读预留在已有413582用量下触发429。返回Implementation，追加真实D1全转化200会话/600事件fixture，两次读取11602行，调整本投影系数32保留余量；百万日限制及原通用报表不改。失败计数阶段预留132100可精确归账，未执行的主查询不计预留。公共HTTP验收最初使用不存在的`/auth/me`收到404，按真实路由改为`/api/v1/me`验证；非产品异常。
