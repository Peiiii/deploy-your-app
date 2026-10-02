# 前端体验整体优化

## 关联入口

- [当前状态](../../work/2026-10-02-frontend-experience/current-state.md)
- [有效验收合同](../../work/2026-10-02-frontend-experience/acceptance-contract.md)
- [设计](../../designs/2026-10-02-frontend-experience.design.md)
- [执行计划](../../plans/2026-10-02-frontend-experience.plan.md)

## 原始输入与约束

2026-10-02 用户要求：全盘优化前端交互、体验、界面、图标和加载速度；以 ChatGPT 级别的体验为标杆，要求 AI 设定目标并持续推进至达到标准。截图为已登录应用壳内，锁图标和“加载中...”居中的卡片，大面积空白。原附件：`/var/folders/gp/ls0ngf8d1qn97_g1t48670zc0000gn/T/codex-clipboard-a1513207-efd9-46e5-b71d-4b0f76e1ac6a.png`。截图是问题证据，不是外观实现基准。

项目 AGENTS.md 已授权自主调查、设计、实现、验证、Review、精确提交和普通推送 origin/master；任务线上生效时继续部署验收。用户全权委托体验取舍，无需逐项设计审批。保护原有 analytics 脚本、未跟踪文档和 tgz。

“ChatGPT 级别”由 AI 具体化为清晰内容层级、安静一致的控件、稳定的等待反馈、快速可用和完整键盘/移动操作；属于授权内设计目标，不能作为客观同级结论。已尝试读取 ChatGPT 真实参考，访问被 Cloudflare challenge 阻挡；不绕过，也不宣称已精确对比。

## 过程记录

- 理解阶段：确认截图对应 dashboard/profile 登录等待中的 Lock 卡片；项目设置找不到项目时持续 spinner；Explore 请求失败只写 console；通知红点无数据源和点击行为；全部页面静态导入。生产构建基线 JS 696.09 kB / gzip 191.14 kB，CSS 96.52 kB / gzip 14.30 kB。线上首访观测 DOMContentLoaded 2569.9 ms，主 JS 传输 186146 bytes / 541.5 ms（普通网络单次，非统计结论）。已打开并复核线上首页与仪表板截图；Dashboard 中泄露 draft/local-static 源标识及原始 ISO 时间，卡片重复层级和顶栏双 header 造成分散。
- 事实来源以当前源码、构建和实际线上界面优先；旧 docs/FEATURES.md/架构文档含 2024 年旧链路，不据其缺功能描述作决策。
- 方案 Review（mode=design）：从原始目标反查合同覆盖视觉、交互、速度、各核心页面和状态；沿黄金链路检查登录、刷新、失败恢复及现有入口保留。采用既有 store/manager，等待骨架和原生 dialog 共享实际重复，路由拆包与内容相互独立。无未关闭设计 finding；通过范围为设计全文和计划 1–3。性能测量门槛在实现前固定于合同，线上网络外部波动单列。

- 实施/质量观察一：真实 localhost 页面已打开，壳与中性色层级完成；骨架比真实应用卡片多一行筛选和高度，已删重复行并匹配内容比例。会话失败从表单 error 分离为 sessionError；路由按需加载、帮助按需初始化，移除假通知。定向 tsc已通过；lint指出 header同步effect关闭菜单，改为实际选择/blur/Esc边界关闭。
- 并行任务边界：Popover任务新增共享组件、修改语言/首页更多方式，缩略图调度任务修改workflow/worker/scripts；保留这些WIP，不把其改动归入本任务提交。新owner已经存在，后续复用交互能力并只提交本任务差异。
- 设计补充 Review：公开主页 request identity/404错误区分、个人资料失败禁止空草稿保存，均为原UX02/UX03必要状态，补入B；现有stores/managers为owner，无新框架/协议，补充设计通过。

- 设计补充 Review（预览）：实际旧预览通过8px拖拽logo胶囊提供关闭/全屏，hover时才可见，打开后自动折叠侧栏；Feed滚动隐藏退出并每scroll重建observer。改为标准固定工具栏、原生fullscreen dialog、保存用户导航偏好；原Dock无其它消费者可删。范围UX01/UX03/UX05/UX06，补充通过。

## 交付汇总与复盘

进行中，尚未交付。

## 最新代码整合与分批交付

用户追加要求基于最新代码，并明确允许先发布已完成部分、再做剩余优化。已同步至707747b并保留应用语言偏好筛选、网站显示语言设置、新 Popover 与 D1 分页 owner。第一次 fetch 因其它任务同时更新 gh-pages remote ref 报锁冲突，master ref 已更新且后续定向 fetch 使用 master。原区86个任务草稿按逐文件一致性迁移并清理，不提交 analytics脚本/其它任务文件。验证发现并修复旧会话覆盖新登录和跨账号项目等待，VM边界回归覆盖去重、失败/401、登录/退出竞态、搜索过期结果、末页和重试；browser 原生 dialog 焦点进入/限制/Esc/返回已观察，实际首页手机390px未见横向溢出。最新合并后的完整检查与线上证据仍须补齐。


## 第一批实现 Review 与发布前证据（2026-10-03）

