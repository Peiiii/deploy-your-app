# 互动通知实施计划

Goal：按已形成的统一设计落地可用通知闭环并完成线上验证。
Architecture：现有业务 owner 与共享 D1 通知持久层一次事务写入；消息查询、阅读、设置和外发策略收敛；前端沿 presenter/manager/store。
Tech stack：React、TypeScript、Cloudflare Workers/D1，沿用现有技术。

上位：[设计](../designs/2026-10-13-engagement-notifications.design.md)；[合同](../work/2026-10-13-engagement-notifications/acceptance-contract.md)，rev=2；唯一恢复入口：[工作记录](../logs/2026-10-13-engagement-notifications/README.md)。

1. 共享通知 contract、schema、持久化语句，主站与 admin 业务边界接入。复用设计 §6–10；验证 D1 原子性、接收者、去重、撤销、同库权限。
2. 通知查询与摘要、显式已读、偏好／静音、评论定位／待回复、收藏／关注找回 API。复用 §5–10；集成测试 A1–A6/A8–A10，不把模拟数据当最终链路。
3. 消息中心、Header、设置、讨论落点及回访入口。复用 §4–9；真实浏览器状态/移动端/账号切换，定向类型与 lint。
4. publication、部署终态与关注动态。复用 §6/10.2/10.3；真实成功边界与恢复路径，A7。
5. 设备推送策略、主动许可、持久送达与取消订阅。接入条件核对后审查 §10.3 的具体渠道设计，补足当前细节后实现；B1–B5，缺真实配置保持 blocked，不暂停其它部分。
6. 代表负载、全部适用验收、diff-only 可维护性与实现 Review；修正 findings 后重验受影响证据。
7. 精确提交普通推送、主工作区安全同步、schema/双 Worker/前端部署、线上验收；记录实际 SHA 与生产版本，完成复盘及 lifecycle 完成门。

中断时保存下一步、未通过合同 ID、未确定外部动作。不存在自动延期或另建唤醒任务；本任务持续执行。
