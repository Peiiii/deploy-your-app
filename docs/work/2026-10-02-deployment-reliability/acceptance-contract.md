# 发布可靠性交付合同

contract-id=deployment-reliability-20261002；parent-goal=用户可靠地从 ZIP/GitHub/HTML 发布，失败可解释、断线可恢复，产品数据可信。
scope-revision=1；scope-confirmation=用户完整委托，具体方案由 AI 在授权内决定。来源：[原始输入](../../logs/2026-10-02-deployment-reliability/README.md)。单交付阶段，不把执行批次当整体完成。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| DR-01 | true | 已观察到的大 ZIP 可上传部署；限制真实、明确；旧客户端安全兼容 | not-run | 修前 8 MiB 返回 413 |
| DR-02 | true | 启动失败和连接中断不制造 Live/成功事件；真实终态只有服务端确认 | not-run | 修前 413→Live 已复现 |
| DR-03 | true | 断线、关页、服务重启均有可恢复/明确失败的结果；完成记录与日志持久 | not-run | 原日志仅内存 |
| DR-04 | true | GitHub 输入/default branch 可用；错误有原因；ZIP 单根目录和静态/构建入口明确 | not-run | 原只猜 main/master |
| DR-05 | true | 失败部署不损坏已上线站点；新旧存储布局与 URL 可访问 | not-run | 原先删后上传 |
| DR-06 | true | 诊断包含 stage/mode/code/message；临时源文件与作业资源有界、权限不越界 | not-run | 原 D1 仅泛化 code |
| DR-07 | true | 修改经测试、类型检查、Review，精确集成 master 并部署受影响目标，线上验收 | not-run | 尚未实施 |

旧→新：原 HTML、ZIP、GitHub 发布入口与原 URL 保留；新增二进制上传替代 Base64，仅旧客户端保留小 zipData。目标→新：覆盖上传、运行、失败恢复、诊断、已上线资产和真实发布；不纳入教育分类及多语言探索（另一个产品能力）。不登记缺乏现状依据的成本目标、私有 GitHub OAuth 授权建设或新运行平台。

待决变更：无。open-required=DR-01..DR-07；尚未验证边界=所有上线目标。历史未留存错误不能补回。
