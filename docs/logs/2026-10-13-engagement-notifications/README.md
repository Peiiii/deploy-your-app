# 互动通知落地工作记录

## 原始输入与约束

2026-10-13 用户先要求借鉴抖音等产品，统一设计及时而适度的互动通知，随后明确要求「落地验证」。以 [统一设计](../../designs/2026-10-13-engagement-notifications.design.md) 为实施输入；执行涵盖适用实现、验证、Review、发布与线上验收，不把批次当整体完成。用户明确排除邮件，只使用站内提示和用户主动许可的设备推送。

## 当前状态与恢复

- delivery-mode=major；flow=standard；risk=L3/L4；phase=delivery；retrospective_state=pending。
- 开始：2026-10-13 22:52 CST；预计完成 2026-10-14 00:52–01:52 CST，外部阻塞单列。
- 工作区：`/Users/peiwang/.codex/worktrees/engagement-notifications/deploy-your-app`，主工作区有其它任务修改，不覆盖。
- active-contract：[合同](../../work/2026-10-13-engagement-notifications/acceptance-contract.md)。
- plan：[执行计划](../../plans/2026-10-13-engagement-notifications.plan.md)。
- 设计首批已经 review；外发选择与后续设计若发生变化先更新设计。
- 依赖核对：本地未发现 Resend/VAPID 配置；线上 Secret 名称已核对，确无邮件／Push 凭据；已询问用户邮件发信域名、测试邮箱及在 Worker 配置 RESEND_API_KEY，未获答复。Web Push 可自主生成项目专用 VAPID，下一批先冻结具体协议设计。
- 进度：新建隔离工作区，实施前 owner/路径核对完成；已建立共享通知持久层，接入评论、点赞／收藏、关注、管理台回复／状态和部署终态；消息 API、消息中心、设置、讨论页、收藏／关注动态已实现，尚未完成验收。

## 当前待关闭

A1–A11、B1–B5、P1、D1；各项尚无实现证据。后续每批更新本记录和合同，不重抄设计。

最近验证：共享包/API/admin 的 tsc -b 与 frontend tsc 通过；新增模块定向 ESLint 通过。HTTP 集成脚本 scripts/test-engagement-notifications.ts 正在运行，测试未通过前不记完成。

2026-10-13 用户纠正：明确「别发邮件」「抖音不会发邮件」。邮件是 AI 扩大的触达选择，现已移除所有邮件代码、API、env 字段、token 表与 UI；没有发送过邮件。合同 rev=2。后续只完成站内与明确许可的设备推送。

- 23:55：用户新增 U1 右上叠层互动数。实际打开抖音精选与视频，消息角标 absolute、11px；视频数值在下方，不声称它们布局相同。截图 evidence/douyin-reference.png。同步远端导航任务 16c8cb8，沿新共享 FloatingDock 实现。RFC 向量与独立解密、VAPID、静默/DST、原子预算测试通过；当前 HTTP 集成测试通过（包含注入的原子写入失败）。

- 00:41：两份独立打包 Worker 的 HTTP 测试已通过：独立管理账号登录、拒绝未授权、replyId 重放和状态更新，经同一 D1 出现在主站用户私有消息及上下文。扩大用例通过 20 个点赞账号聚合、静音恢复不追旧消息、账号请求身份拒绝、后续页目标独立定位、所有权变更与并发稳定评论。Chrome 已通过实际权限与真实订阅；默认静默实测发送次数 0。

- 01:32 最终验收：四套通知测试全部通过。新增管理台首次公开事实与隐藏源撤销测试通过；管理台既有三组回归、静态发布恢复全套（包括真实 D1 终态写失败注入）通过。恢复测试故障点从单 run 扩展到原子 batch，未改变预期判定。root typecheck、变更范围 ESLint、前端构建和 API/admin dry-run 均通过；无邮件代码或发送。
- 设备证据：真实 Chrome 许可、FCM endpoint（不落公开日志）、RFC 加密、实际 provider 接收、SW showNotification 成功后 authenticated receipt=delivered；不是读取，也未声称目视看到 OS 横幅。默认静默先保持 attempts=0。完成后正常界面退订，外发开关全关。
- 双账号 CUA 最终链路：评论→作者消息→跨首屏原评论→回复→读者消息→原回复上下文→读取清角标。390×844 无横向溢出，主要动作44px，输入区 bottom752.5，草稿 Tab 可到发送。大数120/121显示99+并保留准确可访问说明；按钮、栏布局不移动；明暗主题截图可追溯。
- findings-first Review：检查新增模块及所有 source owner 接入、权限、原子性、读取水位、默认关闭、重试、publisher 冻结及主线 FloatingDock 集成。关闭跨账号旧响应401清新会话、旧 summary finally/ServiceWorker 回调的 generation 缺口。第二轮视觉审查无 P1/P2。当前无未关闭 findings；单体 bundle 大小是既有构建警告，不影响通过。
- 复盘决定 no-increment：邮件误扩已当场纠正并冻结 scope；Push实际显示回执事实已回写设计，batch故障注入落在原测试 owner；不另加全局流程规则。待 D1 发布后执行最终完成门。
