# 首页截图调度修复

- contract-id: thumbnail-scheduling-2026-10-02
- parent-goal: 新上线的公开产品及时获得首页截图，恢复当前缺图。
- 来源：2026-10-02 用户要求“为什么隔了数小时都还没有完成排查一下是什么问题？修复一下。”；后续要求“能通过github 完成最好。减少对成本服务器的依赖”，明确选择“GitHub 截图，Cloudflare 免费定时器负责触发（推荐；不占用阿里云服务器）”。AGENTS.md 授权验证、精确提交、推送和线上交付。
- scope-revision: 3（用户要求优化成本与增量处理）；flow: standard；task-type: small-change；risk: L4；retrospective_state: pending。
- reproduction: 线上运行记录与截图 HEAD 原触发取证；plan: not-required（单批交付）。

## 已确认现状

GitHub `*/5` 定时事件在 02:31:32Z、08:57:39Z 才创建运行，间隔 6 小时 26 分钟。后一轮在 08:58:35Z 前完成全部 7 张缺图，手动触发也正常完成。断点是任务触发，截图和 R2 上传约 1 分钟即可完成。GitHub schedule 不保证准点，高负载时可延迟或丢弃事件：
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

截图唯一实现为 `scripts/capture-missing-thumbnails.py`：D1 查最近 50 个公开 Live 产品，中央缩略图 HEAD 判断已有图，Chromium 截图压缩后写 R2。首页消费同一 R2 中央入口；可见卡片已有轮询。仓库为公开仓库，GitHub 标准 runner 免费。Cloudflare 可运行轻量 scheduled Worker；每 2 分钟两次 GitHub API 请求，约 720 次调用/日，不执行浏览器、读取 D1 或存储截图。

## 用户链路与当前方案

部署者沿现有入口发布公开应用，应用马上出现在首页；Cloudflare 的每 2 分钟定时器检查截图工作流，没有进行中/排队的任务时调用 GitHub workflow_dispatch。GitHub 沿原脚本捕获缺图，写原 R2 路径，首页原轮询刷新或重新打开后显示截图。应用可访问且正常轻负载时，从部署成功到真实封面就绪的验收目标为 5 分钟内；GitHub runner 排队、慢网络、大积压与不可访问应用不能保证该时限，必须记录失败和重试。

候选比较：仅调整 GitHub cron 仍受相同不可靠事件限制；在 GitHub 长时间占用 runner 轮询增加空转；Cloudflare 只触发 GitHub 能保留现有截图 owner 和执行环境，满足用户明确选择。因此采用外部轻量定时触发。

- `workers/thumbnail-trigger` 只负责 GitHub 调度，无公开 HTTP 路由、无 D1/R2 绑定。
- 单一自动触发主链路为 Cloudflare Cron → GitHub dispatch → 现有 Python → R2 → 原首页卡片。GitHub schedule 改为错峰兜底，人工 dispatch 继续可用。
- 两次 GitHub API 请求各有 10 秒超时；查询/触发失败抛出可观察错误，下一轮重试。正在运行/排队时跳过，工作流继续用 concurrency 防止并发截图。
- GitHub 授权存 Cloudflare Secret，日志不包含凭据或完整 GitHub 错误体；不写源码/仓库文件。可用仓库 Actions write 的专用 fine-grained token，也可使用当前已授权 GitHub 登录的 token；后者权限较宽，须限制 Secret 消费为此无公开路由 Worker，轮换时替换同名 Secret。
- 复用 Python 脚本、R2 格式、最近 50 项与每轮 20 张上限；单应用 HEAD/截图失败不阻断其它可访问应用；定时重试。截图后再检查用户封面，R2 条件写避免覆盖并发 WebP。
- 移除未上线的阿里云常驻容器、镜像与部署工作流。原部署运行 36988975350 已取消，Start and verify worker 为 skipped，未启动任何生产截图容器。
- 回滚：取消 Cloudflare cron（crons=[]）并恢复旧 Worker 版本；手动执行 capture-thumbnails.yml 可恢复截图。现有后端和 R2 数据不迁移。

## 边界与抽象审计

新 Worker 只拥有定时触发，不复制截图算法、项目查询或存储状态。GitHub 工作流仍是截图执行 owner，R2 是封面 owner。新 Token Secret 是外部调度认证所需，不新增队列、持久任务状态或公开 API。GitHub 错峰 schedule 是恢复兜底，不能承诺它准点。不再依赖阿里云后台任务。

