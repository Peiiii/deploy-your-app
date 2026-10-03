# 发布名称与地址明确分离

## 目标与授权
用户指出项目名称暗中决定子域名、中文回退与重名改写难以预期，接受“名称自由填写、地址自动建议且常显可修改”方案，并要求直接上线。保留现有品牌紫色、主卡片与常显名称；不增加步骤、独立卡片或高级配置。名称与地址在宽屏并排，在手机纵向排列；同一组信息不会把桌面主按钮推得过远。feature / standard，跨前端、Worker 与 D1 写边界 L3；部署按 L4 验收。plan=not-required，单批闭环，retrospective_state=pending。

## 现状与选择
名称保存于 deployment.store，ProjectCreator 创建草稿，ProjectManager/provider 调用 Worker draft，再由既有 executor 发布。草稿用 slugify(name)，纯中文变 app，ensureUniqueSlug 静默加数字；改名称不修改已有 slug。设置页已区分名称/slug，并在 Live/Building 时禁改，数据库写入目前没有原子排他保障。保留现有 projects 表、草稿与发布 owner，不建平行项目或预留表。
候选：只加说明无法预判结果；纯随机独立地址缺少可记忆建议；采用独立展示+自动建议+可修改，多一行信息换取结果透明。英文名称生成可读建议，纯中文/空名称用本次稳定的 app-短随机后缀，不做 AI 翻译或拼音依赖。手动编辑后不随名称/来源变化，已创建草稿重试保留地址。

## 用户链路
发布页添加内容，填写任意展示名称；名称说明支持中文、可后续修改。下方完整发布地址一直可见，默认不需要输入；点击“修改”原地编辑子域名，后缀固定。格式错误就地说明；300ms 防抖检查可用性，提示尚未预留。被占用展示可用建议，用户点击采用，不默默换址。网络检查失败可重试，实际提交由后端最终判定，不以预检当预留。
发布先要求原有登录，再将页面展示的精确 slug 随 draft 一起保存。后端原子排他写入；冲突返回 ADDRESS_TAKEN，前端保留内容与名称并回到地址提示，绝不发布到替换地址。失败重试复用原草稿，可在从未成功发布时改地址；成功结果的链接必须对应展示值。名称修改不影响既有地址；已有 Live/Building/曾成功的项目地址不得被改写。原来源、上传、认证、发布日志与诊断链保留。

## Owner 与协议
地址草稿和稳定随机后缀在现有 deployment.store；局部 publication-details helper 负责名称 fallback/建议/格式，表单 hook 只负责异步检查和过期请求取消。IProjectProvider 增加检查方法与 draft 可选 slug，mock 同步传播。Worker GET /projects/address-availability 返回 available、domain、suggestion；只返回占用布尔，无项目详情，排除当前草稿须核对本人权限。draft 的 slug 可选，缺省保留旧调用方行为；提供时严格使用小写字母、数字和连字符、1–63字符且首尾不能为连字符。PATCH slug 同样拒绝非法与占用值，名称 PATCH 保持不变。
project.repository INSERT SELECT WHERE NOT EXISTS / UPDATE WHERE NOT EXISTS 在单条 D1 写操作中保护活动 slug 唯一，无全库迁移、无新表、无新索引。冲突是可恢复 409；预检并发后仍由写时检查守护。老项目与不提供 slug 的旧 draft 调用保持可用，旧生成路径如果遇到竞争返回可恢复错误而非覆盖他人内容。

## Active acceptance contract
contract-id=publication-address-2026-10-03；parent-goal=用户发布前能理解、看到并选择最终地址，保留现有流程与品牌，线上可用。
| ID | Required | 标准 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| PA-1 | true | 名称/地址常显、中文/英文/空名建议、手动地址不随名称变、宽窄屏/主题布局 | not-run | 待验 |
| PA-2 | true | 格式/占用/检查失败/过期响应正确反馈，可用建议明确采用 | not-run | 待验 |
| PA-3 | true | draft 精确保存地址、并发冲突不静默换址、名称修改不改链接、已发布地址保护 | passed | test-publication-address.mjs：真实 Worker/Miniflare/D1 HTTP、同时创建/更新只有一方成功 |
| PA-4 | true | HTML/ZIP/GitHub、登录、失败重试复用草稿，原发布链保留 | passed | test-homepage-publishing.mjs + deployment-metadata/completion 回归；登录与线上发布待 PA-5 复核 |
| PA-5 | true | Worker先于前端上线，线上页面与API当前版本可用，提交推送且本地master=远端实际SHA | not-run | 待验 |

验证：前端/Worker tsc、定向 lint/build、现有发布回归；真实 Miniflare+D1 HTTP 精确合同与并发排他，线上公开预检与私有QA草稿/名称修改/清理。真实线上 UI 渲染检查桌面/手机及地址编辑；先前本地浏览器动作受安全策略阻止，不绕过，使用允许的 HTTPS 线上入口；无法取得的视觉证据如实报告。外观最终由用户判断。只部署受影响 gemigo-api 与网站 Pages，不部署 Node/其它 Worker；保留 Secrets。

## 方案 Review
通过。按中文命名、英文重名、预检后竞争、失败后改址/改名、改名已有链接等反例核对，显式地址不静默改写；原子写入解决预检竞争，无持久预留复杂度。既有身份/草稿/发布 owner 复用；生成地址不是预留的提示明确。未关闭 findings：无。

## 实现与源码验证
复用原名称解析并移至 publication-details，地址建议/验证同源；store 保存本次随机种子、手动地址与提交错误。Worker 排他写入同时防止发布状态竞态导致的改址，允许旧的缺失 slug 补全。前端/Worker tsc、定向 ESLint、diff 检查、frontend build、Worker dry-run 均通过；仅既有 Browserslist 与 chunk 大小提示。

实现 Review：对提交前 diff 与新增文件按真实输入、异步检查过期、草稿/失败重试、显式地址冲突、原子写入及已发布链接保护审查。关闭两项内部发现：英文名称恰好为默认名时仍应生成可读地址；已经确认占用时主按钮应禁用。项目没有 diff-only maintainability 入口，执行人工 findings-first 检查，无未关闭源码 findings。线上视觉与用户链验收仍待发布候选检查。
