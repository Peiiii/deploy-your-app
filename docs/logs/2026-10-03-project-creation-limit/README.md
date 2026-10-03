# 每日新增应用限制：验证与交付

来源与 active contract：../../../docs/designs/2026-10-03-project-creation-limit.design.md。用户要求简单、宽松防刷，授权内选择 20 个/北京时间自然日，只限新增，更新不限。

本地证据：`pnpm test:project-creation-limit` 通过。真实 Miniflare API Worker / SQLite D1 执行：已有 18 条时 12 路直接 repository 并发只有 2 个成功；另一个账号 classic 创建后 24 路 HTTP 草稿并发只有 19 个成功，总量均为 20。草稿与 classic 达限都是 429 / DAILY_PROJECT_LIMIT / limit=20 / resetAt；请求伪造 owner 不生效；创建失败不扣；私有与软删除仍计入；两个账号独立；旧项目 PATCH 正常；北京时间零点前后窗口及实际存储时间包含/排除边界通过。前端错误解码和现有地址错误兼容通过。

真实前端 manager 回归证明：额度拒绝后 HTML、名称和地址保留，busy 释放，不启动部署、不产生虚假失败部署；有旧 draft ID 时仍发布，不再次创建。原发布并发/重试、HTML/ZIP/GitHub 旧应用切换、地址异步检查/生成回归通过。

`pnpm exec tsc -b workers/api frontend --pretty false`、所有触达源码与测试的定向 ESLint（零告警）、`pnpm build:frontend`、`git diff --check` 通过。生产构建资产 index-DasDi2gt.js；仅既有 Browserslist 数据旧与 bundle 大小提示。

实现 Review：项目没有 diff-only maintainability 脚本，按任务 diff 人工检查 SQL 原子 COUNT+INSERT、创建时刻/日期窗口共用快照、软删除及私有计数、旧字段迁移后索引、认证 owner 来源、UI 保留/旧草稿重试、前端和 CLI 错误消费。原记录为计数事实，无第二表或额度状态，无未使用扩展层；保护无关 WIP。无开放 findings，implementation-review=passed。

当前 Q1/Q2 本地 passed；Q3 线上渲染和真实更新待验证；Q4 部署与主线同步待完成。发布前不把本地 fixture 当作生产验收。
