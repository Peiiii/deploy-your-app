# 预览浮动栏互动与管理

## 目标与范围

用户提供现有胶囊栏截图，要求在这里增加点赞、收藏、评论，以及属于当前用户的应用设置入口。保持既有预览容器、iframe、主题、拖动、新窗口、全屏和关闭行为。standard / feature / L2；单批实现，plan not-required。项目既有全托管授权覆盖验证后精确提交、普通推送及主工作区同步；交付网站可用入口，部署前端并核验实际资产。

## 用户链路与方案

首页/探索打开应用预览 → 悬停、键盘聚焦或点击 Logo 展开胶囊 → 点赞/收藏即时显色，同一 reaction store 同步卡片；游客操作先打开现有登录框。再点击可取消。评论在预览左侧展开非阻断侧面板（下方修订 2 替代首版 Dialog）：加载/空/失败可重试，游客可读，登录后发表、回复、删除有 canDelete 权限的评论；支持加载后续页。关闭面板回到仍然打开的应用，Esc 先关评论而不退出全屏。切换应用不串评论或草稿，迟到请求不覆盖新面板。

当前用户 id 与 app.ownerId 精确匹配才显示齿轮；映射既有 Project.ownerId 到卡片，不从公开作者昵称推断权限。点击齿轮关闭预览并导航 /projects/:id，补载当前应用以避免目标不在“我的项目”第一页时设置页空转；后端仍负责写权限。

候选：直接增长现有胶囊（选择，保持现有入口和视觉）；更多菜单（多一层点击，核心互动不易发现）；独立底部栏（侵占应用空间并改变现有布局）。展开区域按实际内容高度，不沿用旧 100px 上限。半屏核心动作默认可见，全屏默认收起；Logo 支持点击和键盘展开，保留拖动。分隔线区分互动、管理与浏览。

## Owner 与抽象审计

点赞收藏复用 ReactionManager/useReactionStore；会话复用 AuthManager/useAuthStore；设置复用 ProjectManager、既有路由；评论复用 comments-api 和服务端权限，预览会话状态放在 home 的 PreviewCommentsManager 实例与其 zustand store，组件仅连接/渲染，实例随应用身份重建。保持既有 feed 实现，本任务不重构整页。新增名词均有当前调用者，无通用操作注册框架或重复持久化。API 无变更，无数据迁移。

## 验收与 Review

1. 半屏/全屏展开后完整显示所有动作；hover、键盘、点击、拖动与关闭继续工作，亮暗主题保持原胶囊风格。
2. 游客点赞/收藏唤起登录；登录用户开关状态、统计与卡片同步，失败恢复遵循现有 manager。
3. 评论读取、发表、回复、授权删除、后续页、错误重试；重复发送禁用；旧加载不得覆盖新增内容；关闭/切换应用与登录变化后的权限刷新。
4. 自己的应用显示齿轮，其他人/游客/无 owner 的应用不显示；入口最终能打开对应设置。
5. frontend tsc、定向 lint、生产 build、组装请求边界测试、浏览器渲染和交互；提交后核验线上资产与入口。浏览器回放的身份与数据为测试，不能冒充真实用户生产写入。

实现前 design-review: passed。独立按原始请求核查入口、owner id、会话竞态、收起的可发现性与旧浏览操作，方案覆盖目标；无开放 finding。新增路径属于既有 home components/managers、docs/designs、scripts 测试目录；项目无 planned-path preflight 或 diff-only maintainability 脚本，采用路径与 diff 审查。

## 当前证据与发布契约

