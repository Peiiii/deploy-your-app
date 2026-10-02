# 预览浮动栏互动与管理

## 目标与范围

用户提供现有胶囊栏截图，要求在这里增加点赞、收藏、评论，以及属于当前用户的应用设置入口。保持既有预览容器、iframe、主题、拖动、新窗口、全屏和关闭行为。standard / feature / L2；单批实现，plan not-required。项目既有全托管授权覆盖验证后精确提交、普通推送及主工作区同步；交付网站可用入口，部署前端并核验实际资产。

## 用户链路与方案

首页/探索打开应用预览 → 悬停、键盘聚焦或点击 Logo 展开胶囊 → 点赞/收藏即时显色，同一 reaction store 同步卡片；游客操作先打开现有登录框。再点击可取消。评论打开现有 Dialog 外壳的面板：加载/空/失败可重试，游客可读，登录后发表、回复、删除有 canDelete 权限的评论；支持加载后续页。关闭面板回到仍然打开的应用，Esc 先关评论而不退出全屏。切换应用不串评论或草稿，迟到请求不覆盖新面板。

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

本项前端发布为 L4，active contract-id=preview-actions-release；parent-goal=在正常网站应用预览浮动栏完成互动，并对自己的应用进入设置；scope-revision=1。既有浏览行为与权限是必须保持的不变量。单阶段契约 Review 通过，不要求新增用户审批。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| PA1 | true | 浮动栏完整展示互动，保留旧浏览/拖动/全屏行为 | passed | Chrome 1440×1000 完整产品回放，Logo 点击/键盘、拖动、全屏及评论 Esc |
| PA2 | true | 点赞/收藏共享状态，可开关；游客先登录 | passed | 真实组件 + HTTP 边界回放，aria-pressed 与状态联动 |
| PA3 | true | 评论查看/发表/回复/授权删除及分页、重试、迟到请求隔离 | passed | scripts/test-preview-actions.ts；真实组件 HTTP 回放 |
| PA4 | true | ownerId 精确决定齿轮；设置页能打开对应应用 | passed | 游客与 owner Chrome 回放；HTTP 分页查找与换账号晚响应测试 |
| PA5 | true | frontend 类型/静态/构建及实现 Review 通过 | passed | 先构建 workspace 类型声明后 frontend tsc、7 文件定向 ESLint、production build、diff --check；无开放 finding |
| PA6 | true | 本次代码推送主线、主工作区同步，网站实际消费新资产 | passed | 实现 442fc0b，整合 c173f00 推送；主工作区快进，0 0 与实际远端 SHA 一致；线上加载 index-DEYVdMNz.js |

浏览器证据：/tmp/preview-actions-delivered.png、preview-actions-comments.png、preview-actions-dark.png；UI 回放数据为隔离 fixture，未对生产账号发表/删除评论。线上检查将验证真实读取、游客登录、资产版本与预览入口。首次直接 tsc 在未生成 product-analytics 声明时解析到 Worker 源码，报告 D1Database；按 workspace build 顺序生成声明后通过，未修改类型来掩盖错误。生产构建仅有既有 Browserslist 陈旧与 bundle 大小提示。

实现 Review(mode=implementation)：从原截图、原要求反查全部入口；核对 DOM 焦点/隐藏、ownerId 权限、草稿与会话、异步读取/写入互斥、删除后分页重载、Esc 优先关闭评论、设置查找期间禁用及退出/切换应用后的导航保护。项目没有 diff-only maintainability 入口，采用本任务 diff 审查。无开放 finding，证据在后续主线合并后复核。


## 发布验收与收尾

2026-10-03：pnpm deploy:pages 成功，gh-pages=17a7fd0fa5fd386219a044129c115aa994a92168；https://gemigo.io/ 真实 Chrome 加载 /assets/index-DEYVdMNz.js，与本次 production build 一致。真实 feed 36 个应用、浮动栏、游客评论读取、游客点赞唤起登录、游客无齿轮均通过；没有对生产账号做写入。线上截图 /tmp/preview-actions-live.png 与 /tmp/preview-actions-live-comments.png。Python 默认 User-Agent 被网站返回 403，改用真实 Chrome 验证成功，不把抓取限制误当发布失败。

整合最新主线 c173f00 后重复 frontend tsc、定向 lint、请求边界测试与 Chrome UI 回归通过。随后主线并行 admin/发布表单提交已快进纳入；本任务运行文件没有变化，证据保持有效。主工作区同步前对既有改动逐文件散列核对，快进后内容未改变，暂存区为空；其他任务自行完成的提交与草稿收尾按其归属保留。本任务只提交上述 10 个文件。

Delivery=completed，已上线待用户体验确认；未将用户未回复视为验收通过。登录用户写操作及设置导航由隔离真实组件 + HTTP 回放证明，生产验收为真实游客读与登录入口，边界如实保留。用户入口：首页/探索点击应用 → 预览左侧浮动栏；登录后可点赞收藏、发表评论；自己应用显示齿轮。

retrospective_state=completed；retrospective_decision=no-increment。本次需要落实的是已授权的交付与现有 owner 的请求边界保护，已进入实现及回归测试；没有需要新增全局 AI 规则或平行知识条目的长期增量。所有 Required IDs 当前 passed；来源截图与现有主题/预览容器保持一致，没有开放 finding。
