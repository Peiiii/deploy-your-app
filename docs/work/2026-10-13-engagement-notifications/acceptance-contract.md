# 互动通知交付合同

- contract-id: gemigo-engagement-20261013
- parent-goal: 用户能够及时知道真实互动、直达上下文回应和回访，并能控制打扰；适用改动线上生效且经验证。
- scope-revision: 3；用户来源见 [工作记录](../../logs/2026-10-13-engagement-notifications/README.md)。
- 原授权：用户「落地验证」与项目全托管；各批次是实施顺序，不是缩小最终结果。
- 设计与标准：[统一设计 §12–14](../../designs/2026-10-13-engagement-notifications.design.md)。A/B IDs 沿用原文；P1 为原文代表负载性能，D1 为 Review、精确 Git 主线交付、迁移、部署及线上用户链路。
- 不变量：业务与接收者事实原子写入；服务端当前权限、读取水位和全渠道预算唯一；无虚假红点、跨账号泄露或未经许可外发。
- 外部边界：真实 Push 条件缺失时保持 Required 未完成，不降低为 optional；完成其余可执行路径。

## Active acceptance ledger

| ID | Required | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- |
| A1 | true | passed | HTTP 集成 + 双账号 CUA：读者评论→作者原评论回复→读者消息→上下文；reader-inbox-mobile.png / reply-context-mobile.png | — |
| A2 | true | passed | test-engagement-notifications.ts：接收者去重、自行为排除、私有来源与无效目标 | — |
| A3 | true | passed | test-notification-admin.ts：独立 API/admin Worker、实际登录和 HTTP 回复/状态；共享 D1 | — |
| A4 | true | passed | HTTP：20 个实际账号聚合、撤销再赞 24h 只计当前数且不重复提醒 | — |
| A5 | true | passed | HTTP：读取 N 后 N+1 保留未读、单调水位、列表冻结 snapshotSeq | — |
| A6 | true | passed | HTTP：他人作品收藏；CUA 预览真实收藏/取消及计数 | — |
| A7 | true | passed | HTTP：首次公开成功、失败/私有/重复发布/取消关注；管理台 visibility 首次事实与冻结作者 | — |
| A8 | true | passed | HTTP：非首页目标与父评论；CUA 390px 上下文；X-Gemigo-Viewer 身份冲突拒绝 | — |
| A9 | true | passed | HTTP：注入 D1 通知写失败证明 source 回滚；稳定 submissionId 并发与重试 | — |
| A10 | true | passed | HTTP + scheduler：删除/私有/所有权变化/过期；共享批处理撤销与待发取消 trigger | — |
| A11 | true | passed | CUA：390×844 页面宽390、主要动作44px、输入框可见、草稿 Tab→发送；可见轮询与错误状态代码审查 | — |
| B1 | true | passed | Chrome 正常许可→真实 FCM 订阅→实际加密发送→SW showNotification 完成后设备回执 delivered；device-consent.png / device-delivery.json；测试后已退订 | — |
| B2 | true | passed | delivery + scheduler：本地时区/DST/未知时区/静默/摘要每日额度/暂停恢复不追旧 | — |
| B3 | true | passed | delivery + scheduler：实际 D1 并发原子 claim、unknown 不盲重试、冻结 endpoint、429 确认失败后退避 | — |
| B4 | true | passed | scheduler：读/静音/权限/撤销/410 重新确认和取消；CUA 实际退订；无邮件路径 | — |
| B5 | true | passed | scheduler：7天忽略且≥3发送降频；明确恢复只接未来事件；设置说明已实现 | — |
| U1 | true | passed | CUA：真实 0/1/2 增删、120→99+；几何不变/41px栏/32px按钮、绝对定位、明暗主题；第二轮视觉Review无P1/P2 | — |
| P1 | true | passed | performance.json：本地 D1 代表负载 100万总记录/用户1万/100组；p95 39ms（21次，不含 WAN） | — |
| D1 | true | not-run | — | — |

## 当前阶段门

完成站内事件、双 Worker 写入、消息中心及回访入口，保持现有部署、评论、导航与其它任务改动。后续渠道仍在整体范围内，只有真实凭据／设备条件能阻止相应步骤。

## 生效记录

用户于 2026-10-13 明确纠正「别发邮件」「抖音不会发邮件」：排除邮件及其配置、验证、退订和发送，scope-revision=2，scope-confirmation=user-confirmed；B1–B5 按设备推送适用场景验证，保持静默、许可和频控。

用户于 2026-10-13 23:50 补充截图与抖音参考：预览操作栏三种互动的数量置于图标右上角，不占布局、不挤动原控件；scope-revision=3，scope-confirmation=user-confirmed。U1 覆盖零／未知／大数、真实增删、作品及账号切换、主题、窄屏和操作可达性。
