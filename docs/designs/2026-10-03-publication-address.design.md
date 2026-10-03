# 发布名称与地址明确分离

## 目标与授权
用户指出项目名称暗中决定子域名、中文回退与重名改写难以预期，接受“名称自由填写、地址自动建议且常显可修改”方案，并要求直接上线。保留现有品牌紫色、主卡片与常显名称；不增加步骤、独立卡片或高级配置。名称与地址在宽屏并排，在手机纵向排列；同一组信息不会把桌面主按钮推得过远。feature / standard，跨前端、Worker 与 D1 写边界 L3；部署按 L4 验收。plan=not-required，单批闭环，retrospective_state=completed。

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
| PA-1 | true | 名称/地址常显、中文/英文/空名建议、手动地址不随名称变、宽窄屏/主题布局 | passed | 新版生产真实桌面/390px手机/深色渲染；默认前缀直接编辑、域名固定；中文/手动/HTML-ZIP-GitHub切换保持，原英文/空名回归 |
| PA-2 | true | 格式/占用/检查失败/过期响应正确反馈，可用建议明确采用 | passed | 生产app占用、采用建议/编辑；预览无API显示失败重试；hook可控时钟验证防抖/取消/8秒超时/过期结果/重试 |
| PA-3 | true | draft 精确保存地址、并发冲突不静默换址、名称修改不改链接、已发布地址保护 | passed | test-publication-address.mjs：真实 Worker/Miniflare/D1 HTTP、同时创建/更新只有一方成功 |
| PA-4 | true | HTML/ZIP/GitHub、登录、失败重试复用草稿，原发布链保留 | passed | test-homepage-publishing.mjs + deployment-metadata/completion 回归；登录与线上发布待 PA-5 复核 |
| PA-6 | true | 常用重名地址 app 检查不随重名数量逐次往返；线上连续3次全部<8秒且中位数<3秒；前端请求8秒后转失败/重试，修改地址取消旧结果 | passed | 修前app 39.573/19.877秒；修后同生产入口3.190/0.385/0.332秒，中位数0.385秒；可用分支0.316秒；hook超时/取消回归及线上快速占用提示 |
| PA-7 | true | 前缀默认可输入、后缀固定；按名称真实AI生成合法可用建议，人工/名称变更不被晚响应覆盖，失败不改旧地址，登录/等待清楚 | passed | 真实生产已登录UI：旅行账本→AI travel-ledger、名称不变、地址可用；直接非法/占用编辑、采用app-141；真实manager取消/失败/15秒超时与Worker/AI HTTP装配测试 |
| PA-5 | true | Worker先于前端上线，线上页面与API当前版本可用，提交推送且本地master=远端实际SHA | passed | Worker 9c9589c3先上线，Pages9479e357生产；真实UI+上游AI运行；主工作区快进、既有WIP保留与实际远程SHA/0 0对账 |

验证：前端/Worker tsc、定向 lint/build、现有发布回归；真实 Miniflare+D1 HTTP 精确合同与并发排他，线上公开预检与私有QA草稿/名称修改/清理。真实线上 UI 渲染检查桌面/手机及地址编辑；先前本地浏览器动作受安全策略阻止，不绕过，使用允许的 HTTPS 线上入口；无法取得的视觉证据如实报告。外观最终由用户判断。只部署受影响 gemigo-api 与网站 Pages，不部署 Node/其它 Worker；保留 Secrets。

## 方案 Review
通过。按中文命名、英文重名、预检后竞争、失败后改址/改名、改名已有链接等反例核对，显式地址不静默改写；原子写入解决预检竞争，无持久预留复杂度。既有身份/草稿/发布 owner 复用；生成地址不是预留的提示明确。未关闭 findings：无。

## 实现与源码验证
复用原名称解析并移至 publication-details，地址建议/验证同源；store 保存本次随机种子、手动地址与提交错误。Worker 排他写入同时防止发布状态竞态导致的改址，允许旧的缺失 slug 补全。前端/Worker tsc、定向 ESLint、diff 检查、frontend build、Worker dry-run 均通过；仅既有 Browserslist 与 chunk 大小提示。

实现 Review：对提交前 diff 与新增文件按真实输入、异步检查过期、草稿/失败重试、显式地址冲突、原子写入及已发布链接保护审查。关闭两项内部发现：英文名称恰好为默认名时仍应生成可读地址；已经确认占用时主按钮应禁用。项目没有 diff-only maintainability 入口，执行人工 findings-first 检查，无未关闭源码 findings。线上视觉与用户链验收仍待发布候选检查。

