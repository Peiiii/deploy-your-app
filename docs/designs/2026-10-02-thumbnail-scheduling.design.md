# 首页截图调度修复

- contract-id: thumbnail-scheduling-2026-10-02
- parent-goal: 新上线的公开产品及时获得首页截图，恢复当前缺图。
- 来源：2026-10-02 用户要求“为什么隔了数小时都还没有完成排查一下是什么问题？修复一下。”；AGENTS.md 授权验证、精确提交、推送和线上交付。
- flow: bugfix；risk: L4（生产任务宿主变更）；retrospective_state: pending。
- reproduction: 线上运行记录与截图 HEAD 原触发取证；plan: not-required（单批交付）。

## 已确认现状

`capture-thumbnails.yml` 的 `*/5` 定时事件在 02:31:32Z、08:57:39Z 才创建运行，间隔 6 小时 26 分钟。后一轮在 08:58:35Z 前完成全部 7 张缺图；手动触发也正常完成。断点是任务触发，不是 Chromium 截图或 R2 上传。GitHub 明确不保证 schedule 准点执行，高负载时可延迟或丢弃事件：
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

现有唯一截图实现为 `scripts/capture-missing-thumbnails.py`：D1 查最近 50 个公开 Live 产品，中央缩略图 HEAD 判断已有图，Chromium 截图并压缩后写 R2。首页使用同一 R2 中央入口；可见卡片已有轮询。生产后端使用 Docker，已有 SSH、D1 和 R2 部署 Secrets，截图任务可独立部署，无需修改或重启应用后端。

## 用户链路与方案

部署者沿现有入口发布公开应用，应用马上出现在首页；常驻截图容器启动即扫描，之后每轮结束等 60 秒再扫描。缺图时生成真实页面截图并写原 R2 路径，首页原轮询刷新或重新打开后显示截图。正常轻负载、应用可访问时，从缺图被发现到存储完成应在 2 分钟内；外部网络、不可访问应用与高积压不能保证该时限，日志须暴露失败。

比较过：仅调整 GitHub cron 仍受同一不可靠触发限制；用外部定时器触发 GitHub 还需要新凭据和跨系统调度；在现有生产服务器运行独立截图容器能复用凭据、脚本和恢复方式，因此采用后者。容器独立限制 CPU/内存，不把浏览器加入后端请求链路。

- 保留现有截图脚本、R2 对象格式、最近 50 项扫描和每轮 20 张上限。
- 扩展现有脚本的 `--watch` 模式，捕获单轮异常并下一轮重试；单应用 HEAD 错误跳过该应用并报告，不能阻断其它应用。
- 每次成功完成扫描写入健康时间（包括部分截图失败）；D1/扫描整体失败不能刷新健康时间。健康检查允许完整一轮的有界执行时间。
- 已有截图不覆盖；截图后再次判断是否有人上传了封面，R2 条件写避免覆盖并发生成的 WebP。
- 新增独立 Dockerfile 和部署脚本/工作流，复用现有 GitHub SSH、D1、R2 Secrets。后台容器 `restart=unless-stopped`，受管的生产日志轮转，启动即执行，部署等待一次扫描再验证。
- 移除 GitHub schedule，只保留手动恢复入口。常驻进程是自动调度唯一 owner，截图算法不复制。
- 失败可通过生产容器日志和 Docker health 查询；暂时网络故障继续下一轮，进程/主机重启由 Docker 恢复。
- 回滚：重新运行旧版本截图部署流程；临时停止截图容器后可手动运行原工作流。后端和现有截图数据不受影响。

## 抽象与边界审计

最小路径是 D1 → 现有截图脚本 → R2 → 原首页卡片。新增容器和部署入口仅拥有常驻任务宿主与生命周期；不新增队列、调度服务、凭据类型、API/UI 或并行截图算法。不迁移 R2 数据。GitHub 手动工具是故障恢复入口，不是第二个自动 owner。

## 活跃验收账本（scope-revision: 1）

| ID | Required | Status | 判定与当前证据 |
| --- | --- | --- | --- |
| TS-01 | true | passed | 原断点有运行日志；36987019682 保存 7 张且全部成功，任务约 1 分钟完成。 |
| TS-02 | true | not-run | 生产常驻容器启动即执行且至少两个扫描周期相隔约 60 秒；自动路径不依赖 GitHub schedule。 |
| TS-03 | true | passed | 12 项 unittest 回归通过：失败隔离、下一轮恢复、60 秒间隔、原有/并发封面保护、部署凭据和后端隔离；bash -n、actionlint、diff check 通过。 |
| TS-04 | true | not-run | 生产真实缺图由常驻容器自动生成，中央入口返回 WebP，首页可读取；最近首页缺图清零（应用可访问前提）。 |
| TS-05 | true | not-run | 本任务文件精确提交并同步 origin/master，新容器健康，后端保持可用，无关 WIP 未修改。 |

设计 Review：passed。独立从用户目标核对触发延迟、独立运行资源、单应用失败隔离、重试、旧封面保留、原首页消费与主线交付；无开放 finding。验证按脚本回归、bash/YAML 静态检查、生产镜像构建和线上完整路径执行；本次不触达 TypeScript，无新增类型检查范围。

## 当前执行状态

stage: delivery（生产构建和验收待执行）；open-required: TS-02, TS-04, TS-05。

实现 Review：no findings。项目无 diff-only maintainability 工具，已按 diff 与相邻边界审查：生产资源隔离、凭据不出现在 Docker argv、候选配置检查先于替换、现有对象保护、错误隔离和日志/健康语义一致。Docker 本地 daemon 未运行，镜像构建由部署工作流在替换生产容器前执行，失败会停止部署。
