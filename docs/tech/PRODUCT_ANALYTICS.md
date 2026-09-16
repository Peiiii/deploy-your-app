# 产品分析与独立管理站

入口：<https://admin.gemigo.io>。主站账号不能登录管理站。独立管理员账号为 `admin`；初始凭据只保存在部署机器的 `~/.config/gemigo/admin-credentials.json`，不进入 Git。

## 日常使用

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
6. 每日定时删除 30 天以前事件及过期会话/限额行。本系统预算不是 Cloudflare 全账户剩余额度。
7. 关闭采集后数据库停止接收事件；浏览器在下次已有请求收到策略后清空队列并停止补报，可通过后续业务请求恢复配置，无额外轮询。

Cloudflare 免费账户的 D1 数据库名额已满，因此使用 `gemigo-projects` 物理实例中的独立分析表。管理 Worker 查询只面向分析及独立会话表，不调用主站身份服务，不使用主站 cookie。后续可迁移到独立 D1，只需迁移这些表并更换两个 Worker 的 ANALYTICS_DB 绑定。

## 维护命令

```sh
pnpm check
pnpm test:analytics
./server/node_modules/.bin/tsx scripts/test-analytics-d1.ts
pnpm build:admin
pnpm deploy:admin
pnpm admin:password
```

`admin:password` 隐藏输入新密码并撤销所有旧管理会话，不影响主站用户。首次部署使用 `python3 scripts/configure-admin.py --generate` 自动生成高强度密码并保存本地凭据。不要把 `.dev.vars` 或凭据文件加入 Git。

数据库首次迁移：

```sh
pnpm exec wrangler d1 execute gemigo-projects --remote -c workers/admin/wrangler.jsonc --file packages/product-analytics/migrations/0001.sql
```

事件合同与查询公共接口由 `packages/product-analytics` 唯一维护。新增功能时添加语义事件/允许的维度、在具体交互或确认结果处接入，再补充对应测试。禁止直接采集 DOM 文本、搜索词、邮箱、代码、密钥或原始 URL。
