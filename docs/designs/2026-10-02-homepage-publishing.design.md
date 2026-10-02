# 首页展示与 HTML 发布

## 来源、目标与合同

2026-10-02 本聊天：用户指出使用数据以 HTML 为主、ZIP 少、GitHub 几乎没有；首页首屏被部署入口占满，看不到应用。用户确认讨论后的整体建议并要求「那你来优化」。既有 AGENTS 授权精确提交、推送 origin/master 和适用部署。

flow=standard，用户交互 L2，前端生产交付 L4；retrospective_state=completed。contract-id=homepage-publishing-20261002，scope-revision=1。单批完成，plan=not-required。本文同时作为轻量 active acceptance ledger。

parent-goal：线上首页首屏展示可浏览的真实作品，HTML 用户能通过连续的标准发布流程得到分享链接，相关分页与状态可信。

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| HP-01 | true | 1280×720 桌面首屏完整展示第一排卡片；390×844 手机首屏完整展示第一张；HTML 主入口、ZIP 次入口可见 | passed | 本地 1280×720 第一排三卡完整；390×844 第一卡底部 810px，无横向溢出 |
| HP-02 | true | GitHub、AI 发布可通过更多方式访问；分类、搜索、热度/时间排序、预览和点赞保持有效，默认推荐优先展示有明确名称/用途并减少同作者重复占位 | passed | HTML/ZIP/更多方式可访问；推荐元数据重排+首排三作者；时间与分类实际切换通过；菜单桌面/手机截图通过 |
| HP-03 | true | 首页 HTML/ZIP/GitHub 选择进入对应输入；HTML 粘贴或文件导入、可选命名、登录、发布、处理中反馈、最终公开链接在同一页面完成；失败重试复用本次项目，双击不创建重复项目 | passed | 真实匿名会话输入→登录弹层→关闭后内容/名称保留；来源 URL 与表单一致；真实 store/creator/executor 回归覆盖三来源、双击、创建失败、失败重试、保存失败不部署、精确 ID |
| HP-04 | true | 探索网格默认可搜索；静置不连续抓取全库，接近实际滚动底部才追加，末页结束；首页分页与缩略图懒加载使用同一实际滚动边界 | passed | Explore 静置 12 卡稳定；真实滚动后 Math 搜索从 12 增至 22，末页无加载更多；main 为唯一实际纵向滚动层；首页 36 候选静置稳定 |
| HP-05 | true | 项目详情显示真实 status；仪表板无虚构健康百分比；GitHub 无效地址不能保存/发布且有可读反馈 | passed | status 映射与数量卡类型检查通过；真实无效地址禁用、有效地址启用；生产 Live/Offline 项目实测分别为运行中/未上线，仪表板数量卡替代100%，local-static 既有项目 GitHub 来源为空且保存/部署禁用 |
| HP-06 | true | 类型、定向 lint、功能回归、构建与 diff review 通过；精确提交推送并发布前端，生产真实入口验收 | passed | typecheck、定向 ESLint、发布回归、探索分类回归、缩略图回归、frontend build 通过；主线普通推送、独立副本 gh-pages 发布、生产脚本 hash 一致、真实 HTML 发布成功 |

## 方案与用户链路

采用紧凑发布条 + 应用网格：顶部一句「把网页变成可分享的链接」，HTML 主按钮、ZIP 次按钮、原生 details 的更多方式（GitHub 与现有 AI 发布卡）。删除大标题区、三张等权卡与独立 AI 大区块；不新建全屏营销页。列表优先方案会使带 HTML 来的用户难找入口；保留大卡方案不能满足首屏目标。1280 与 390 下按实际截图调整间距，不以类名断言代替渲染。

默认推荐使用现有公开 popularity 接口，每页 36 个候选，在首页现有 feed owner 中按明确名称/描述优先、首排作者多样性排序；随机名称、纯数字、草稿/占位描述后置，保留全部项目。明确「推荐」与原「热度/最新」排序区分；筛选和搜索不应用推荐重排。复用已有缩略图 owner；并行截图任务的文件不修改、不提交，本任务不另造截图服务。

访客打开首页 → 首屏浏览作品或点击发布 HTML → 直接粘贴 HTML / 导入文件，可选填写名字 → 点击发布，未登录时在原页面打开现有登录弹层，输入保留 → 再次点击发布，原 DeploymentManager 创建 draft 并执行既有 DeploymentExecutor → 当前页显示实时状态与日志 → 成功显示公开 URL、复制/访问和管理入口。失败留在输入页面，重试复用 draft ID；创建失败可重试，重入页面开始新任务。ZIP 与 GitHub 复用原 source 表单；已有项目管理与访问地址合同保持不变。

创建/执行/重试状态归现有 deployment store/manager：增加本次新发布的 projectId 与创建锁，组件仅展示和调用意图。不恢复未发布文件到磁盘、不新增持久化状态；页面重载丢失未提交内容与文件属于现有浏览器表单行为。业务成功 URL 从本次 projectId 或执行结果解析，避免同名项目误匹配。发布进行中组件字段禁用；路由离开不重置仍执行的 deployment state。

实际滚动边界由共享 getScrollParent 选择具有 overflow 且实际溢出的祖先，否则 viewport；修正 PageLayout 中不受约束的内层 overflow，避免 infinite observer 将整份内容当 viewport。默认 Explore grid，feed 保留为显式切换。

