# 产品分析与独立管理站

入口：<https://admin.gemigo.io>。主站账号不能登录管理站。独立管理员账号为 `admin`；初始凭据只保存在部署机器的 `~/.config/gemigo/admin-credentials.json`，不进入 Git。

## 日常使用

- 经营总览：累计用户与有效应用、近 7/30 日部署趋势与成功率、应用真人访问、来源及失败原因；登录后自动加载。
- 增长大盘：官网真人 PV、产品观测 UV、每日注册、成功部署、完整 UTC 日 7/30 天及等长周期比较；官网获客/设备（IP主机匿名合并、动态脚本子域合并为来源域）与同新客队列激活，今日未完成日独立展示，每日聚合 CSV。官网与应用流量分别来自 Web Analytics site；visits 不是 UV。UV 仅对已采集 web 页面浏览按匿名 browser ID 去重，30 日留存边界缺失不写零，期间 UV 不把日 UV 相加。
- 反馈管理：私密反馈统一收件箱，分类/状态/关键词搜索与分页；阅读完整讨论、状态 CAS、团队回复、防重复发布及确认软删除。主站作者看到相同处理和回复，其他用户无访问权限；长讨论不静默截断，后台每页 100 条。团队 user_id 保留值 `gemigo-admin-team`，独立后台不创建或冒用客户账号。
- 用户管理：按姓名、邮箱、handle、ID 搜索，查看应用与有效主站会话；确认后撤销主站登录会话。
- 应用管理：搜索、按状态筛选、分页，确认后修改平台公开展示；应用原链接仍可访问。
- 部署记录：按应用/ID、状态查看尝试、来源、渠道、耗时与错误代码。
- 账号安全：验证当前密码后修改新密码（8–256 字符）；全部管理员会话立即失效，需以新密码登录。
- 操作记录：查看公开性、撤销登录及改密码记录，不保存密码；反馈审计只存操作和回复 ID，不复制私密内容。
- 使用概览：访客、会话、页面浏览、事件趋势、部署结果、来源。
- 功能使用：包括零记录功能；点击功能进入明细。
- 转化与路径：同会话有序漏斗、相邻页面路径。
- 事件明细：日期、设备、登录状态、事件、会话过滤和 CSV（最多 5000 条）。日期按 UTC，单次最多 30 天。
- 采集与预算：关闭采集、修改每日事件预算（100–2000）、查看捎带与补报批次和保守查询预留额度。

数据从上线后积累，不能回填历史。匿名浏览器标识不等于自然人；会话对应浏览器标签页。身份状态是服务器接收批次时的状态。部署完成/失败是浏览器观测，不把缺失结果当失败。Do Not Track、拦截器、关闭页面、队列容量、每日预算都会影响覆盖率。当前版本不做全站精确计费统计。

## 免费额度设计

1. 事件只进入内存队列，最大 100 条；优先捎带现有同源 API 请求，每批最多 20 条。
2. 无业务请求时至少间隔 120 秒，跨标签页锁和 localStorage 限制每天最多 6 次独立补报。无 Web Locks 或无法保存预算时不补报。不立即重试，不创建独立配置轮询。
3. 主站现有 Pages 转发层意味着一次补报最多涉及 Pages 与 API 两次 Worker 调用；六次浏览器补报不宣称等于六次 Cloudflare 调用。捎带没有新增 HTTP 请求。
4. 每天最多预留 2000 个事件，每浏览器最多 200。超限整批丢弃；去重和写入失败不会返还预留预算。实际 D1 写入还包括索引、额度行等写放大。
5. SQLite 完成报表聚合，避免把大量数据放入免费 Worker 的 JavaScript 内存/CPU。报表缓存 15 分钟；无自动轮询；读取前保守预留额度，每日最高 100 万行，额度不足时要求缩小日期或等下一天。
6. 每日先把即将删除的事件写入日级聚合，再删除 30 天以前明细；日级聚合保留 90 天。同步清理过期会话、限额、访问去重键，并把超过 24 小时仍在 Building 的项目/部署标记失败。本系统预算不是 Cloudflare 全账户剩余额度。
7. 关闭采集后数据库停止接收事件；浏览器在下次已有请求收到策略后清空队列并停止补报，可通过后续业务请求恢复配置，无额外轮询。