本项前端发布为 L4，active contract-id=preview-actions-release；parent-goal=在正常网站应用预览浮动栏完成互动、自己的应用进入设置、连续评论面板，以及统一图标操作名称提示；scope-revision=3（评论相邻非阻断面板 + 主前端统一图标 Tooltip 规范）。既有浏览行为与权限是必须保持的不变量。单阶段契约 Review 通过，不要求新增用户审批。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| PA1 | true | 浮动栏完整展示互动，保留旧浏览/拖动/全屏行为 | passed | Chrome 1440×1000 完整产品回放，Logo 点击/键盘、拖动、全屏及评论 Esc |
| PA2 | true | 点赞/收藏共享状态，可开关；游客先登录 | passed | 真实组件 + HTTP 边界回放，aria-pressed 与状态联动 |
| PA3 | true | 评论查看/发表/回复/授权删除及分页、重试、迟到请求隔离 | passed | scripts/test-preview-actions.ts；真实组件 HTTP 回放 |
| PA4 | true | ownerId 精确决定齿轮；设置页能打开对应应用 | passed | 游客与 owner Chrome 回放；HTTP 分页查找与换账号晚响应测试 |
| PA5 | true | frontend 类型/静态/构建及实现 Review 通过 | passed | 先构建 workspace 类型声明后 frontend tsc、7 文件定向 ESLint、production build、diff --check；无开放 finding |
| PA6 | true | 本次代码推送主线、主工作区同步，网站实际消费新资产 | not-run | 实现 442fc0b，整合 c173f00 推送；主工作区快进，0 0 与实际远端 SHA 一致；线上加载 index-DEYVdMNz.js |
| PC1 | true | 左侧相邻、非模态，应用和首页继续可操作 | passed | production preview 的 iframe 真实按钮计数/首页搜索；无 dialog、焦点锁或 body 滚动锁 |
| PC2 | true | 连续过渡、独立滚动/底部输入、不同布局/主题/reduced-motion | passed | RAF 记录中间位置，半屏 1440、全屏、1024 窄桌面与暗色完整画面复看；输入区 y 不随列表滚动改变 |
| PC3 | true | 开关/Esc、草稿/滚动与 iframe 身份、切换应用/登录 | passed | 同一 iframe 节点只加载 1 次；重复开关保留草稿/scrollTop；关闭后 inert/aria-hidden；登录 Esc 只关闭登录；切换应用隔离 |
| PC4 | true | 修订 2 上线与主工作区/实际远端 SHA 同步 | not-run | 待当前修订发布及真实读取验收 |
| IT1 | true | 统一 IconButton、必填 label、多尺寸与规范 | passed | 类型约束、frontend README、尺寸 xs/sm/md/lg/auto |
| IT2 | true | 图标操作迁移与 hover/focus/动态名称/边界 | passed | 全 frontend icon lint 清零、真实 Chrome 悬停/聚焦/密码名称变更、asChild 链接与登录弹窗 |
| IT3 | true | 当前 revision 类型/lint/build/UI 联动回归/Review | passed | frontend tsc、全部 changed TSX 定向 ESLint、全图标 lint/规则回归、原 HTTP manager 回归、含窄屏/暗色/侧栏/模态的 production Chrome UI 回归与 Review |
| IT4 | true | 当前 revision 上线及两端主线同步 | not-run | 待本次发布 |

浏览器证据：/tmp/preview-actions-delivered.png、preview-actions-comments.png、preview-actions-dark.png；UI 回放数据为隔离 fixture，未对生产账号发表/删除评论。线上检查将验证真实读取、游客登录、资产版本与预览入口。首次直接 tsc 在未生成 product-analytics 声明时解析到 Worker 源码，报告 D1Database；按 workspace build 顺序生成声明后通过，未修改类型来掩盖错误。生产构建仅有既有 Browserslist 陈旧与 bundle 大小提示。

实现 Review(mode=implementation)：从原截图、原要求反查全部入口；核对 DOM 焦点/隐藏、ownerId 权限、草稿与会话、异步读取/写入互斥、删除后分页重载、Esc 优先关闭评论、设置查找期间禁用及退出/切换应用后的导航保护。项目没有 diff-only maintainability 入口，采用本任务 diff 审查。无开放 finding，证据在后续主线合并后复核。


## 发布验收与收尾

2026-10-03：pnpm deploy:pages 成功，gh-pages=17a7fd0fa5fd386219a044129c115aa994a92168；https://gemigo.io/ 真实 Chrome 加载 /assets/index-DEYVdMNz.js，与本次 production build 一致。真实 feed 36 个应用、浮动栏、游客评论读取、游客点赞唤起登录、游客无齿轮均通过；没有对生产账号做写入。线上截图 /tmp/preview-actions-live.png 与 /tmp/preview-actions-live-comments.png。Python 默认 User-Agent 被网站返回 403，改用真实 Chrome 验证成功，不把抓取限制误当发布失败。

整合最新主线 c173f00 后重复 frontend tsc、定向 lint、请求边界测试与 Chrome UI 回归通过。随后主线并行 admin/发布表单提交已快进纳入；本任务运行文件没有变化，证据保持有效。主工作区同步前对既有改动逐文件散列核对，快进后内容未改变，暂存区为空；其他任务自行完成的提交与草稿收尾按其归属保留。本任务只提交上述 10 个文件。

Delivery=completed，已上线待用户体验确认；未将用户未回复视为验收通过。登录用户写操作及设置导航由隔离真实组件 + HTTP 回放证明，生产验收为真实游客读与登录入口，边界如实保留。用户入口：首页/探索点击应用 → 预览左侧浮动栏；登录后可点赞收藏、发表评论；自己应用显示齿轮。

