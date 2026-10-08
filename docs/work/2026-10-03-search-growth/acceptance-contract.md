# 搜索与 AI 获客优化交付合同

- contract-id: search-growth-2026-10-03
- parent-goal: 改善 gemigo.io 的 SEO/GEO，提供能判断搜索/AI 访问、注册及实际发布效果的证据。
- scope-revision: 1；未缩减范围。
- 来源：[原始输入](../../logs/2026-10-03-search-growth/README.md#原始输入与约束)。项目全托管授权包括部署、普通推送与主工作区同步。

## 当前有效约定

SG01：Google/Bing 站点验证、提交 sitemap，读取能获得的实际表现；新站或尚未生成的数据明确 unavailable，不编造零或排名提升。
SG02：中英文 HTML/ZIP 指南提供可下载、可运行示例、文件结构和常见故障诊断，内容对应实际发布能力。
SG03：首页/发现页原始 HTML 有真实公开作品和作者链接；有公开作品的具名作者页可收录，隐藏、删除、非 Live 项目不泄露；后端失败不能伪装正常空页面或永久不存在。
SG04：固定 GEO 问题、平台、时间与引用的观察记录，可重复复查；抓取提交与实际引用分开。
SG05：现有获客指标补充注册后同会话、服务端确认成功发布的观察指标；不足与归因边界明确。测量页面性能，不以无数据当合格。
SG06：适用检查、实现 Review、生产部署验收和主工作区 master 与实际 origin/master 一致。

| ID | Required | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- |
| SG01 | true | partial | Google已验证；[当前观察](../../logs/2026-10-03-search-growth/artifacts/gsc-observation.json)：两sitemap成功沿用10-05；10-08英文HTML/ZIP指南已收录、总览可读但快照10-04；网页6点击/15展示，AI Beta首页5展示；软404一次验证已开始；[Bing meta上线](../../logs/2026-10-03-search-growth/artifacts/bing-verification-20261005.json) | Bing最终Verify待确认、未提交sitemap；目录未知，旧请求最终排队结果未见。软404验证未完成，总览不能覆盖新单页结果；小样本/AI展示不代表增长或独立引用 |
| SG02 | true | passed | 中英文指南、HTML/ZIP样例已上线；生产ZIP根目录/资源匹配；指南手机UI与线上样例正确/错误答案、换题重置均已验收，见[截图](../../logs/2026-10-03-search-growth/artifacts/sample-interaction.jpg) | — |
| SG03 | true | passed | [当前主线生产原始HTML](../../logs/2026-10-03-search-growth/artifacts/public-after-withdrawal.json)、真实目录分页UI、权限回归；app详情已按主线撤回，作品链接指向部署网址 | — |
| SG04 | true | passed | [固定问题与回答来源](../../logs/2026-10-03-search-growth/artifacts/geo-observation.md) | 只有1条有效非品牌样本；品牌登录墙不计失败，不外推整体引用率 |
| SG05 | true | passed | 真实D1有序成功/去重/截止回归；原Chrome生产7/30日成功发布字段UI及[CSV](../../logs/2026-10-03-search-growth/artifacts/admin-acquisition-20261004-30d.csv)已验收；[当前窗口/归因边界](../../logs/2026-10-03-search-growth/artifacts/admin-acquisition-20261004.json)；[手机实验](../../logs/2026-10-03-search-growth/artifacts/mobile-lab.json) | 样本极小、同会话归因、30日滚动留存；无INP/真实用户CWV，不声称性能或增长提升 |
| SG06 | true | passed | check、test:seo、test:admin、public app测试通过；Pages/admin上线；证据精确提交与普通推送后核对主区同步和实际远端SHA，见执行日志 | 不替代SG01/02/05的未完成验收 |


## 当前阶段门

单阶段，多个工作项。原始 HTML、实际 UI、隐藏/删除/后端失败、指标去重与真实成功状态均需证明；发布后记录证据。站长平台登录、所有权验证或新账号条款若确需用户动作，可阻塞 SG01，不阻碍其它项。增长观察需时间，但工程与基线不以等待替代。

待决范围变更：无。已启用当前聊天每日09:00 Asia/Shanghai续办自动化gemigo-ai，沿原授权继续未完成验收并仅在实质变化或需用户动作时通知；当前长期追踪文档仍是事实 owner。删除泛化排名保证、虚构流量目标等噪声标准。