## 地址检查性能修复（2026-10-03 用户反馈）
flow=bugfix；L3 查询与前端等待边界、L4 部署；不改变精确发布与地址预留合同。实测 app 的建议为 app-141，旧路径先查 app 再连续查询 app-1…app-141，单请求约20–40秒。属于局部等待合同缺口，复用原设计与 repository/service/hook；旧用户使用的草稿自动取名也复用相同分配 owner。

用户链：进入部署页，填写 app → 短暂检查后显示地址已占用与可点击建议 → 点击建议 → 显示可用，继续原发布链；网络异常时最多8秒转“检查暂时失败”并可重试，名称和内容保持，修改地址丢弃旧结果。正常请求不等超时，8秒只作为异常上限；300ms防抖保留。

选择一次查询取精确请求地址、规范化建议基名和有限长度数字候选的已有 slug，再在服务内用 Set 选择第一个空闲数字后缀（原1…10000策略）。保持数字空洞复用、删除排除与当前项目排除；63字符地址的建议基名最多57字符并经原 slugify 规范化，避免截断在连字符上。放弃只加超时（未解决正常慢）、改随机/最大序号（无必要改变现有建议语义）、递归SQL（增加维护复杂度）。无新表、索引、缓存或预留，无额外公开协议。所有占用判断和建议使用同一查询快照；写时原子排他仍最终保护并发。

验证冻结：真实 Worker+D1 装配大量重名（1000条）、数字空洞、删除/排除、63字符和非数字后缀；生产同一 app 接口3次连续样本达到PA-6，另检查未占用分支；前端取消/超时/重试用可控时钟的 hook 边界验证，并真实生产界面检查重名提示和采用建议。

补充方案 Review(mode=design)：passed。常见重名、前缀截断、并发预检、取消和超时均有可执行边界；Set 只存查询快照，未引入长驻缓存；恢复复用已有重试按钮，不产生第二状态 owner。未关闭 findings：无。plan=not-required。

### 性能修复源码验证与实现 Review
真实 Worker/Miniflare+D1 HTTP 全合同回归通过，新增1000重名、删除空洞、非数字变体与63字符地址；前端实际 hook 外部边界用可控时钟验证8秒超时、晚响应、重试和取消。前端/Worker tsc、定向ESLint、frontend build、diff检查通过。实测D1 GLOB对长模式有限制，查询改为substr前缀匹配，63字符原触发已重验通过。

mode=implementation：no findings。人工diff-only核对单查询快照与排除规则、原确定性后缀策略、前端超时abort/过期/cleanup、原子最终写入合同；无项目维护性脚本。不改变公开响应字段、不制造缓存/预留，未受影响发布与改名线上证据继续有效；线上性能与最终主线同步在PA-5/6待部署核验。

### 性能发布证据
实现提交de685b7，Worker版本85183c2d-c7e5-46d9-ad7d-30940bdf0b24；只部署gemigo-api与Pages。生产已返回快速app占用+app-141，生产JS index-DJ1c8X0x含8秒超时与abort，真实UI约1秒完成含300ms防抖。截图 /tmp/gemigo-address-check-fixed.png。主工作区与实际远程bb62c8f已同步0 0，32个既有WIP文件hash/暂存状态保护；并行explore提交正常合并，无强推。旧名称/地址UI完整QA发布、改名链接不变与清理证据继续有效：临时项目be210cd4-e857-47cf-bee1-13eeed3e26c0，通过真实UI发布到精确地址，改名不改url，测试完成后清理。当前新请求继续同一交付目标，最终交付须包含PA-7。

## 地址直接编辑与AI建议（用户新增输入）
来源：用户指出地址不能直接自定义，要求固定域名后缀、直接编辑前缀，并根据已填应用名称提供AI生成操作；授权按AI判断优化并线上交付。新增feature / standard / L3-L4，plan=not-required。仅扩展本组控件和既有Project/AI owner，不改整体页面布局。

用户从部署页填“旅行账本” → 地址前缀一直是可编辑输入，右侧固定.gemigo.app → 点击“AI生成”，未登录沿现有登录弹窗；已登录时原地址保持、按钮显示“生成中…” → AI按该名称生成travel-journal类短英文地址，服务复用单查询排重 → 回填前缀并进行既有可用性检查 → 用户可直接改为任何合法前缀，最终按页面地址发布。空名称时AI按钮禁用；失败就地提示，保留旧值，可重新点击或手改。不自动调用AI，不改展示名称，不增加卡片/确认步骤。移除“修改/完成”模式和容易被误认成AI的“自动生成”恢复动作。