retrospective_state=completed；retrospective_decision=no-increment。本次需要落实的是已授权的交付与现有 owner 的请求边界保护，已进入实现及回归测试；没有需要新增全局 AI 规则或平行知识条目的长期增量。所有 Required IDs 当前 passed；来源截图与现有主题/预览容器保持一致，没有开放 finding。


## 修订 2：评论左侧非阻断面板（当前有效，实施前）

2026-10-03 用户指出评论的全局弹窗会遮挡、打断注意力，要求从左侧连续展开相邻纵向面板。首版模态方案已经被该反馈取代；旧发布/Review 只证明历史版本，不代表当前交互达到用户要求。flow=standard，L2 交互 + L4 前端发布；plan not-required，retrospective_state=pending。局部合同缺口，最近 owner 为 AppPreviewPanel/PreviewCommentsPanel，不扩展为全局侧栏系统。

当前用户链路：首页或探索打开预览 → 点击胶囊评论图标 → 评论列在预览区域左侧展开，应用在右侧保留可见并可继续点击；无全页遮罩、背景置灰、滚动锁或焦点圈套，点击外部也不自动关闭。用户可在评论和应用/左侧页面间连续切换；评论列表独立滚动、输入区固定底部。再次点击图标、面板关闭按钮或 Esc 可收起，草稿、列表与滚动位置在同一应用会话内保留。切换应用重建评论会话，身份变化刷新权限。必要登录仍使用现有登录框。

方案比较：预览内部并排评论列（选择，保证应用内容不被覆盖，胶囊位置稳定）；覆盖左侧首页的抽屉（会挡住现有页面内容）；把全局 Dialog 改成非 modal（仍有中央跳跃且空间位置不连续）。评论列宽 min(320px,45%)，应用占余宽；半屏与全屏统一局部布局；窄桌面仍无横向溢出。固定相对宽度的评论列以负 margin 归零和透明度实现 240ms CSS 过渡；抽屉内容宽度不随开关变小，iframe 随布局连续让位，尊重 reduced-motion。iframe DOM 保持同一节点，展开/收起/评论更新不能重新加载应用。全屏评论列为内侧胶囊预留 40px 左侧间距。

owner/抽象审计：直接移除评论组件的 Dialog/Portal，引入普通 aside；复用既有 manager/API，不新增 store、通用抽屉或布局注册机制。只触达 home 三个组件及必要局部样式、现有设计和定向回归。打开状态归 AppPreviewPanel；评论会话/草稿仍归 PreviewCommentsManager。预览浏览与齿轮功能保持。

新增 Required IDs：PC1=左侧相邻面板且真实 iframe/首页可操作，无模态/遮罩/焦点锁；PC2=动画连续、独立滚动与底部输入、半屏/全屏/窄桌面/reduced-motion；PC3=切换、Esc/按钮/重复点击、草稿/滚动保留及 iframe 身份不变；PC4=上线真实新资产、主线精确提交与主工作区同步。初始均 not-run；旧 PA1/PA3/PA5/PA6 转 stale，PA2/PA4 非相关证据保留。

design-review: passed（修订 2）。从用户原话独立核对“左侧、隔壁、非阻断、注意力连续”四项：必须用真实应用点击计数、首页按钮、焦点 Tab、iframe 节点身份和过渡中间几何验证，不能仅把弹窗移到左边或仅凭最终截图通过。保持 API 权限和评论操作；无开放设计 finding。没有新增实现路径，无需新目录或 preflight。停止条件为功能标准全部成立且真实画面没有仍可处理的遮挡/溢出；最终审美体验留给用户确认。


修订 2 验证进展：已运行原评论 HTTP 边界回归，保持权限、错误与旧响应隔离；frontend tsc、3 组件 ESLint、production build、git diff --check 均通过。新增 scripts/test-preview-comments-sidepanel.mjs 对完整 production preview + 隔离 HTTP 数据验证真实布局与交互，未注入产品 store/DOM 或假装生产写入。半屏、全屏、窄桌面及暗色截图已经逐张打开复看；相邻列无全局遮挡，胶囊/输入区未遮住文字，没有可处理的重大画面差距。过渡通过 RAF 中间位置证明，不以单张截图代替。UI 回归也保护原评论发表/回复/删除、分页与登录。可复现命令：PLAYWRIGHT_MODULE_PATH=<bundled playwright path> PREVIEW_TEST_URL=http://127.0.0.1:5192 PREVIEW_SCREENSHOT_DIR=/tmp node scripts/test-preview-comments-sidepanel.mjs（先启动本版本 production preview）。截图 /tmp/comments-sidepanel-half.png、fullscreen.png、narrow.png、dark.png；审美体验仍待用户判断。

