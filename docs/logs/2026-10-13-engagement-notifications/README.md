# 互动通知落地工作记录

## 原始输入与约束

2026-10-13 用户先要求借鉴抖音等产品，统一设计及时而适度的互动通知，随后明确要求「落地验证」。以 [统一设计](../../designs/2026-10-13-engagement-notifications.design.md) 为实施输入；执行涵盖适用实现、验证、Review、发布与线上验收，不把批次当整体完成。用户明确排除邮件，只使用站内提示和用户主动许可的设备推送。

## 当前状态与恢复

- delivery-mode=major；flow=standard；risk=L3/L4；phase=delivered-awaiting-user-acceptance；retrospective_state=completed。
- 开始：2026-10-13 22:52 CST；预计完成 2026-10-14 00:52–01:52 CST，外部阻塞单列。
- 工作区：`/Users/peiwang/.codex/worktrees/engagement-notifications/deploy-your-app`，主工作区有其它任务修改，不覆盖。
- active-contract：[合同](../../work/2026-10-13-engagement-notifications/acceptance-contract.md)。
- plan：[执行计划](../../plans/2026-10-13-engagement-notifications.plan.md)。
- 设计首批已经 review；外发选择与后续设计若发生变化先更新设计。
- 依赖核对：本地未发现 Resend/VAPID 配置；线上 Secret 名称已核对，确无邮件／Push 凭据；已询问用户邮件发信域名、测试邮箱及在 Worker 配置 RESEND_API_KEY，未获答复。Web Push 可自主生成项目专用 VAPID，下一批先冻结具体协议设计。
- 进度：新建隔离工作区，实施前 owner/路径核对完成；已建立共享通知持久层，接入评论、点赞／收藏、关注、管理台回复／状态和部署终态；消息 API、消息中心、设置、讨论页、收藏／关注动态已实现，尚未完成验收。

## 当前待关闭

此段为启动时的恢复记录；最终 Required 项与当前证据以合同 active ledger 为准，均已通过。

启动阶段验证：共享包/API/admin 的 tsc -b 与 frontend tsc 通过；新增模块定向 ESLint 通过。HTTP 集成脚本 scripts/test-engagement-notifications.ts 正在运行，测试未通过前不记完成。

2026-10-13 用户纠正：明确「别发邮件」「抖音不会发邮件」。邮件是 AI 扩大的触达选择，现已移除所有邮件代码、API、env 字段、token 表与 UI；没有发送过邮件。合同 rev=2。后续只完成站内与明确许可的设备推送。

- 23:55：用户新增 U1 右上叠层互动数。实际打开抖音精选与视频，消息角标 absolute、11px；视频数值在下方，不声称它们布局相同。截图 evidence/douyin-reference.png。同步远端导航任务 16c8cb8，沿新共享 FloatingDock 实现。RFC 向量与独立解密、VAPID、静默/DST、原子预算测试通过；当前 HTTP 集成测试通过（包含注入的原子写入失败）。

- 00:41：两份独立打包 Worker 的 HTTP 测试已通过：独立管理账号登录、拒绝未授权、replyId 重放和状态更新，经同一 D1 出现在主站用户私有消息及上下文。扩大用例通过 20 个点赞账号聚合、静音恢复不追旧消息、账号请求身份拒绝、后续页目标独立定位、所有权变更与并发稳定评论。Chrome 已通过实际权限与真实订阅；默认静默实测发送次数 0。

- 01:32 最终验收：四套通知测试全部通过。新增管理台首次公开事实与隐藏源撤销测试通过；管理台既有三组回归、静态发布恢复全套（包括真实 D1 终态写失败注入）通过。恢复测试故障点从单 run 扩展到原子 batch，未改变预期判定。root typecheck、变更范围 ESLint、前端构建和 API/admin dry-run 均通过；无邮件代码或发送。
- 设备证据：真实 Chrome 许可、FCM endpoint（不落公开日志）、RFC 加密、实际 provider 接收、SW showNotification 成功后 authenticated receipt=delivered；不是读取，也未声称目视看到 OS 横幅。默认静默先保持 attempts=0。完成后正常界面退订，外发开关全关。
- 双账号 CUA 最终链路：评论→作者消息→跨首屏原评论→回复→读者消息→原回复上下文→读取清角标。390×844 无横向溢出，主要动作44px，输入区 bottom752.5，草稿 Tab 可到发送。大数120/121显示99+并保留准确可访问说明；按钮、栏布局不移动；明暗主题截图可追溯。
- findings-first Review：检查新增模块及所有 source owner 接入、权限、原子性、读取水位、默认关闭、重试、publisher 冻结及主线 FloatingDock 集成。关闭跨账号旧响应401清新会话、旧 summary finally/ServiceWorker 回调的 generation 缺口。第二轮视觉审查无 P1/P2。当前无未关闭 findings；单体 bundle 大小是既有构建警告，不影响通过。
- 复盘决定 no-increment：邮件误扩已当场纠正并冻结 scope；Push实际显示回执事实已回写设计，batch故障注入落在原测试 owner；不另加全局流程规则。待 D1 发布后执行最终完成门。