Owner：DeploymentManager完整拥有本次AI请求（controller/取消/15秒上限），store仅持久表单内生成中/错误状态；名称/前缀/来源/页面退出/重置取消请求，只有当前controller允许写回，发布时不与生成并行。IProjectProvider与ProjectManager沿现有传输边界传播；mock明确AI不可用，不伪造AI。Worker POST /projects/address-suggestion 使用现有会话验证，name 1–80字符，排除草稿须本人；ProjectService调现有AIService新增专用短输出方法，只发名称，10秒上限、非thinking、JSON {slug}、低token预算；非法/无AI响应503，不以slugify冒充AI。复用既有模型/Key/URL配置与地址检查排重，不增加依赖/Secrets/通用AI网关/持久状态。

候选：保留隐藏修改不满足新输入；长期开启编辑最直接；自动AI会把普通输入变付费等待且可能覆盖用户，采用显式按钮。复用完整metadata生成会生成无关字段且有静默fallback，选择现有AIService内窄方法，避免抽象一个无消费者AI框架。保留现有providers，仅新增本链真实调用方法，无新文件和preflight入口需求。

黄金验收：真实线上页面直接输入prefix、固定后缀，非法/占用提示；中文名称点击AI看到合法地址且名称不变，允许再手改；离线/上游失败保留原值，重新点击恢复；生成时手改/改名/来源切换/离开后晚结果不可写回。最小证据：真实Worker+D1+受控标准AI HTTP mock验证鉴权/输入/成功/冲突/异常；真实manager延迟请求取消/重试；前端/Worker tsc、定向lint/build；生产真实UI至少一次实际AI生成、手改与快速检查，宽窄/主题渲染。原发布精确写入与竞态回归继续通过。

补充方案Review(mode=design)：passed。用户任务、等待成本、直接编辑与固定后缀的边界清楚；请求取消在业务owner，不把异步写回藏在组件；服务输出严格校验，AI故障不会换成伪AI地址；已有原子写入仍是最终可用性保护。成本由显式且已登录的操作控制，无新无消费者抽象。未关闭findings：无。PA-1/2/4/5受新UI/请求生命周期影响需重验；PA-3/6未变保持已有证据。

### 直接编辑与AI实现验证 / Review
前端/Worker tsc、定向ESLint、frontend build、diff检查通过。真实Worker+D1+标准上游HTTP边界验证已登录/未登录、80字符限制、名称JSON数据传递、真实AI输出解析、冲突后缀与本人排除、无效JSON/非法slug/上游502均503；实际DeploymentManager测试成功/名称保持/失败保留/15秒超时/手改/改名/来源切换/退出/旧请求cleanup不干扰新请求。原发布、精确slug、并发写入、重名1000条与hook8秒超时回归继续通过。
mode=implementation：no findings。人工diff-only核对字段直接编辑、固定后缀、登录入口、模型请求数据边界、输出校验、请求取消identity/状态owner、发布与生成互斥、mock不冒充AI；无新增文件/依赖、无项目维护性脚本，无未关闭finding。生产真实AI与渲染在PA-7等待上线验收。

## 最终线上交付与验收
实现提交6a18fb4，Worker版本9c9589c3-12fc-48cc-a69b-0334b5482671（回退可用85183c2d）；pnpm deploy:pages生产9479e357-ce0e-4cc4-8f71-f50bd208568d，gh-pages来源1df6705，线上JS index-B5RzDDoL含AI endpoint/control与generation owner。真实生产界面已登录正常账号：填写旅行账本，点击AI生成，真实模型返回travel-ledger，名称保持；既有检查显示可用。手动输入-broken即时非法，app快速占用，点击app-141恢复可用；切换ZIP/GitHub名字与地址保持。空名禁用AI、生成中按钮等待，出错保持/取消/重试由已组装边界与真实manager验证。桌面两列、390px手机纵列、深色控件实际渲染通过；恢复原浅色主题和viewport，关闭AI测试tab，保留用户当前输入tab，未强行刷新。

用户入口：https://gemigo.io/deploy；刷新后直接输入前缀，固定.gemigo.app；填名称后点击AI生成，再手动调整或继续原发布。AI模型输出文字的偏好与视觉审美交用户判断，不宣称用户主观验收已通过。线上AI测试没有创建新项目；上一批完整QA项目已清理。生产Secrets/Node/其它Workers未改。精确提交推送并同步主工作区，既有并行未提交文件hash/暂存状态保护；最后重新fetch核对实际远端SHA与master分叉0 0。

retrospective_decision=no-increment：根因与D1长模式限制已落在本设计原事实owner，性能与取消回归已加入既有测试；没有足够证据升级为跨项目规则或新通用AI机制，不创建额外日志。各Required IDs当前passed，授权内实现/验证/Review/线上交付完成，主观效果待用户反馈。
