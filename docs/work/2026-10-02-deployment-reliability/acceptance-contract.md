# 发布可靠性交付合同

contract-id=deployment-reliability-20261002；parent-goal=用户可靠地从 ZIP/GitHub/HTML 发布，失败可解释、断线可恢复，产品数据可信。
scope-revision=1；scope-confirmation=用户完整委托，具体方案由 AI 在授权内决定。来源：[原始输入](../../logs/2026-10-02-deployment-reliability/README.md)。单交付阶段，不把执行批次当整体完成。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| DR-01 | true | 已观察到的大 ZIP 可上传部署；限制真实、明确；旧客户端安全兼容 | passed | 生产 12 MiB ZIP 成功且下载哈希一致；73,400,825-byte ZIP 成功、R2 资产 70 MiB；限额/归属/旧请求由真实 Miniflare+R2/D1 回归 |
| DR-02 | true | 启动失败和连接中断不制造 Live/成功事件；真实终态只有服务端确认 | passed | 真实 Provider/Executor 413 回放禁止 Live/成功事件；Worker+D1 唯一终态与旧 PATCH/旧作业覆盖回归；线上缺入口仅 Failed |
| DR-03 | true | 断线、关页、服务重启均有可恢复/明确失败的结果；完成记录与日志持久 | passed | Provider 断线恢复回归；生产无 SSE/无主动 reconcile 的 GitHub 作业由 cron 确认；镜像 CI restart receipt/明确中断失败；刷新仍可读 D1 诊断 |
| DR-04 | true | GitHub 输入/default branch 可用；错误有原因；ZIP 单根目录和静态/构建入口明确 | passed | 生产 GitHub 显式 QA 分支 pnpm 构建成功；默认分支/private 404/ZIP 单根/TSX/缺入口回归；生产 static 与 build 两种模式及原 HTML 入口确认 |
| DR-05 | true | 失败部署不损坏已上线站点；新旧存储布局与 URL 可访问 | passed | R2 上传/指针失败/模糊响应、新旧布局与上一版资产回归；生产缺入口失败后 12/70 MiB 旧站点均 200；服务升级回滚 CI |
| DR-06 | true | 诊断包含 stage/mode/code/message；临时源文件与作业资源有界、权限不越界 | passed | 生产 stage=validate/mode=static/code=missing_entry/原因刷新可读；70 MiB 临时源删除、.env 不发布、旧 .env 404；owner/token/隔离/有界资源回归和镜像 CI |
| DR-07 | true | 修改经测试、类型检查、Review，精确集成 master 并部署受影响目标，线上验收 | passed | tsc/lint/build/CLI/Worker/runtime/client 回归、diff-only Review 无 findings；master 集成；Node run37001965004、API/Gateway/Pages 线上验收；GitHub CLI 包实际安装部署；私有 QA 清理 |

旧→新：原 HTML、ZIP、GitHub 发布入口与原 URL 保留；新增二进制上传替代 Base64，仅旧客户端保留小 zipData。目标→新：覆盖上传、运行、失败恢复、诊断、已上线资产和真实发布；不纳入教育分类及多语言探索（另一个产品能力）。不登记缺乏现状依据的成本目标、私有 GitHub OAuth 授权建设或新运行平台。

待决变更：无。open-required=none；AI acceptance=passed，Review=no findings。用户体验验收尚未收到反馈，不等于用户验收通过。历史未留存错误不能补回；npm registry 凭据 E401，0.1.4 由公开 GitHub release 交付，未声称 npm latest 更新。