## 活跃验收账本

| ID | Required | Status | 判定与当前证据 |
| --- | --- | --- | --- |
| TS-01 | true | passed | 原断点有运行日志；36987019682 保存 7 张且全部成功，任务约 1 分钟完成。 |
| TS-02 | true | passed | Cloudflare Workers Logs 记录 10:12:07Z、10:14:07Z、10:16:07Z 的 scheduled/dispatched，outcome=ok，CPU 各 1ms；对应 GitHub 36994151091、36994339571、36994528211 成功。阿里云工作流启动步骤 skipped，未启动截图容器。 |
| TS-03 | true | passed | Worker tsc、targeted ESLint、调度回归（进行中/排队跳过、鉴权/上游失败、下一轮恢复、错误体不泄露）和 9 项 Python 回归（失败隔离、原有/并发封面保护）通过；actionlint、Wrangler dry-run、diff check 通过。 |
| TS-04 | true | passed | 生效后 CLI 真实部署 thumbnail-smoke-1790936025：10:16:16.156Z 成功，自动任务 36994528211 在 10:17:06.455Z 保存 13,490 字节 WebP，10:17:10.196Z HEAD 200（54 秒），首页实际显示截图。10:20 自动任务 36994893111 scanned=50 pending=0 readiness_errors=0；原缺图 7 项和 xiaoyv 均 HEAD 200 image/webp。两个临时项目与 8 个已知 R2 测试对象已清理。 |
| TS-05 | true | passed | 实现提交 dbbf4b1 已普通推送 origin/master，线上自动任务采用包含该提交的 master；工作区原有分析脚本改动与未跟踪文件保留，未提交 Secrets。原首页正常可用，API/后端未由本任务重部署。 |

设计 Review（revision 2）：passed。从原用户目标核对自动触发、成本/宿主约束、鉴权、超时/下一轮恢复、重复运行、旧封面、原首页消费和主线交付；无开放 finding。验证采用 Worker 定向类型/lint、回归、Wrangler dry-run、生产 Cron 和 CLI 完整链路。不触达 API Worker/后端运行链路。

## 当前执行状态

stage: implementation（revision 3 方案审查通过）；open-required: TS-02 至 TS-07。上方 revision 2 的运行证据保留为历史，TS-01 不受影响，其余受影响证据暂为 stale。

## Revision 3：增量与成本优化

来源：用户“那你优化吧”，并要求确认方案是否高效、是否每次扫描全部。基线每两分钟扫描最近 50 个产品，经图片 Worker HEAD 读取 R2；实际一次 D1 查询 rows_read=1144。空闲仍消耗 50 次图片 Worker 调用，且启动 GitHub。

采用 D1 待处理队列而非永久封面状态：`thumbnail_jobs` 只记录未完成工作，R2 仍是封面唯一 owner。数据库 INSERT/UPDATE 触发器覆盖现有 API 和后端两种 projects 写入入口，公开 Live 且有 URL 的新发布/重新发布/可见性变化入队；私有、删除、不可用状态撤销任务，物理删除由外键清理。每项目一个任务；随机 generation 与条件删除/重试防止正在执行的旧任务清掉新任务。项目无关更新不触发。

Cloudflare 每两分钟通过 next_attempt_at 索引查询一项到期任务；空队列直接返回 empty，不访问 GitHub/R2。有任务才检查工作流并 dispatch，显式 reconcile=false。GitHub 每轮最多处理 20 个到期任务，直接 R2 head_object 检查 WebP 或大于 80 字节的旧 PNG；现有图立即完成任务，缺图才加载 Chromium。截图后复查任务 generation 和封面，保留已有/并发封面，继续条件写 WebP。失败按 2/4/8 分钟至最多 1 小时退避，单任务失败不阻断其它任务；重试日志只含类型/HTTP 状态。

每小时 GitHub schedule（错峰）及手动默认 reconcile=true，检查最近 50 个公开 Live 产品作为既有缺图、队列丢失或外部删除图片的修复兜底，直连 R2，不经图片 Worker。成功任务不保留平行 ready 状态。未扩大历史全量回填范围。与每轮改成直连 R2 相比，队列多一个小表和触发器，但消除了空闲遍历、GitHub 启动以及缺图超过最近 50 项后的遗漏；与 GitHub cache 水位/持久 JSON manifest 相比，数据库触发器不依赖缓存存活或遗漏可见性变化。

