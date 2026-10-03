# 点数、SDK 与 docs.gemigo.io 实现设计

来源：[本次原始输入](../logs/2026-10-04-points-docs/README.md)，整体：[点数结构](2026-10-04-platform-points.design.md)。本次实现覆盖全部可独立建设部分，支付外部条件仍属于 [PD-04](../work/2026-10-04-points-docs/acceptance-contract.md)。

## 使用路径与交付

作者在现有作品设置的“点数与收益”页登记 immutable 收费项，复制调用，使用 docs 文档/下载 Skill 接入。消费者打开示例，登录并领取一次体验点（明确无现金价值），点击购买提示或永久题库，经平台确认后继续；换页刷新查询平台权益恢复。钱包显示批次与流水。作者收益区区分体验消费与实际支付价值，目前真钱未启用则显示原因，不画虚假提现按钮。

示例知识实验室既提供免费题目，也有按次提示、永久题库、按期练习与 AI 解说；另一个创意实验室共用钱包。自动续费明确授权，通过平台页取消；无余额暂停，不追扣错过周期。AI 在平台受控 Worker 执行并保存结果，平台域查询/恢复 pending。文档站可搜索、移动导航、复制代码，下载 HTML 示例及 Skill；同时发布 SDK 固定版本资产，版本与构建一并验证。

## 数据与原子合同

新增 D1 migration。`points_lots` 保存唯一来源引用、user、kind=trial/paid、总点/剩余点、实际金额/币种及入账时间。余额来自批次剩余数，避免新汇总 owner。体验 grant 按账号唯一，并有平台全局可配置总预算；本次默认每账号20点、全平台2000体验点总量（无现金价值），作者自购不兑现金；AI 日执行最多10次，成本受独立预算控制。管理员可调整，实际金额收费仍禁用。

收费项绑定 project.id 与 owner_id，保存价格、repeatable/durable/term、权益键、units、periodSeconds、delivery=grant/ai、enabled。价格不可原地改写，作者新建项再停用旧项。批次分配表插入 trigger 原子减批次余额并检查非负。收据创建→分配→即时授予→granted 的 D1 batch 为一个事务；finalize trigger 验证分配总数=价格，任何 CHECK/UNIQUE 失败回滚。durable grant 同用户/项目/权益键唯一；repeatable 的额度按原收据保存并用唯一核销键核销；term 保存上次到期与新到期，延长与扣点同事务。

收据生命周期 prepared→granted 或 reserved→running→granted/released/unknown；AI jobId=receiptId，最多一个执行者 CAS，Worker interruption 的 running 标记 unknown 并不盲重试。明确未交付结果或预算拒绝时释放，网络异常/超时 unknown 保留点数；平台操作员核查未交付后释放；结果只由受控执行者写回。每日全局 AI 执行上限和固定输出上限避免体验点变成无限模型预算；未配置服务时收费项不可用。退款恢复原批次，回冲作者收入；只有未核销额度/永久权益/尚无后续购买的按期权益可自动退款，复杂已消费状态由平台核查。每次现金结算需来自 paid allocation；trial 的金额恒 0，禁止把试点消费计为真钱。

## 身份、接口与恢复

API `/points` 管平台 session；mutation 强制同平台 Origin；新 SDK `/sdk/points` 接受 points:use token，必须查 sdk_app_users 的全局用户及 project slug、Live/current origin。points:use 授权时 broker 与后端一起验证 openerOrigin 与同一 project，不能让其它子域拿来扣别应用的钱。主域登录用户须与 intent 用户一致。

SDK purchase 在用户 gesture 同步开窗口，后台生成短期 intent 绑定用户、项目、收费项、请求 ID、state、origin；平台确认按已存快照购买。requestId 保持幂等；receipt 查询为权威，postMessage 校验 origin/source/state。关窗返回 cancelled 仅代表 UI退出，不撤销已确认交易；再次查询原 requestId 恢复。弹窗被拦时返回可操作平台确认链接，用户可复制打开并按原请求查询，不偷用无来源回跳。

公开 SDK points API：items、purchase、receipt(requestId)、grants、consume(grantId,requestId)。续费授权仅在平台确认页显式选择，subscriptions/cancel 为平台登录接口，应用不能静默订阅。错误明确余额不足、已拥有、pending、priceDisabled、sourceMismatch。订阅周期 receipt 使用 subscriptionId+dueAt 唯一键；cron 只处理已明确授权的版本，扣款前检查 active，余额不足 inactive，恢复需用户重新授权。取消前本周期已提交交易不撤销。

## 文档与样例部署

独立 `workers/docs` 使用 Workers 静态 assets 与 custom_domain=docs.gemigo.io，根目录 `developer-docs` 内容；本项目现有 SDK 指南引用到文档站，而不是平行维护另一份 API。构建脚本从源 Markdown 生成导航 HTML、llms.txt 与原 Markdown，复制真实 SDK 构建产物、现有 CLI Skill、新 app Skill和示例源码。使用一个确定的 Markdown 渲染依赖，不开发 Markdown parser。静态页提供暗色/移动布局和本地标题搜索。无需云 CMS 或新 Docs 账号。

示例应用需真实项目登记与当前 gemigo.app origin；通过现有授权部署 API/CLI 发布，不直接改他人作品。示例项目 ID/收费项 ID 注入受控配置，无用户密钥。固定模型 @cf/meta/llama-3.3-70b-instruct-fp8-fast 受控 API 必须禁用客户端 arbitrary upstream/model，现有免费 AI 代理消费者不改。

## 测试矩阵与评审

PD-01/02/08：实际 local D1 trigger/batch 验证原子扣点、不足、重复 durable、并发、退款、过期意图、跨 app origin/token、授权续费重复cron/取消；不得用纯 JS fake SQL代替。PD-03：可控制成功/明确失败/unknown 的受控上游加真实线上模型链路，结果可恢复。PD-05/06/07：构建并加载实际 SDK，浏览器从文档→示例→登录→领取→购买→刷新→跨应用；移动视口、链接/下载/代码检查。PD-04：实际获准支付回调与作者到账，无法假造。PD-09：定向 TS/lint、源码 Review、实际域名 HTTPS 与 main SHA。

Design Review 2026-10-04：本专题对文档站、SDK、平台资金与权益机制通过；唯一现金价值来源、同项目授权、事务终态、服务 unknown 与预算边界覆盖，复用现有身份/部署/SDK直接模块。支付选型与真实结算仍未就绪，不能据此部署真钱收费。
