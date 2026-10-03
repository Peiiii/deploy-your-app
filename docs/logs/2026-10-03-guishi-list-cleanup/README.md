# “诡市”重复版本的公开列表整理

日期：2026-10-03（Asia/Shanghai）。原始输入：“这个诡市这个咱们怎么处理呢？太多重复感觉有点污染了咱们的列表”。沿本项目全托管授权完成必要调查、管理操作与线上验证；不是仅交设计。

## 冻结处理

flow=standard（生产运营 L4）；plan=not-required，单批；retrospective_state=completed。复用已经上线的后台 `POST /api/manage` action=visibility，不修改代码、不新建分组模型。当前 `is_public` 是平台公开展示开关：首页/探索和公开作者列表沿既有服务器过滤；R2 Gateway 和 SDK Cloud 不以它禁止原地址访问，作者 mine 列表继续包含其项目。

候选比较：删除/合并项目会损害链接、历史和互动数据；新增展示分组适合长期版本管理但当前处理已有管理能力；现有取消公开展示是最窄、可恢复且有审计的管理路径。采用第三条，只整理已核实的一组重复版本，不按同名跨作者自动治理。

重新查询生产 D1：同一作者 29 个未删除项目，其中 27 个公开 Live、有 URL，2 个 Offline 无 URL。逐一只读 R2 活动 HTML，27 个标题均为“诡市 - 驭鬼者社区”，24 种字节内容，与初始调查一致。它们是本次用户明确要求整理的同作品版本，不据此判定作者恶意。

保留最近成功发布的 `123.gemigo.app`（成功时间 2026-09-29T13:39:08.835Z），并先确认其原网址可访问；它是当前最新版代表，未经质量排名。其它 26 个取消公开展示。两个未上线项目不参与。所有 29 个项目保留、slug/网址/来源/部署历史/统计/互动数据不改。

变更前保存不含邮箱/账号凭证的目标资源映射。后台本地保存的密码已失效（登录返回 401），不改管理员密码、不伪造会话。改由本项目现有已认证 Cloudflare 运维账号，调用原 `manageOperation` 业务函数；临时 D1 CLI adapter 只搬运它生成的 prepared SQL 和 batch 结果，不新增产品写入规则或对外入口。执行前逐项读取目标核对身份/成功时间/当前公开值，沿原 expected=true → isPublic=false 条件更新；原函数生成审计，actor=codex-maintenance，明确区别于后台网页登录。遇到不一致或请求失败立即停止，按记录查实际状态，不盲目重放。可通过现有后台接口 expected=false → isPublic=true 撤销已应用项，恢复公开展示；不创建另一写入 owner。

方案 Review(mode=design)：通过。核对过同作者同标题但不同内容、未上线项目、同名其它作者、代表不可访问、并发更新、部分执行、分页 count、公开作者列表和原链接/SDK 边界；保留版本不是永久 canonical，也未自动建立作者认可的版本归属。该次治理使用用户指定对象和已核实内容，不扩展为全站同标题拦截。

## 验收合同

contract-id=guishi-list-cleanup-2026-10-03；parent-goal=当前诡市重复版本不再刷屏公共列表，原应用及链接保留。

| ID | Required | 标准 | 状态 |
| --- | --- | --- | --- |
| GC-1 | true | 27 个候选逐一证据确认；最新可访问代表保留；只隐藏其余 26 项，2 个未上线及其它作者不动 | passed：27 个 R2 标题/24 种字节；代表及 2 草稿不改，26 项取消公开 |
| GC-2 | true | 首页/探索的排序、分页、搜索、分类/语言沿服务器过滤，候选仅一项公开，总数减少 26，原链接仍可访问 | passed：572→546，recent/popularity 各 11 页均仅 1 代表；搜索/中文/分类检查，27 原网址均 200 |
| GC-3 | true | 29 个项目/网址/部署/互动不丢，26 条管理审计；保存明确可恢复的目标映射，不修改凭证或发送作者通知 | passed：29 项目/65 部署/互动和统计行数不变；R2 27 指针与 hash 不变；26 审计及恢复映射 |
| GC-4 | true | 真实生产操作与 API/浏览器验证完成，记录精确提交推送，主工作区 master 与实际远端一致；无需代码部署 | passed：生产操作/API验收与 Review 完成；本任务记录精确提交推送和 master 同步，不需要部署代码 |

交付通道 Review 补充：管理 API 登录不可用是凭据现状，不通过重置密码、插入登录 session 或部署新管理端点恢复。已认证的 Cloudflare D1 运维权限可完成本任务的数据操作；复用原业务函数，仅使用临时 adapter 承接 D1 prepared/batch，不持久化第二套管理规则。通过该窄路径，仍核对原函数的 compare-and-set 和审计返回。

## 生产验收与交付

用户补充明确要求直接操作数据，并确认 Cloudflare 权限。已通过现有认证 Wrangler D1 通道执行，不操作后台登录页面完成数据变更，不修改管理密码或认证状态。原 `manageOperation` 生成的 26 组 visibility UPDATE＋条件 audit INSERT 已实际执行；D1 query 的每条 result/meta 分别核对原函数 compare-and-set 返回，全部成功。

生产 API 最新排序、热门排序均遍历所有 11 页：total=546，完整读取 546 项，ID 无重复，26 个目标全程不出现，保留项出现一次；处理前 total=572。搜索“诡市”、中文语言和代表分类读取无隐藏项。既有服务器过滤在 COUNT/LIMIT 之前生效，没有前端去重或页内空洞。

27 个原网址在操作前后均 HTTP 200，HTML 标题一致；R2 活动 prefix 和 HTML sha256 全部保持。29 个项目的 name/slug/url/status/is_deleted/last_success_at 都与变更前一致，只有 26 项 is_public=0（及管理函数正常更新时间）。项目数 29、部署记录 65、点赞 0、收藏 0、D1 统计行 1，操作前后一致。保留现有应用运行和业务存储，不合并统计、不删除项目或文件，不通知作者。

证据：[目标/恢复映射](targets.json)、[操作前](before.json)、[实际执行](applied.json)、[操作后与审计](after.json)、[记录计数前](metrics-before.json)、[记录计数后](metrics-after.json)。这些文件不含邮箱、owner ID、管理密码或 Cloudflare/R2 Secrets。

恢复：从 targets.json.hidden 逐项取 id，在现有后台“应用运营”恢复公开展示，或用同一个 manageOperation(action=visibility, expected=false, isPublic=true)。只对本次已应用项恢复；当前值/资源已变化时刷新核对，不批量覆盖其它编辑。最新代表和两个 Offline 项均不在恢复清单。

实现/操作 Review：no findings。确认只复用原状态与原业务函数；没有新数据库列、协议或代码部署；临时运维 adapter 不成为产品入口。检查写入目标、原 SQL 的 expected 比较、changes 条件审计、未知结果不重放、凭证保护、原链接与分页验收；文档/证据 diff 检查通过，不为没有源码变更运行类型检查或构建。

AI acceptance=ready；当前处理线上已生效，用户可刷新 [探索列表](https://gemigo.io/explore)，或打开保留版本 [诡市](https://123.gemigo.app/)。这是本次已确认版本的可恢复整理，没有新增自动识别/永久展示分组；作者未来新建独立项目仍沿原发布合同，未承诺自动阻止全部未来重复。

retrospective_decision=no-increment：现有后台可见性业务能解决此单组列表污染，无需按早期推荐先建设分组体系；已有最窄 owner/零改动检查充分。权限通道与结果已在本记录说明，不新增共享规则或产品状态。parent_status=ready-for-completion-check。
