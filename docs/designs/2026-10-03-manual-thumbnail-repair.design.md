# 按需补齐历史截图

- contract-id: manual-thumbnail-repair-2026-10-03
- parent-goal: 新发布继续自动截图；管理员/AI 按需执行一次历史补图，无随应用量增长的定期全库扫描，并完成当前可访问应用的缺图补齐。
- 来源：2026-10-03 用户明确选择“扫描……需要手动触发”“你可以留这个口子”“你来一次性补齐”。AGENTS.md 已授权完整实现、验证、精确提交、普通推送、主工作区同步和线上操作。
- flow: standard; task-type: feature; risk: L4（生产 R2 补图）；design-document: required; plan: not-required（单批）；retrospective_state: completed。
- 事实：原 Cloudflare 每两分钟处理 D1 到期队列，GitHub 每轮最多 20 个，失败持续退避。原 GitHub 每小时只检查最近 50 个应用。线上全库只读 HEAD：564 项中 344 ready、220 missing，缺图从最新排序第 85 项开始；队列为空。证据 /tmp/gemigo-thumbnail-audit-results-v2.json。

## 用户链路与选择

日常部署者正常发布 → 数据库触发器自动入队 → Cloudflare 触发原 capture 工作流 → 原截图脚本生成封面 → 首页轮询显示。保持此链路，无全库巡检。

管理员/AI 经已有 GitHub Actions 权限手动触发独立的 Repair historical app thumbnails 工作流 → 分页查询当前公开 Live 应用、直接 R2 HEAD → 只为缺图捕获网页 → 原条件上传写同一 R2 路径 → Actions 显示逐项结果和报告，正常访问应用获得封面。失败不加入常驻队列；修好应用后可再次按需触发。已有图幂等跳过，超限/中断可使用日志中的 start_after 续跑。

采用独立人工工作流、复用同一个 Python 截图/条件写 owner。它与新应用自动工作流独立 concurrency，历史操作不会把数百任务塞进日常队列或阻塞其 runner。移除原 hourly schedule；保留原 reconcile=true 最近 50 项的人工恢复选项，默认 false。

候选：全库定期扫描违背用户最终偏好；全库批量入常驻队列会排在新发布之前，且不可访问历史应用会永久自动重试；人工直接补图复用算法，无新数据库状态、后台服务、Secrets 或管理 UI，完成后无额外周期性工作。因此选择最后一项。

## 执行与安全边界

- 全库按项目主键 keyset，每页 100，启动时固定 upper_id；默认单次最多检查 1000 项。达到上限且还有数据明确报告 incomplete 和 next_cursor，不假称完成。管理员用 start_after 继续；没有持久扫描游标。
- 浏览器仅在发现缺图时启动，截图维持原 960×540、300 KiB 压缩限制。同一 capture-and-store 实现用于新应用和人工修复。
- 人工记录项目 id/slug/url/last_deployed；捕获前后原子只读重查资格和快照。期间私有化、删除、重新部署或改 slug/url 时跳过旧结果。原自动流程继续使用 generation。
- 只写缺失 WebP；上传前重查 WebP/旧 PNG，IfNoneMatch=* 保护并发封面。人工与自动可并行，最多一次成功创建同一对象；人工不删除或修改日常任务。
- 单项网络、页面/HTTP、R2 失败隔离并记录安全错误。报告只含 slug、状态、计数、游标，不输出凭据/上游正文。运行失败可人工重跑，已有成功图不会重拍。工作流上传报告（保留 14 天）。
- 错误/不可访问应用不生成错误页截图；披露剩余项，不改应用内容或上线状态。
- 回滚人工工作流/脚本版本即可停止人工补图；已生成真实封面留存，生产 Secrets 和应用数据不迁移。

## Active acceptance ledger

| ID | Required | Status | 合同与证据 |
| --- | --- | --- | --- |
| MR-01 | true | passed | 两工作流只有 workflow_dispatch、默认 reconcile=false；生产正常工作流 37094414979 success：queued=0 pending=0，无 r2-head/reconciled，浏览器依赖和捕获均 skipped |
| MR-02 | true | passed | SQLite 组装测试：215 项全扫描、111 项截断/续跑、已有封面不启动浏览器、并发封面/412 保留、变私有/删除/改 slug/url/重新部署跳过、HTTP404/R2错误隔离、基础设施异常报告游标 |
| MR-03 | true | passed | 原自动队列/R2 合同与新人工回归共 26 项通过；Worker 定向 tsc/ESLint/触发测试、thumbnail-performance、两工作流 actionlint 全通过；人工操作不改变任何现有任务 |
| MR-04 | true | passed | 真实人工运行检查 564 项，saved=213/existing=344/failed=7/changed=0/complete=true；213 新图逐项 HEAD200、7 失败 HEAD202，0 mismatches；7 原页面全部 HTTP404；博饼真实图片已打开复核 |
| MR-05 | true | passed | ede342d 精确 7 文件提交已进入实际主线；收尾前 master 与实际远端 bb62c8f 相同、0/0，所有并行提交和 WIP 保留；本文最终证据精确提交后再复查同步 |