Cloudflare 免费账户的 D1 数据库名额已满，因此使用 `gemigo-projects` 物理实例中的独立分析表。管理 Worker 在独立认证后查询业务表与分析表，不调用主站身份服务、不使用主站 cookie。列表使用显式字段白名单，不返回用户密码哈希、OAuth 凭据或应用源码。管理账号的持久密码权威为 `admin_account`；初始 Secret 只在表为空时初始化，网页改密后不能继续用旧 Secret 登录。

## 维护命令

```sh
pnpm check
pnpm test:analytics
./server/node_modules/.bin/tsx scripts/test-analytics-d1.ts
pnpm build:admin
pnpm deploy:admin
pnpm admin:password
pnpm test:admin
```

日常使用管理站“账号安全”改密。`admin:password` 是运维恢复入口，隐藏输入新密码、更新同一持久账号并撤销所有旧管理会话，不影响主站用户。首次部署使用 `python3 scripts/configure-admin.py --generate` 自动生成高强度密码并保存本地凭据。网页修改后本地初始凭据文件不会自动更新，使用新密码登录并自行保管。不要把 `.dev.vars` 或凭据文件加入 Git。

升级后台先执行 `workers/admin/migrations/0001_admin_console.sql`（仅新增表，不修改旧会话结构），再执行 `pnpm deploy:admin`。管理员会话哈希绑定密码版本，防止改密竞态留下旧有效会话。登录每 IP 每 10 分钟最多尝试 20 次；网页改密不会清除此限额。迁移后不要回退到只验证 Secret 的旧认证版本；故障恢复应保留持久账号及当前认证语义，必要时用运维恢复入口重设密码再部署修正版。

数据库迁移按文件名顺序执行：

```sh
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file packages/product-analytics/migrations/0001.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file packages/product-analytics/migrations/0002_attribution_and_rollups.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/api/wrangler.toml --file workers/api/migrations/0001_customer_analytics_foundation.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/api/wrangler.toml --file workers/api/migrations/0002_privacy_safe_app_traffic.sql
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file workers/admin/migrations/0001_admin_console.sql
```

增长服务的真人流量权威遵守 `skills/gemigo-customer-analytics/references/metric-contract.md`：CF Web Analytics RUM `bot=0`，账号/两个 siteTag 由 admin Worker vars 定义，使用现有后台服务账号的持久 API token，通过 `ANALYTICS_CF_TOKEN` Worker Secret 安装；不得使用短期 Wrangler OAuth、不进入浏览器或 Git。查询固定字段，流量缓存 30 分钟（既有 analytics_settings 命名 key）与报表缓存 5 分钟，失效上游明确 stale/last fetched，首次失败指标 null。业务查询沿原百万日预算先计数再按实际规模保守预留，不因理论采集上限耗尽额度。采样、DNT、预算和留存分别限制指标覆盖；Cloudflare visits 不能被命名为 UV。运营激活只对同一新注册 cohort 计算，截至周期末持有有效应用与该有效应用成功部署。

事件合同与查询公共接口由 `packages/product-analytics` 唯一维护。新增功能时添加语义事件/允许的维度、在具体交互或确认结果处接入，再补充对应测试。禁止直接采集 DOM 文本、搜索词、邮箱、代码、密钥或原始 URL。

生产验收同样会占用查询预留：执行前记录现有日预留基线，并保存每次非缓存响应的 `reservedReads` 与生成时间；缓存命中不能重复归账。收尾仅恢复能明确归属本次验收的预留，保护既有实际使用与所有其它用量，不清零采集或查询预算。升级缓存 namespace 会再次产生查询预留，切换版本后的验证范围应只覆盖受影响行为。