- 01:37 生产链路通过：增量迁移 0009（原通知表不存在；历史 Live 作品做 baseline，不补发）；专用 VAPID via stdin，外发各分类默认关。API 330a7310-3b7a-431c-b620-79c839d9f3cc、admin 22bb576a-171a-4048-becf-d72b3b43af38、前端发布均成功。production.json 覆盖真实 HTML→DO/R2→Live→首次公开关注动态→稳定评论重试→作者通知/精确评论→回复→读者上下文/读取→赞藏数量和撤销→改私有即时拒绝；隔离作品正常删除含资源清理，两会话撤销，标记 QA 用户留审计。没有向真实用户发送测试提醒。
- 补充线上验证发现通知直达页沿原未知路由返回404：在已有 seo owner 登记通知/设置/收藏库/讨论页，仍 noindex；原 Pages Worker 对这些界面 no-store/no-referrer。已有真实 Pages 运行测试补充上述4条直达断言并全套通过，未复制另一个路由 owner。
- 主工作区 master 已快进 eb5297a；仅隔离两份冲突预览草稿并原样恢复相对主线的改动，其余导航/分析/文档草稿未提交。安装锁定依赖后主工作区全量 typecheck 通过，暂存区仍为空。

- 01:40 匿名线上界面核验补正登录按钮原不存在的翻译 key（auth.login→现有 common.signIn）。前端补充发布第一次被 GitHub 远端临时 pack 文件写入错误拒绝，未重复数据库迁移或其它已成功发布；将沿原 gh-pages 流程重新发布修正后构建。

- 01:44 补充前端重试成功，真实线上4条入口均200，返回 no-store/noindex/no-referrer，JS 为最终构建 index-DCkbFtlF.js。CUA 线上匿名入口按钮显示「登录」，无需测试开关；正式消息入口留在浏览器。production-routes.json / production-entry.png 已保存。浅色实际 DOM 主题及计算样式再核对（背景 rgba(255,255,255,.95)，文字 rgb(71,85,105)），保存 interaction-badges-light.png / detail.png；深色截图为独立此前证据。
- 收尾：所有 Required IDs passed；retrospective_decision=no-increment，parent_status=ready-for-completion-check。最终结论是已发布并具备验收条件，用户未确认体验偏好，未测得留存或活跃度提升。P1 为本地数据库代表负载，未称线上 WAN p95 39ms。真实 FCM 设备回执不等于读消息或目视 OS 横幅。此前一轮线上 smoke 用错 likesCount/favoritesCount 测试字段，已修正测试断言并重新通过全部真实链路，不把该 harness 失败记作产品失败。

- 01:48 收尾日志暴露本地 Vite `/apps` 旧静态代理会拦截讨论页刷新：原代理明确排除 `:id/discussion` 前端路径，其它 legacy app 资源继续走原 owner。定向 lint、root typecheck、构建通过；重启最新源码隔离 API+Vite，经 CUA 从真实通知链接取目标、直接打开、刷新，原评论与回复输入区正常，local-discussion-refresh.png。该改动仅开发代理，生产构建仍 index-DCkbFtlF.js，与已验收线上资产一致；无需重复生产发布。Review 检查代理边界无新 finding。

## 2026-10-14 角标视觉纠正

08:32开始。用户要求数字与留白覆盖图标右上角；原实现仅上方分隔，不满足该空间关系。沿共享 ActionCount 调整相对位置、opaque底和2px同色ring，保留pointer-events:none、准确辅助说明、零/未知隐藏和99+阈值。窄栏大数遮挡过多时上移边缘，最终top=0/right=3px，使留白切开角部而保留主轮廓。

实际完整产品与隔离D1（真实反应/评论manager，非DOM/store注入）验证1、12、99+明暗截图，数值扩展时栏41/按钮32不变，几何证据记录icon与badge相交。fixture 原大数入口增加0–200 actors校验参数，用同一来源生成两位数，无生产数据变更。主Agent看过每个最终截图，无未关闭finding；本次为局部低风险修正，不派独立评审。lint、root typecheck和发布用构建通过。本轮发布与线上核对已完成。复盘无新的全局规则增量，修正设计owner与U1证据即可。

08:44交付核对：实现6a39a97普通推送并快进主工作区；受影响目标仅前端，原gh-pages发布成功，线上返回本轮 index-HTUzCMJj.js / index-nf0zN8g5.css（200且包含同色halo样式）。CUA在真实公开作品「音乐播放器」的普通预览中读取absolute top0/right3、不透明白底/2px白色ring；icon右上与遮罩相交，按钮32/栏41。context-light.png为线上全景，online-detail.png与online-geometry.json为线上局部；不对该真实作品产生点赞、收藏或评论写入。临时fixture与Vite已清理，正式线上预览留在浏览器。U1当前证据有效，其他范围未变；已交付待用户确认视觉偏好，非用户验收已通过。
