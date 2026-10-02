# 发布可靠性优化

## 原始输入与约束
2026-10-02 用户先要求分析最近一个月 ZIP 构建与 GitHub 部署使用量，继而要求“先研究一下为啥失败”，并明确委托：“你来负责优化这个事情。你作为 CEO。把你能想到的优化都优化一下。” 本次授权覆盖发布链路的产品取舍、实现、验证和上线；不涉及教育分类或语言推荐的后续开发。项目 AGENTS.md 已授权精确提交、普通推送及必要部署。

## 调查证据
UTC 2026-09-02 至 2026-10-01；attempt 历史从 9 月 18 日晚开始，不能代表完整月。ZIP 100 次：73 成功、20 upstream_413、2 builder_failed、2 client_observed_failure、3 stale_timeout。GitHub 15 次：5 成功、7 builder_failed、2 client_observed_failure、1 stale_timeout。HTML 440 次：431 成功、4 upstream_520、2 client_observed_failure、3 stale_timeout。
20 次 413 来自 5 人，原 ZIP 10,504,179–70,620,036 字节，全部超过 express.json 的 10 MiB JSON 限制。隔离真实 Express 复现 7 MiB ZIP 可解析、8 MiB ZIP 返回 413。执行真实前端 Provider/Executor 的回放，启动 413 后 UI Failed，但 project Building→Live，并发送 deployment_success。SSE onerror 无条件失败；Node 状态及日志仅存内存。GitHub 失败原始 URL 和具体报错没有持久化，因此不能断言全部为 npm 构建失败。生产数据库查询均只读；统计输出不含客户标识。

## 关联入口
- [设计](../../designs/2026-10-02-deployment-reliability.design.md)
- [合同](../../work/2026-10-02-deployment-reliability/acceptance-contract.md)
- [当前状态](../../work/2026-10-02-deployment-reliability/current-state.md)

## 过程记录
- 方案审查：按原用户目标核对上传、状态、恢复、诊断与已有入口兼容。补齐旧客户端边界、源码临时对象清理、旧站点保护与服务器重启恢复后，design-review: passed。只优化同一发布能力，不建无消费者的调度平台。

## 交付汇总与复盘
进行中，尚未交付。

## 实现验证与 Review（发布前）
2026-10-02：真实 Miniflare Worker/R2/D1 流式上传、归属/认证/限额、flow 幂等、确认前禁止 Live、终态持久 URL、旧状态覆盖与 SQL 写入条件通过；Provider+Executor 413 和 12 MiB 二进制/断线恢复通过；Node ZIP/默认分支/入口/重启/临时目录回收，R2 上传失败、指针失败、写入后响应丢失与新旧 Gateway 通过；CLI 7 项回归、metadata policy、analytics foundation 通过。根 tsc、受影响 ESLint、前后端 build、域名登记、Worker/gateway dry-run、bash 语法、diff whitespace 通过。构建仅有既有体积/Browserslist 提示。项目没有 diff-only maintainability 脚本，完成手工 findings-first 与 owner/状态/异步/发布边界复核：发现的客户端终态权、指针模糊提交、SQL 旧作业写入、共享构建环境均已修正并回归；no findings（源码范围）。
生产镜像隔离验收交由既有 GitHub deployment workflow 的 validate_only 入口先执行，失败不得进入发布。新增独立服务 token 已以不显示值的方式配置两侧 Secret；未访问或修改既有凭据。npm whoami=E401，registry 发布需有效身份；提供可安装 CLI 包的发布入口。
