# 首页应用列表性能修复

flow=bugfix；task-type=bugfix；风险 L3，生产交付 L4；retrospective_state=completed。

## 目标与证据
用户要求按后端最佳实践优化全量读取、统计、排序后分页，并亲自测量进入首页至应用图片真正显示的时间。已有项目授权覆盖精确提交、推送 master、API 部署及线上验收；前端其它任务的未提交改动不在本次修改范围。

线上公开 Live 应用 564 个。旧热度路径拉回全部记录，按每批 90 个 ID 查询点赞/收藏、访问统计，串行执行七批；常规请求约 23 个 SQL 语句、约 15 次依赖往返，再由 JS 排序切页。生产 D1 在 NRT，浏览器请求落在 LAX。图片缓存命中耗时约 3–4ms。
同浏览器普通重新加载三次，首排三张图片 complete、naturalWidth>0、尺寸>0、位于首屏且 opacity>=.99 时记录可见：9.111、12.527、8.156 秒；接口耗时 6.957、6.695、3.125 秒。首排应用为 CineFlow AI、Geeglo、qingshui。DOM 轮询误差约 .13–.49 秒。线上前端其它任务更新是外部变量，测量同时记录接口开始时间。

## 单一实现方案
project repository 复用现有筛选条件，增加公开探索分页查询，使用参数绑定的 SQL 执行统计、排序、LIMIT/OFFSET；COUNT 与分页 SELECT 放入同一 D1 batch。只返回页内项目和对应点赞/收藏计数。数据库仍必须考察筛选后的热度候选，但不跨 Worker/D1 边界传输全部项目或分批发统计查询。
点赞/收藏用 project_id 索引计数，访问量用已有 (slug,date) 索引和 human_views，近七天含今天。热度优先级保持访问量、收藏、点赞、部署时间；相同条件以 id ASC 确定跨页顺序。统计键使用现有排序读取的 slug ?? id，缺失统计为零，不扩展为 URL 回填。生产两条缺 slug 记录的 id 无访问统计，原路径按 URL 查询但按 id 读取，因此效果同为零。最近排序不查询访问表。仅当前页作者交给既有 publicAuthor owner 补充，不改变响应字段和隐私政策。
复用各 repository 的 schema bootstrap owner；不创建迁移、不建立独立缓存或热度预计算体系。冷启动保留现有 schema 确保过程，与热路径分开验证。控制器增加 Server-Timing 的 explore 服务总时长，便于区分后端与网络/前端等待。

## Required 验收合同（active）
| ID | 可观察判定与证据 | 状态 |
| --- | --- | --- |
| EXP-1 | 真实 Miniflare D1：公开可见条件，搜索/分类/tag/扩展筛选，热度/最近顺序，7天 human_views，页间无重复，空/越界页 total 正确；响应作者不泄露邮箱 | passed（证据见下） |
| EXP-2 | >90 个项目仍为两条分页/总数 SQL 的单一 batch，加当前页作者查询；无全量项目返回、全量 ID 统计或 Worker 排序；EXPLAIN 使用统计索引 | passed（证据见下） |
| EXP-3 | 同线上浏览器/视口/普通刷新/图片缓存条件，至少三次导航至首排图片可见的中位数比 9.111 秒减少 >=30%；同时报告 API 和可见时间及冷/热差异，不选单次最佳值 | passed（证据见下） |
| EXP-4 | API tsc、定向 lint、实现 review findings 清零；精确提交推送 master，部署仅 gemigo-api；线上图片实际显示，Server-Timing 可见 | passed（证据见下） |

## 方案审查（实现前）
mode=design；no findings；design-review=passed。方案覆盖从导航、列表请求到图片加载与淡入结束的实际用户链路；保留公共过滤、排序优先级和作者策略，明确确定性相同排序与 legacy 统计键边界；真实 D1 对分页/统计与索引给证据；线上三样本门槛在实现前固定。后端查询索引已存在，不依赖大范围持久化迁移。DDL 冷启动和前端请求开始偏晚作为独立剩余变量，如最终指标失败须继续调查，不降低门槛。

