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
已上线，可进行用户体验验收；AI 验收通过，用户尚未反馈。产品决策：保留已有使用量的源码构建能力，静态资源直接托管，构建仅在项目需要时执行。

## 实现验证与 Review（发布前）
2026-10-02：真实 Miniflare Worker/R2/D1 流式上传、归属/认证/限额、flow 幂等、确认前禁止 Live、终态持久 URL、旧状态覆盖与 SQL 写入条件通过；Provider+Executor 413 和 12 MiB 二进制/断线恢复通过；Node ZIP/默认分支/入口/重启/临时目录回收，R2 上传失败、指针失败、写入后响应丢失与新旧 Gateway 通过；CLI 7 项回归、metadata policy、analytics foundation 通过。根 tsc、受影响 ESLint、前后端 build、域名登记、Worker/gateway dry-run、bash 语法、diff whitespace 通过。构建仅有既有体积/Browserslist 提示。项目没有 diff-only maintainability 脚本，完成手工 findings-first 与 owner/状态/异步/发布边界复核：发现的客户端终态权、指针模糊提交、SQL 旧作业写入、共享构建环境均已修正并回归；no findings（源码范围）。
生产镜像隔离验收交由既有 GitHub deployment workflow 的 validate_only 入口先执行，失败不得进入发布。新增独立服务 token 已以不显示值的方式配置两侧 Secret；未访问或修改既有凭据。npm whoami=E401，registry 发布需有效身份；提供可安装 CLI 包的发布入口。

镜像验收：[validate_only run](https://github.com/Peiiii/deploy-your-app/actions/runs/36998453472)，源码07a4dbe，通过实际 pnpm 沙箱、凭据/共享目录/socket 隔离、非 root/只读根、结果跨重启、排空拒绝新作业、健康升级与启动失败恢复旧服务。前三次仅验收环境/等待/清理边界失败，未发布；已修正测试和回滚健康等待后全通过。开始 Gateway 兼容发布，version=b0aa49a6-2a35-4c87-9406-5a90c46d3bb2。

## 最终上线与真实验收

- Node：[生产 run37001965004](https://github.com/Peiiii/deploy-your-app/actions/runs/37001965004)，源码 c96da1c；真实隔离/重启/排空/升级回滚 QA 与部署均 passed。此前[生产 run36999308707](https://github.com/Peiiii/deploy-your-app/actions/runs/36999308707) 已上线主体改动。健康接口 200，匿名作业结果接口 401。
- API Worker version=77d6767e-887a-4a55-b0c9-3ad8ed825422，HTTPS 内部连接和 token；Gateway version=5c3939b8-7f61-422f-b6cb-a1af7c0023b6；Pages production deployment=aa106967-c196-4a47-ba60-5e44e4b1cec9（gh-pages source400b615，c96da1c 前端构建）。线上 UI 已显示 75 MB 限额及最近发布结果入口。
- 真实登录用户的四个私有 QA 项目：12 MiB ZIP（单根目录/macOS 元数据）成功，下载资产 SHA256 一致；73,400,825-byte ZIP 成功，R2 资产 73,400,320 bytes；显式 GitHub 分支 pnpm 隔离构建成功；GitHub CLI 0.1.4 下载、安装、生产发布成功；原有 inline HTML 入口生产发布及真实站点内容确认通过。
- 生产缺入口 ZIP 两次明确失败，中文原因、正确文件名、stage=validate/mode=static/code=missing_entry；刷新后通过“查看最近发布结果”仍可读取。失败后原 12/70 MiB 网站均保持 200。另一个 GitHub 作业未连接 SSE、未主动 reconcile，后台定时任务确认 succeeded。历史已丢失日志不补造。
- 在线发现静态目录带内部 placeholder .env；返回 Design 补审，R2 排除私有配置，Gateway 对新旧版本及编码路径拦截。定向 runtime、客户端、tsc/lint/build 与两 Worker dry-run 重验通过，手工 diff-only/owner/异步/发布边界 Review：no findings。线上 70 MiB ZIP 内只有假配置，确认 .env 未进入 R2，临时源已删除；旧 QA .env 访问也为 404。
- 清理四个私有 QA 项目，对 38 个精确的自有 R2 对象键执行清理，并删除 QA attempt 与关联 flow 的产品事件；测试站点 404，结果接口拒绝访问，临时 GitHub QA 分支已删除。Node 自有测试 receipt 按正常 30 天保留策略回收。不修改客户历史数据或原工作区无关改动。
- [CLI 0.1.4 release](https://github.com/Peiiii/deploy-your-app/releases/tag/gemigo-v0.1.4) 提供可安装 tgz；npm 身份 E401，registry 未更新。直接 npm 下载在本机网络超时，使用 GitHub release 下载同一公开包后实际 npm 安装及部署通过；不是包装产物失败。
- 原始脱敏聚合保留主工作区原 ignored tmp；最终无客户标识的验收摘要保留主工作区 tmp/deployment-reliability-final/evidence.json，任务 fixture 随工作树归档清理，仅工程日志/设计/合同入库；最终 UI 截图在主工作区 tmp/deployment-reliability-result.png。生产 Secrets 未写入源码或输出。

## 复盘与完成门

retrospective_decision=updated-existing-facts：原 owner docs/deployment/DEPLOY.md 更新真实生产拓扑、内部认证、上传/构建/结果恢复/资产保护；docs/architecture/API_WORKER_ARCHITECTURE.md 修正 Node 对外接口描述并链接 owner。证据来自源码、生产 CI 和上述线上验收；不新增全局规则，偶发 QA 等待/VM 装载问题在本任务测试修正。retrospective_state=completed。

Required DR-01..DR-07 current passed，open-required=none，实现 Review=no findings，最小完整结果成立，交付链路可在 gemigo.io 正常账号中操作。用户入口：[仪表盘](https://gemigo.io/dashboard)，选择项目 → 部署 → 查看最近发布结果；上传 ZIP 或公开 GitHub 仓库可开始新发布。开发交付完成，体验验收待用户反馈；npm registry 凭据与历史日志无法恢复的边界已披露，不要求用户再批准已授权上线。
