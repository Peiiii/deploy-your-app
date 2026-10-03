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

生产部署与远程/主工作区同步证据在上线后补充。
