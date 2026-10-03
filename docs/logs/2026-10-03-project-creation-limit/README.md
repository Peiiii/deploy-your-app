# 每日新增应用限制：验证与交付

来源与 active contract：[设计与验收合同](../../designs/2026-10-03-project-creation-limit.design.md)。用户要求简单、宽松防刷，授权内选择 20 个/北京时间自然日，只限新增，更新不限。

本地证据：`pnpm test:project-creation-limit` 通过。真实 Miniflare API Worker / SQLite D1 执行：已有 18 条时 12 路直接 repository 并发只有 2 个成功；另一个账号 classic 创建后 24 路 HTTP 草稿并发只有 19 个成功，总量均为 20。草稿与 classic 达限都是 429 / DAILY_PROJECT_LIMIT / limit=20 / resetAt；请求伪造 owner 不生效；创建失败不扣；私有与软删除仍计入；两个账号独立；旧项目 PATCH 正常；北京时间零点前后窗口及实际存储时间包含/排除边界通过。前端错误解码和现有地址错误兼容通过。

真实前端 manager 回归证明：额度拒绝后 HTML、名称和地址保留，busy 释放，不启动部署、不产生虚假失败部署；有旧 draft ID 时仍发布，不再次创建。原发布并发/重试、HTML/ZIP/GitHub 旧应用切换、地址异步检查/生成回归通过。

`pnpm exec tsc -b workers/api frontend --pretty false`、所有触达源码与测试的定向 ESLint（零告警）、`pnpm build:frontend`、`git diff --check` 通过。生产构建资产 index-DasDi2gt.js；仅既有 Browserslist 数据旧与 bundle 大小提示。

实现 Review：项目没有 diff-only maintainability 脚本，按任务 diff 人工检查 SQL 原子 COUNT+INSERT、创建时刻/日期窗口共用快照、软删除及私有计数、旧字段迁移后索引、认证 owner 来源、UI 保留/旧草稿重试、前端和 CLI 错误消费。原记录为计数事实，无第二表或额度状态，无未使用扩展层；保护无关 WIP。无开放 findings，implementation-review=passed。

当前 Q1/Q2 本地 passed；Q3 线上渲染和真实更新待验证；Q4 部署与主线同步待完成。发布前不把本地 fixture 当作生产验收。


## 线上验收

- API Worker 已部署，版本 `b074f8c7-4d13-4e89-b778-5af2eb68d05c`；前端生产 Pages `2ef549af-4454-4ea8-b9c5-fe5ecfc7f631`，gh-pages source `4456048`。gemigo.io 与同版本 gemigo.pages.dev 均确认加载 `index-DasDi2gt.js`，见 production-assets.json。实现主线提交 `7d680bd`。
- 采用独立私有 QA 账号，正常认证 API 创建 1 个项目；Cloudflare D1 只向该账号临时加入 19 个从未部署的 fixture（私有、Offline、无 URL），其中 1 个软删除。总数 20；第 21 个 draft/classic 均为 429/DAILY_PROJECT_LIMIT，私有及删除不能绕过，详见 production-api.json。
- 在 gemigo.pages.dev 正常登录同一 QA 账号，实际点击发布：中英文提示均出现，名称/地址/HTML 保留、操作恢复可用，见 production-quota-zh.png / production-quota-en.png。采用平台同版本别名以保护 gemigo.io 原用户会话；不操作真实用户认证。
- 原私有应用先发布 V1 并验证 Live。然后在达到额度的创建页填写 V2 → 发布被拒绝 → 右侧“更新已有应用” → 原项目部署页 → 显式使用刚填写内容 → 发布更新。UI 显示成功，原 URL 显示 `Q3 update after daily limit`；id/name/slug/url 保持不变；D1 总项目数仍 20（API 可见 19，因为 1 个 fixture 已软删除）。真实更新 2026-10-03T11:21:58.977Z → 11:22:01.615Z succeeded/complete，见 production-update.json / production-update-success.png。
- 清理：通过 Cloudflare 精确删除本次 19 个从未部署的临时 fixture，仅匹配该 QA owner 与已保存 ID；实际私有测试项目通过既有 owner API 软删除。测试账号活跃项目数为 0，临时凭证文件删除。见 production-cleanup.json。历史“诡市”记录不受测试影响。

Q1/Q2/Q3 当前 passed；Q4 发布、检查与 Review 已 passed，最终证据提交及 Git 同步见收尾记录。部署次数没有新增每日限额；现有 builder 忙碌保护仍由原部署链路负责。跨日证据来自真实 SQLite/D1 边界测试与固定北京时间窗口，未伪称等待生产时钟跨过次日零点。

复盘：retrospective_decision=no-increment。复用创建记录的原子计数与现有发布入口足以闭合用户要求；无需新增通用限流体系或重复知识 owner。当前方案和回归记录保留 20 个/北京时间/更新不占额度的产品判断依据。parent_status=ready-for-completion-check，最终检查取决于提交与主线同步。

恢复：如需撤回额度规则，以本任务实现 diff 为范围做普通 revert/修订并重新部署 API 与前端，保留其后并发任务提交及现有项目数据；不要回退数据库记录或覆盖主线其它改动。调整额度的唯一数值 owner 是 workers/api/src/utils/project-creation-limit.ts，网页从响应 limit 插值。

Git 收尾检查：实现提交 7d680bd 已进入实际远端 master；主工作区在 master，收尾前 SHA=a4186f3b0e2c485197638622a7ffad1048af74ef，实际远端相同，master...origin/master=0 0，暂存区为空。以下验收证据精确提交后再次核对两端及 ancestry，不提交无关 WIP。
