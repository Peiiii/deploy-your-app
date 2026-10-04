---
name: gemigo-app
description: 为托管在 GemiGo 的 HTML/Web 应用接入真实账号、Cloud 存储和统一点数收费；当用户希望在应用自定义环节按次、一次解锁、按期或受控 AI 消费时使用。
---

# GemiGo 应用接入

先读 https://docs.gemigo.io/points.md 与 https://docs.gemigo.io/getting-started.md ，核对当前接口版本和支付状态。SDK 固定资源：https://docs.gemigo.io/sdk/0.3.1/gemigo-app-sdk.umd.js ，全局变量 `gemigo`。

1. 保留免费体验，按用户意图选择收费动作；不要把整个应用默认为销售商品。检查现有代码后在该动作调用 SDK。
2. 账号与 Cloud 使用现有 gemigo.auth/gemigo.cloud。点数登录需用户点击 `gemigo.auth.login({scopes:['identity:basic','points:use']})`。本地 HTML 不能伪装线上项目 origin。
3. 作者在项目设置“点数与收益”创建收费项，取得 itemId；用户未提供时指导其登记，不能发明 ID、价格或支付成功。通过 `points.items()` 核对权益键与价格。
4. 调用 `points.purchase({itemId,requestId})`；AI 固定知识服务加 topic（最多160字）。同一消费 requestId 记录到持久存储并跨恢复复用，新消费才创建新 ID。调用放在用户点击内，避免弹窗阻止。
5. 以后台 `points.receipt({requestId})` 与 `points.grants()` 为权威。durable 查永久权益，term 比较 expires_at，repeatable 查 quotas 并 `points.consume({grantId,requestId})` 核销。不要用 localStorage 的“paid=true”代替权益。
6. reserved/running 等待原收据；unknown 不盲重试上游或新建收费。弹窗被阻止时展示返回的 confirmationUrl；关闭窗口不撤销已确认交易。失败呈现真实错误，禁止 fallback 到假成功。
7. 用真实部署验证：登录→钱包获得点数→应用触发→平台确认→返回应用→刷新恢复→重复请求不重复扣。体验点不产生现金收益，充值未开通不能宣称真钱闭环完成。

部署沿用户已有流程；CLI 自动部署按现有 https://docs.gemigo.io/skills/gemigo-cli/SKILL.md 。不要将平台 Cookie、部署令牌或模型密钥写入应用。