## 实现与发布前验证
EXP-1/EXP-2 current passed：`scripts/test-explore-performance.ts` 在真实 Miniflare D1 上以 206 个公开候选和五种不可见行验证所有筛选、近七天 human_views（排除过期/机器人流量）、排序优先级/确定性并列、连续页与越界页、legacy null 删除标记/缺 slug、页内计数及 publicAuthor 邮箱遮蔽。热路径 prepare 仅三次（总数、页、页内作者），总数和页共一个 batch，最近排序完全不访问统计表。EXPLAIN 确认三个统计子查询使用 SEARCH 索引。
API `pnpm exec tsc -b workers/api --pretty false` 和改动文件 targeted ESLint 通过，diff --check 通过。
mode=implementation review：no findings。已核对原始用户目标、共享筛选抽取前后条件、SQL 参数顺序、总数/空页、date window、索引、schema owner 引用无循环、响应 map 与作者边界。删除旧全量统计/JS 排序路径；无缓存双状态。项目无适用 diff-only maintainability 入口，按 findings-first 与跨 repository 主观维护性审查完成。剩余边界：首次 isolate 的原有 schema bootstrap 往返、前端启动请求延迟；由线上 EXP-3 测量判断，当前不宣称最终性能达标。
EXP-3 与 EXP-4 线上部分 pending；仅部署 API Worker，回退使用发布前 Worker version。

## 线上验收与交付
生产 API Worker version `2d933a5e-865f-4390-953a-912722157c65` 已于 2026-10-02 15:14 UTC 部署；源提交 `13c01d6` 已普通推送 origin/master。部署前 version `77d6767e-887a-4a55-b0c9-3ad8ed825422` 为回退入口；未修改 Secrets、未部署其它 Worker/前端。

同一线上首页、浏览器及 1280×720 视口，以 CDP navigation wallTime 起算；轮询首排三图 complete + naturalWidth>0 + 尺寸>0 + 在首屏 + opacity>=.99，并用实际渲染截图确认。普通刷新且图片浏览器缓存命中：

| 样本 | 修前图片可见(s) | 修后图片可见(s) | 修前接口(s) | 修后接口(s) | 修后服务端(ms) |
| --- | --- | --- | --- | --- | --- |
| 1 | 9.111 | 2.865 | 6.957 | .779 | 246 |
| 2 | 12.527 | 2.301 | 6.695 | .802 | 238 |
| 3 | 8.156 | 2.146 | 3.125 | .756 | 238 |
| 中位数 | 9.111 | 2.301 | 6.695 | .779 | 238 |

图片可见中位数减少 74.7%，接口减少 88.4%，EXP-3 的 >=30% 门槛通过；首排应用仍为 CineFlow AI / Geeglo / qingshui。这里是当前实际网络经 LAX 的测量，并非国内各地区网络统计。DOM 轮询采样误差修前 133/213/492ms、修后 1364/360/146ms，记录的是达到可见条件的保守观测上界；API 使用 CDP 精确网络时间。首次上线后的样本与后续两次分别报告，但无法保证首次请求命中全新 isolate，不冒充受控生产冷启动测量；真实 Miniflare 测试已覆盖全新数据库初始化。

补充禁用浏览器缓存三样本：图片可见 8.777/7.283/7.445 秒（中位数7.445）；API .655/.945/.792 秒；列表发起在导航后5.473/4.460/5.026秒，首图传输2.085/1.081/.433秒。第三次主 JS 189KB、CSS14KB 的 REVALIDATED 网络耗时约4.69秒，CDN HIT 的部分非首排图片仍耗时2–3秒。该条件会强制重验证，不能等同于普通新用户首次访问；无修前同条件基线，不报告该分支改善比例。缓存禁用已恢复，Network 观察与临时标签已清理。这说明本次后端瓶颈已解决，静态资源重验证和图片并发调度仍有独立优化空间；原用户“看一下是否有优化空间”的调查已给真实证据，最新“必须优化后端”的实现已完成。

EXP-4 current passed：部署返回新 version，真实首页消费新 API，Server-Timing 显示233–246ms，首排图片实际渲染正常，契约/类型/lint/实现 Review 有效。本任务前端无实质修改，保护原工作区 WIP。新增 legacy 夹具后的测试曾遇到 Miniflare bridge ECONNRESET，重跑完整真实 D1 测试通过；没有用该失败冒充通过。
EXP-1、EXP-2、EXP-3、EXP-4 全部 current passed；交付入口 https://gemigo.io/，用户普通刷新首页即可核验应用列表图片显示；状态为已交付待体验验收，不宣称用户已确认。

retrospective_state=completed；retrospective_decision=no-increment：数据库内分页/避免串行全量统计已由实现与真实 D1 回归测试固化，性能口径和缓存边界留在本任务唯一记录，无需增加全局规则或新知识条目。用户体验反馈到来时仍沿该目标和证据修复。Lifecycle 完成核对：实现、AI 验证、授权部署与有效入口齐备，全部 Required passed；提交本记录后结束本轮交付。