验证矩阵：110+ 项全库、零项/全部已有、100 项分页、上限续跑、新旧 PNG 边界、并发上传 412、变私有/改 slug/重新部署、HTTP 404/超时隔离、报告错误与游标、自动任务不受人工影响。定向 Python 回归、原 Worker TS/ESLint/触发测试、actionlint、diff-only Review；生产手动工作流及最终 HTTP/像素验收。

抽象审计：R2 是封面唯一 owner；D1 队列只拥有日常未完成工作。共享条件写函数有自动/人工两个真实消费者；人工分页/报告仅服务本次已授权入口。没有持久 ready 状态、扫描服务或新凭据。契约只登记会放过实际错误的结果，没有例行前端构建/UI 改版标准。

## 方案 Review

mode=design：独立核对用户最终偏好和原实现。全库入常驻队列候选存在新应用等待和历史无界重试，已改为独立人工执行；keyset/upper_id/单次上限使成本在操作内明确有界；失败隔离与快照重查覆盖并行任务；现有图条件写及原自动队列保持不变量。无开放 finding，design-review: passed，范围为上述 MR-01–05。

## 实现 Review 与交付前证据

mode=implementation，diff-only findings-first Review：no findings。项目无 maintainability 检查入口，按本任务 diff 与原 trigger/队列/R2 网关合同审查。原截图函数、压缩、等待与存储路径保持；条件写抽到共享函数，两个实际消费者均重查自身快照。人工分页 SELECT 无 INSERT/UPDATE/DELETE；失败无常驻重试；独立 workflow concurrency 避免阻塞日常任务。浏览器在 Playwright 生命周期内关闭，报告逐项原子更新、异常留游标。输入通过环境变量传入，未插值到 shell 代码；复用已有 Secrets。26 项 Python 真实 SQLite + 组装运行边界、定向 TS/ESLint/trigger、图片网关回归、actionlint 与本任务 diff-check 通过。生产验证后复审同一源码及报告，no findings。

## 生产交付与真实边界

源码 ede342d，普通合并保留并行的 172d223/708fa7d 后，732ac5f 已普通推送到主线；当时主工作区和实际远端 SHA 相同、0/0。保留 analytics/interview/education/package 和并行 favicon 工作区改动。

历史工作流 [37094411273](https://github.com/Peiiii/deploy-your-app/actions/runs/37094411273) 于 2026-10-03 03:48Z 人工触发，执行 head=732ac5f，04:04:15Z 结束扫描。checked=564、saved=213、existing=344、failed=7、changed=0、complete=true。因为 7 项 HTTP404，工作流如设计返回 failure，而非假称全部成功；报告 artifact 正常上传。不存在超时、分页截断或可恢复截图失败。

正常工作流 [37094414979](https://github.com/Peiiii/deploy-your-app/actions/runs/37094414979) 与其并行 success，证明独立 concurrency，空队列无 R2 和浏览器工作。补图结束后生产 D1 pending=0；没有遗留历史重试。无 Worker/API/数据库迁移或 Secret 修改，工作流和脚本通过主线立即生效。

失败项目：app-4811、future-market、app-340j、www、app-2a2z、kezp、7575557。报告均 HTTP404，逐项独立页面请求也 404，无法生成真实截图；未写错误页图片，未改其应用文件或发布状态。页面恢复后可人工重跑，已有 557 张封面跳过。保留此真实外部边界，不能宣称全部 564 项都有图。

最终只读验收：213 新图 HEAD200，7 失败 HEAD202，220 项 0 mismatches。报告 /tmp/gemigo-thumbnail-repair-final/thumbnail-repair-report.json 与 head-verification.json；基线 /tmp/gemigo-thumbnail-audit-results-v2.json。实际打开 /tmp/gemigo-manual-repair-zqkl.webp，内容为博饼应用界面。用户刷新 https://gemigo.io/ 可看到补图；未来说“补齐历史截图”即可由 AI 用既有 Actions 权限触发，入口见 workers/thumbnail-trigger/README.md。用户无需配置新凭据；未声称已取得用户体验验收。

retrospective_decision: 更新原事实 owner workers/thumbnail-trigger/README.md 与 workers/r2-gateway/README.md，明确按需全库入口、取消周期巡检、有限批次/游标和失败恢复。生产一次性运行证明：历史修复与正常队列隔离可避免历史不可访问应用留下永久重试，并保持并发写保护。无新的全局 Skill/流程规则。parent_status: ready-for-completion-check；最终文档提交同步核对通过后 Lifecycle 关闭本次机制与当前可访问应用补图交付；7 个不可访问页面如实披露。