冻结验收：正常轻负载新公开部署 5 分钟内有真实首页图；两次连续生产空闲 tick 为 empty，零 GitHub dispatch、零 R2 操作；代表性 50 项已有图的 hourly 修复不生成截图，最多 100 个 R2 HEAD，零图片 Worker HEAD，队列查询使用索引。记录生产 D1 rows_read、GitHub R2 检查次数、实际端到端样本，不用理论免费额度代替实测。每天常规空闲调度仅 720 次 Worker 与 720 次小索引 D1 查询；小时修复最多 2400 R2 HEAD/日，不随全部产品增长；实际费用仍取决于账号其它业务及套餐。

新增 TS-06 Required pending：上述空闲与 50 项修复成本口径有效证明。新增 TS-07 Required pending：真实 SQLite migration/触发器组装测试覆盖发布、私有转公开、退避、删除、重新发布 generation、无关更新；旧任务不能删除新任务，原封面/并发保护和失败隔离回归通过。TS-02/03/04/05 按新运行链路重验。

发布顺序：先定向测试、类型/lint、actionlint、dry-run 和 diff Review；只执行新增 additive migration（不重放旧迁移），旧调度仍可运行；精确提交推送，GitHub 新脚本可处理空表并由一次手动 hourly 模式修复旧缺图；部署带 D1 绑定的触发 Worker；连续 Cron 与真实临时公开部署验收、清理。没有 API/阿里云后端部署。回滚旧 Worker 与工作流即可恢复旧扫描，新增表可保留；停用触发器时只 drop 本次两个 trigger，不能改 projects/R2 数据。

设计 Review（revision 3）：passed。核对两类真实写入入口、索引空闲查询、截图唯一 owner、取消/退避、generation 竞争、旧 PNG 语义、小时兜底、升级/回滚顺序以及完整部署→队列→Cron→GitHub→R2→首页黄金链路。无开放 finding；上述门槛在实现前冻结。

实现 Review（revision 3，发布前）：no findings。17 项真实 SQLite 触发器/队列与 R2 合同回归、Worker 定向 tsc/ESLint/调度测试、actionlint、Wrangler dry-run 通过。本任务 diff-only check 通过（其它前端任务的 whitespace 不属于本次范围）。无现成 maintainability 命令，按 diff 和相邻数据库写入/图片网关合同审查。新增状态只为当前增量消费者服务，成功删除、失败退避，无永久 ready 副本；原 R2/截图 owner 与工作流 concurrency 继续复用。生产 EXPLAIN 证明修复查询两个分支都使用 idx_projects_public_sort；生产迁移/定时与端到端证据待交付阶段补齐。

实现 Review（revision 2）：no findings。项目无 diff-only maintainability 工具，按本任务 diff 与相邻合同审查。调度复用 GitHub 实际运行状态，不复制项目查询/截图算法；Worker 无 HTTP 入口；凭据保存在 Secret 且不进入错误体/日志；失败由下一次 Cron 重试；人工与兜底并发由现有 GitHub concurrency 隔离。未触达 API Worker、后端或其它工作区前端改动。

## 生产交付与复盘

生产 Worker 当前版本为 f7a68aaa-f7c6-4b02-828e-26b7d95f203f，流量 100%，Cron 为每 2 分钟，workers.dev 与 preview URL 均关闭。该版本是同一实现设置 Secret 后生成的版本；凭据由已授权 GitHub 登录安全写入 Cloudflare Secret。

初次启用存在真实未通过证据：Cron 配置创建于 09:44:09Z，09:59 部署的第一份测试页面超过 5 分钟仍无图；为隔离执行链路，手动任务 36993996461 在 10:11 成功保存它与 xiaoyv。首条自动调度记录直到 10:12 才出现，约 28 分钟后，不能把 Cloudflare 部署返回成功或文档中的传播时间当作实际生效证据。自动调度生效后重新部署独立测试页面，54 秒完成全链路，随后持续每 2 分钟触发。首次启用等待与正常运行时限分开记录；未推断首次延迟的内部平台原因。

复盘增量归入现有事实 owner `workers/thumbnail-trigger/README.md`：新定时器交付须看到连续两条实际调度事件和对应 GitHub 运行，首次启用可人工补图。无需新增跨项目 Skill 或平行规则。交付 diff-only 检查与实现 Review 无开放 finding。