## 修订 3：统一操作图标与 Tooltip（当前有效，实施前）

来源：用户补充“所有操作图标 hover 后显示名称，用统一可复用组件约束，支持不同 size”。延续修订 2 评论左侧非阻断面板；新增跨前端的图标操作规范。scope revision=3，standard，UI L2 / 发布 L4，plan=not-required（同批可闭环）。

选择：`frontend/src/components/icon-button.tsx` 为操作按钮骨架 owner；必填 `label` 同时提供 Tooltip 文案与 aria-label，可选 tooltip 补充计数，支持 xs/sm/md/lg/auto 尺寸。默认按钮 type=button，可用 asChild 保留链接或 Radix Dialog.Close 的真实元素与原事件/refs。通用 Tooltip owner 使用已有 Radix 技术体系的 Tooltip/Slot，统一 Provider 的 300ms hover 延迟、键盘 focus、Escape、Portal 与边缘避让。保留业务事件/权限/状态 owner；删除被迁移入口的原生 title，防止双提示。auto 仅用于既有响应式或带计数布局，未来纯图标优先标准尺寸。

不采用逐个补 title（样式与延迟不可控、规范无法由类型约束）；不自写定位/键盘/浮层系统。依据 [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip) 与 [Slot](https://www.radix-ui.com/primitives/docs/utilities/slot) 的 asChild 事件/ref 合同。公共变体仅作用前端样式，无传输/存储/runtime 传播。抽象审计：几十个真实消费者共享可访问名称与提示行为，统一组件收益成立；保留按钮、链接、尺寸和提示位置，延后无消费者的 variant/registry/服务层。

迁移范围：主前端所有纯图标、图标加计数以及窄屏/侧栏折叠后只剩图标的操作，包括预览 dock、关闭、头部、侧栏、feed、密码可见性、卡片反应、复制、个人链接操作。具有可见操作名称的普通文本按钮、装饰性图标和独立 admin/desktop/extension 应用不属于主前端的图标操作；不改业务动作。规范沉淀 `frontend/README.md`，必填 label 由 TypeScript 强制，统一组件内自动 Tooltip。

黄金链路：打开首页 → 悬停点赞/评论看到名称 → 点击评论仍按修订2连续出现 → 移动到关闭显示关闭 → 点击/键盘仍正常；打开登录 → focus 密码可见性按钮看到名称 → 点击切换名称；窄屏与折叠侧栏/链接 hover → 提示可见、不被 overflow 裁剪、元素在视口内。

新增 required：IT1 统一组件/必填名称/尺寸/规范；IT2 全入口迁移与 hover/focus/计数/动态名称/关闭/边缘避让；IT3 类型/lint/build 与评论联动回归；IT4 实际上线及主线同步。实施前 design-review=passed：复用 Radix、入口范围与权限不变，类型强制名称，验证覆盖真实 hover 与 portal/模态边界，no findings。

修订3迭代证据：ESLint 已接入 `gemigo-ui/icon-actions`，裸按钮/链接/可点击div、条件图标和计数不能绕过；`scripts/test-icon-actions.mjs` 验证违反/合法 composition 场景及全 frontend inventory。浏览器验证使用 production build 与 HTTP fixture，加入 hover、键盘聚焦、无原生 title、视口避让、真实 Radix 登录弹窗内密码显示/隐藏名称。点击状态更新后等待 React/浮层提交再移动鼠标，避免自动化连续输入遗漏 pointerleave；产品代码无为测试添加的 tooltip state 或计时逻辑。

修订3实现 Review（当前 diff）：无项目 diff-only maintainability 自动入口，按已有方法审查组件/全迁移 diff、状态/权限/事件/ref/HTML semantics 与测试边界。图标统一 owner 有真实跨入口消费者，Portal 不改变按钮 DOM 布局、支持 Dialog.Close/link composition；新增 lint 只约束主 frontend，合法文字按钮不被误报。评论 lifecycle 保留 iframe 与同应用草稿/滚动，关闭内容 inert 且无焦点锁；身份和 app 切换仍由原 owner 处理。没有开放 finding。public env 已按白名单保留，最终 production build index-QSliTkNM.js；已有 Browserslist/大 bundle 提示未新增失败。人工检查当前窄屏/暗色截图，无遮挡/横向溢出，剩余主观项为用户对实际丝滑程度的判断。
