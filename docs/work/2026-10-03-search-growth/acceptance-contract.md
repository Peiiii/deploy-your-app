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
| SG01 | true | not-run | 已在用户 Chrome 打开已登录的 GSC；取得 HTML 验证文件 | 尚未发布/验证 |
| SG02 | true | not-run | 现有指南事实已调查 | — |
| SG03 | true | not-run | public projectFilters/publicAuthor 是权限与身份 owner | — |
| SG04 | true | not-run | 既有评估没有 AI 引用实验 | — |
| SG05 | true | not-run | product_events 不存用户 ID，deployment_attempts.flow_id 可验证同会话成功 | — |
| SG06 | true | not-run | 隔离 worktree；主区 WIP 保留 | — |

## 当前阶段门

单阶段，多个工作项。原始 HTML、实际 UI、隐藏/删除/后端失败、指标去重与真实成功状态均需证明；发布后记录证据。站长平台登录、所有权验证或新账号条款若确需用户动作，可阻塞 SG01，不阻碍其它项。增长观察需时间，但工程与基线不以等待替代。

待决范围变更：无。没有新增定时自动化的明确安排；当前长期追踪文档仍是事实 owner。删除泛化排名保证、虚构流量目标等噪声标准。