状态使用 project.status（与 isPublic 分开）；仪表板第三张卡改为已加载项目数量，无健康监测承诺。GitHub 地址校验接受标准 HTTPS、SSH 与 github.com/owner/repo，拒绝其它 host/标识；normalize 与校验由现有 frontend utils/project owner 提供，manager 在保存与执行边界再校验。

## 验证与交付

黄金链路：① 桌面/手机首页浏览首排 → 更多方式 → 搜索/分类 → 打开作品；② 首页 HTML → 输入/导入 → 原登录 → 发布 → 公开链接访问，并对比失败重试无重复项目；③ Explore grid 静置卡片数稳定 → 滚到底部正常分页直到终页，项目详情与仪表板状态一致，GitHub 无效/有效输入按钮状态正确。

AI 证据：真实本地前端对生产 API 的公开查询与视觉浏览、生产已登录会话的无害验收 HTML 发布（不覆盖既有项目）、边界测试覆盖创建失败/并发/部署失败后重试/精确 URL、分页滚动 DOM 指标、相关类型和定向 lint、frontend build。发布走仓库 pnpm deploy:pages，核对 gemigo.io 的产物资源与真实页面；不能由 gh-pages 推送推断域名生效。用户验收入口为 https://gemigo.io/，主观审美待用户反馈。

## 方案 Review

mode=design：独立反查用户要求：首屏可见、HTML 权重、少决策连续发布、作品展示与基础质量均覆盖 HP-01–06。更多方式保留旧能力；推荐保留全量结果、不宣称模型元数据已证明应用运行质量。失败与创建锁由唯一 manager/store 处理；普通 JSX 状态与查询复用原路径，无新服务/包/后台。不更改 production Secrets、不触达缩略图并行任务。验证覆盖登录输入保留、发布后精确 URL、失败重试、末页停止及生产身份。design-review=passed，findings=none。

## 实现 Review 与本地证据

mode=implementation，diff-only 检查：项目无 maintainability 入口，按 findings-first 与条件主观复核审查。已关闭发现：① 手机菜单相对单按钮定位越界，改为手机相对发布操作区域；② AI 卡旧 viewport 横排在窄菜单上失真，收为单列；③ HTTP 触发失败吞错导致 executor 写 Live，改为 reject；④ 元数据保存吞错及时间延迟假设，改为真实返回结果；⑤ 创建中的跨项目部署冲突，统一 manager 边界拒绝。修正后对应截图、定向 lint、typecheck 与行为回归全部通过。⑥ 生产出现明确 temporary/临时作品，推荐元数据评分后置并增加回归。剩余 findings=none，implementation-review=passed。无新增服务、依赖或平行创建 owner；旧部署卡与选项无消费者，删除；创建复用原 ProjectCreator 与 draft 路径。

本地命令：`pnpm typecheck`；本任务 TS/TSX 文件及 `scripts/test-homepage-publishing.mjs` 定向 ESLint `--max-warnings 0`；`node scripts/test-homepage-publishing.mjs`；`node scripts/test-explore-category.mjs`；`pnpm test:thumbnail-performance`；`pnpm build:frontend`。构建已有大 chunk/Browserslist 时效警告为非阻塞，本任务未扩大到拆包或依赖升级。

## 生产验收与交付

实现提交 `028fe27`，推荐补充 `11c5ed3`，均普通推送 origin/master。独立 managed worktree 从明确提交构建，运行仓库 `pnpm deploy:pages`，production 为 Cloudflare Pages gemigo 的 gh-pages；未部署其它服务。最终生产 `https://gemigo.io/` 的 `/assets/index-DwjTKpfU.js` 与交付构建 SHA-256 完全一致；桌面 1280×720 第一排三张完整，手机 390×844 无横向溢出、第一卡底部 810px。临时验收作品已移至候选后部。

线上黄金链路：HTML 主入口 → 粘贴示例/指定名称 → 发布 → 同页成功 → 复制链接（clipboard 精确匹配）→ 公开网页实际显示 HTML 发布成功 → 管理进入本次 project ID `b5391e2e-73b5-49e6-955e-919013f4c882`。链接 `https://homepage-publishing-acceptance.gemigo.app/` 可用；已关闭探索可见性，公开 explore 搜索验收名称 total=0，保留用户可恢复的验收项目。HTML 文件 chooser 实际导入成功，内容与按文件名生成的默认名称正确。桌面作品侧栏 iframe 与手机版新窗口均打开 CineFlow AI 实际站点。HP-01–06 required 全部 passed。

用户入口 `https://gemigo.io/`：先看首屏作品，再点「发布 HTML」，粘贴或导入 HTML，名称可留空，点击「发布并获取链接」后复制或打开；登录弹层保留输入。验证边界：真实部署验收使用 HTML；ZIP 与 GitHub 的输入、参数、地址校验与执行合同由回归验证，未在生产额外部署仓库/ZIP。推荐仅按公开元数据降低草稿/临时作品曝光与增加首排作者多样性，未逐个审核作品内容、功能或运行质量。主观审美待用户反馈。

## 复盘与完成门

retrospective_decision=no-increment：可复用的失败/重试/准确项目身份/滚动边界已经落实到原 owner 和回归；无共享方法缺口，不新增全局规则或空日志。生产与本地发现闭环记录在本文，未触碰其它任务的缩略图、字体和 analytics WIP。parent_status=ready-for-completion-check。

completion-check：required IDs 均 passed，验证当前有效，implementation-review findings=none；项目产物已主线提交推送且生产验收；用户入口、操作预期及验证边界齐全；retrospective completed；本任务无未完成阻塞。仅保留其它任务原有 WIP。
