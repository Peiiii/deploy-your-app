# 应用 Secrets 与 API 中转交付记录

## 原始输入与约束

2026-10-03 用户：每个应用管理员可以配置任意 Secrets 和自定义 URL；平台代理注入 Key；只有所属应用可以消费，支持登录与限额、停用/撤销；覆盖 OpenAI 文字和实时语音。明确先不做支付，不提供用户自定义后端代码执行。
用户确认讨论方案后明确“可以，那你按这个落地吧”。有效设计为 docs/designs/2026-10-03-app-secrets-api-gateway.design.md。项目 AGENTS 全托管授权含提交、推送、主线同步、部署和线上验收。

## 恢复

唯一入口：../../work/2026-10-03-app-api-gateway/current-state.md。所有 Required 项按 active contract 对账，不把模块完成当整体完成。