- 继续整合至 e569388，保留新共用 Radix Dialog、名字提醒全局挂载、使用政策及折叠式应用语言筛选。抽屉/预览/Feed 是同一 DialogContent 的布局消费者，删除原生 modal 的平行焦点实现。最新姓名功能 test:profile-name 与 test:public-author passed。
- frontend 全量应用 tsc、frontend ESLint（含新回归脚本）、production build、diff --check passed。test-frontend-experience 的五组请求边界 passed；test-deployment-client passed（413 不误报成功、ZIP 二进制上传、SSE 断开后确认恢复）。姓名回归曾发现 ui.store 初始化在 Node 没有 document；增加浏览器存在判断后通过，未更改测试来掩盖异常。
- 真实 localhost 生产资产验收：1280px 英文深色首页 → 打开 CineFlow AI 侧边预览 → 固定工具栏进入全屏 → named App preview dialog → Escape 关闭、焦点回到原应用按钮；iframe 实际加载内容。登录 Dialog 的可访问 Email/Password、Tab 从末尾循环到首按钮、Escape 关闭成立。390px Main navigation dialog 具名称、Escape 返回 Toggle Menu，页面无横向溢出；768px 英文深色首页标题/搜索正常。曾发现手机登录换行及 drawer aria-labelledby 缺失，已修复并复验；最新应用语言控件折叠合并后继续复查。
- diff-only maintainability/implementation Review：检查请求 dedup/current identity、会话 401 与可重试网络错误、分页失败/末页、个人资料失败禁止覆盖空草稿、真实业务入口和 latest master 新功能；视觉 token 单一 owner，Modal 是共享 Dialog 的薄消费者，没有复制状态/焦点系统；无开放第一批 finding。未覆盖的全站矩阵、性能与真实三种发布结果保持第二批 pending；不把 mocks 或 localhost 匿名网络冒充线上成功。
- 第一批首包 gzip 约 167.8 kB（基线191.14）；原 ≤150 kB 门槛尚未通过，整体 goal 不关闭。当前 localhost proxy 访问生产 API 有网络延迟，本地等待/错误可见，但不能据此声称生产 API 退化。
- 发布准备只修改本工作树 frontend、任务 docs 和新增回归脚本。用户原工作区及其他任务 backend/analytics/admin WIP 不提交。保留公共 Crisp 网站配置用于构建，未拷贝或打印生产 Secrets。
- 第一批复盘判断：通用经验已在现有流程要求中（沿实际 UI 验证、身份请求归属、共享 owner 优先），本次仅记录项目事实和证据，不新增平行方法文档。整体复盘待第二批完成。


## 第一批线上交付

实现提交 15e50d6 普通推送 origin/master；仓库 pnpm deploy:pages 成功，gh-pages source 69502b4，Cloudflare Pages production bb55f58d-4c90-4e6c-8cf9-dadbf3b71b79。https://gemigo.io/dashboard 实际加载 /assets/index-MORflqby.js，与本批 production build 的版本路径一致（539.44kB/gzip167.79kB），不以推送日志代替域名证据。

用户当前真实已登录会话刷新：先显示“仪表板”+内容骨架，随后26个项目正常呈现；旧锁图标等待卡片消失，draft/local-static 识别文本改为 HTML/上传 ZIP，部署时间本地化。1280px 亮色截图已经打开复核并保存于 `/Users/peiwang/.codex/visualizations/2026/10/02/01a0fd0c-6575-7831-a513-01159b83eb9f/gemigo-dashboard-live.jpg`。搜索 no-result-ux-20261003 出现“未找到项目”和可恢复操作，清除搜索返回项目；项目侧栏真实 Link 进入既有管理详情。未写生产资料、未删除项目。独立 shell curl 域名超时属本机网络路径，浏览器域名资源与真实产品操作已确认，Cloudflare只读查询也返回production版本。

用户允许分批交付，第一批线上可用；整体合同保持 active，第二批性能/全页矩阵与残余体验继续推进。


## 用户否定与回退（2026-10-03）

用户明确指出：不能照搬ChatGPT外观而丢掉本产品主题/风格；本批中性配色失去语义区分，顶栏滚走，HTML/ZIP发布区域不如旧版；提供右侧预览iframe只占窄区的截图，要求停止改动、恢复精心设计的原容器。AI确认这些来自自己的15e50d6改动，停止第二批。第二批草稿存入frontend-experience-cancelled-second-batch的本任务stash，未上线。

恢复范围：逆转15e50d6的frontend及新增测试实现，保留本任务日志而不删除历史，也不逆转e569388以前其它任务的新功能。恢复原主题token/Tailwind、原Header/Profile/Menu/Home发布和探索外观、原右侧AppPreviewPanel完整w-full容器/iframe/Dock、原路由与状态逻辑。用户明确要求顶栏固定，因此在原Header上只增加sticky top-0，未继续设计其它界面。回退产品合同取代原UX01–UX10执行计划；旧“Review无finding”只代表AI当时自审，用户反馈已经否定其主观质量结论，不能作为达标证据。原目标没有实现，应停止而不标记complete。

回退验收：与e569388的frontend差异只剩Header sticky；frontend tsc/lint/build、diff检查；真实首页发布区/原主题与原右侧预览全宽，滚动时Header停留顶部。回退发布后核对gemigo.io实际asset和产品画面，不以Git操作代替恢复。

本地回退验收通过：1280×900真实页面中iframe与其父容器均607px，滚动main到900px后Header的top仍0且position=sticky。发布前定向fetch发现origin/master已推进至fb4a228；保留其后台发布修正、托管缓存、语言扫描及语言badge新逻辑，冲突仅复合回原卡片配色/原语言控件与最新语言功能，不覆盖用户最新功能。
