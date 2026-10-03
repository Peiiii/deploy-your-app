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
