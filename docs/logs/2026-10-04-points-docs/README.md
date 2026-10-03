# 统一点数与开发者文档站：交付记录

## 原始输入与约束

来源：2026-10-04 当前会话。用户原话：“要有 SDK 或者 skill 什么的……应该有个文档站……两个事情全部完成，做充分的验证。”域名指定 `docs.gemigo.io`，要求充值等收费环节、示例应用以及“用户的点数怎么来”形成闭环。前序原话要求统一点数、应用自定义收费时机，支持 AI/非 AI、一次和订阅，且纠正“作者发布商品”的误解。

有效变更：此前只交付方案，本次明确授权整个实现、验证和线上交付；首批切片不再是整体完成边界。用户回复“没有”确定当前无定价、分成或补贴预算；用户后续明确“大陆个人无商户”。不把沉默当支付批准。主项目 AGENTS 的全托管授权适用。

## 入口

- [当前状态](../../work/2026-10-04-points-docs/current-state.md)
- [整体验收](../../work/2026-10-04-points-docs/acceptance-contract.md)
- [实现专题设计](../../designs/2026-10-04-points-docs-implementation.design.md)
- [整体结构](../../designs/2026-10-04-platform-points.design.md)

## 过程记录

- 初查：复用 API/D1、平台 cookie 登录、SDK PKCE、前端作品设置；未发现现成支付集成。Cloudflare OAuth 权限具备 Worker、D1、Pages、routes；平台 Pages 项目 `gemigo` 已存在。为保护并行 admin 工作创建 managed worktree `points-docs`、分支 `codex/points-docs`。
- 方案审查：增加资金来源批次、交易内原子分配及权益、限定服务、消费授权作用域；文档站使用独立静态 Worker 自定义域名，复用实际 SDK 构建产物与现有部署 Skill。避免为未知支付商建立虚假的已开通充值。

- 验证：实际 Miniflare D1 批次/trigger，覆盖领取、并发、按次核销、一次解锁、连续退款、term 延長、周期唯一扣点、AI成功/明确失败/不确定恢复；补充真实平台 session+SDK token 的 intent→confirm→receipt 集成和越权拒绝。TypeScript API/前端通过；SDK、前端、CLI 构建通过。文档站本地路由、下载头、真实404、搜索与代码复制通过。
- 用户追加“不做概念演示或半成品”；维持所有 Required 条目，不以体验点替代 PD-04。新 AGENTS 的独立探索目录规则不改变本项目内 SDK 示例的位置。

- 收款核查（2026-10-04）：用户明确大陆个人、无商户。[微信 PC 网站支付](https://pay.wechatpay.cn/static/applyment_guide/applyment_detail_website.shtml)列出个体/企业营业执照等材料；[平台收付通](https://pay.wechatpay.cn/static/partner_ability/business_payment.shtml)主要面向实物交易，平台需服务商入驻、主体一致 ICP/EDI 等资质。个人作为二级商户可入驻不等于个人可成为平台并统一充值分账。[Creem 条款](https://www.creem.io/terms)10.9 的分成不授权经营 marketplace；不据此假定可替代平台结算。现有个人身份没有可直接启用的、已获准的统一点数+第三方作者到账渠道；PD-04 保持 blocked，不以体验点验收替代。
- Review 返工：消费原子检查项目 Live/未删除/作者归属，删除应用停止续费；按期退款停止续费；AI 输入与意图原子保存，竞争不同输入拒绝；示例核销网络恢复保留 grantId+requestId。新增管理员实际补贴配置与服务核查释放入口。

- 实现 Review：从用户原始要求核对平台自定义扣费、统一来源、续费、SDK 和示例。已修复项目生命周期、term 退款续费、并发 AI 输入与核销恢复 finding；对当前无现金钱包/权益/受控 AI/文档站发布候选无剩余代码 finding。现金准入、充值回调/对账/作者到账仍是 PD-04 阻塞，不作整体验收通过。仓库没有独立 diff-only maintainability 脚本，按完整 findings-first 与主观 owner 复核；余额/来源/权益以 D1 为唯一 owner，没有客户端授予或测试成功替代生产。
- 完整 `pnpm check`（lint、全仓 tsc、domain registry）通过，API Worker dry-run bundle 通过；D1 集成补充既有 Cloud KV 与旧 token、app/user 隔离、补贴耗尽和未经开通的实付来源拒绝，全部通过。lint 精确排除新增 docs 构建目录及 Worker 编译产物，未忽略源文件。npm `whoami` 返回 401；先发布 docs 域名固定 SDK 资源，npm registry 未发布须如实保留。

## 线上验收证据

可独立使用的点数、SDK/Skill、文档站与两应用源码已发布。整体未完成：PD-04 无获准商户渠道，充值/支付回调对账/真钱退款/作者到账尚未实现和验收；PD-07 第二应用的最后浏览器消费验证因 Mac 锁屏待解锁。原合同 Required 未减少。

- 实际入口：[文档](https://docs.gemigo.io)、[钱包](https://gemigo.io/wallet)、[知识实验室](https://knowledge-lab.gemigo.app/)、[创意实验室](https://creative-lab.gemigo.app/)。两示例是正式项目，使用生产账号与正式 v0.3.0 SDK；没有客户端假余额/假订单。
- 文档站七页、原 Markdown、Skill、SDK 资源、可安装 tgz、搜索文件和真实404线上核对。实际从公开 URL npm 安装 SDK 后核对 default import、版本、类型和依赖通过；npm registry 401，未声称 registry 发布成功。[截图](artifacts/docs-live.png)。
- 钱包一次领取20点，重复领取余额不增。所有线上验收收据 paid_minor=0、creator_minor=0，来源 trial。充值按钮和 API 明确不可用，没有把体验消费伪造成作者收入。
- 知识示例真实浏览器登录，取消初次确认不扣点；重开同一意图购买2点提示（f24cc83f-e343-4ece-bd15-222d4f471f54），核销一份后额度0；4点永久题库（d04e2185-69fc-48fa-9294-ff2996399813）跨刷新恢复，再点击解锁仍同收据且不二扣。
- 按期5点（ca914bf1-8fe1-4fae-bbe7-4655f7aeebee），默认未勾选续费，验收时显式勾选。钱包实际取消 subscription 40d6b236-2e08-4745-91b9-acd0f3fa54c6，active=0；已付权益仍显示至2026-11-03。没有伪称真实等待30天；到期、余额不足停续费、重复cron和退款停止续费用实际 D1/受控时间证明。
- 实际 Workers AI 服务先预留3点，看到 running，再从平台恢复 granted 结果。首个模型科学解说存在错误，已更换固定模型 @cf/meta/llama-3.3-70b-instruct-fp8-fast（[官方参数](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)），512输出上限、temperature=0.2；第二真实请求 63669394-4172-4444-ad94-ec2025ab8580 已持久化、恢复并核对瑞利散射解释。AI 内容仍可能有误，页面明确需核实。
- 实际浏览器发现确认窗口等待超过 SDK 超时后，示例在尚无收据时丢弃原请求。已修复保留 UUID＋原主题，复用原意图，输入变化不另建收费；对真实 HTML 脚本故障回放通过。旧 AI 收据仍可按 last-ai 恢复，没有重新执行旧服务。
- 作者页面实际创建收费项 4cbc6e7b-bc77-47a6-8170-ada7c49968d3 并停用；第二份2点提示 e25f849c-7e60-4965-acea-225e511787b2 未核销，作者点击退款成功，额度1→0，原余额4→6。随后第二 AI 扣3，生产余额3。最新脱敏快照：[production-evidence.json](artifacts/production-evidence.json)。
- 实际 D1 测试覆盖事务/trigger 回滚、20路并发不透支、来源补贴耗尽、原价幂等、跨应用/用户/Origin/收费项隔离、未开通 paid 拒绝、按次重复核销、永久竞购、term 延长和退款栈、到期、续费不足、取消和删除项目停续费、过期确认拒绝。受控上游仅用于明确失败/unknown/CAS/迟到结果及已释放不复活竞争，不能替代上述真实 Workers AI 调用。
- 最后实现 Review 修复作者销售接口暴露买家全局ID和AI输入/结果，SDK items 仅公开收费项字段；normalized topic 在重试前校验；缺AI绑定不扣；过时管理员释放不能退款已交付结果；原执行者迟到结果可保存，已释放收据不复活。补充实际 D1 与源码回放验证，当前可独立发布范围无剩余代码 finding。
- 完整 pnpm check、SDK/CLI/前端/docs构建、API部署 bundle、SEO Pages runtime 通过。用户界面证据来自实际点击，服务异常测试明确区分受控故障；静态源码中的免费/付费展示不能保护客户端源代码或秘密，文档说明真正受保护资源需受信服务端检查权益。

## 部署与 Git

- 生产 D1 additive migration 0006：23命令成功，旧部署/用户数据保留；生产 before bookmark 0000499a-00000ee8-000050f9-418804ca4e5bcf51e39bf30c906e01e6，after 0000499a-00000f10-000050f9-69b6ed7b6094da5f31ea2bfb4f831307。没有写入 paid 充值或更换 Secrets。
- Pages 项目 gemigo 生产分支 gh-pages；deploy:pages 发布 gh-pages e72cc6b，Production 2f134b90-14dd-482e-bb40-38503c53a233。实际 gemigo.io/wallet HTTP200/noindex 和 index-BnSsYbi1.js 已核对。向 master 产生的 Preview 不作生产证据。
- docs Worker：9520c5fc-5fee-403f-898f-396f5611651e。知识示例更新在原项目 5d87699b-bd26-4b16-8a50-45f3126721af，deployment f3c34751-c4c6-4895-ba27-b4201e85fdde SUCCESS；线上应用脚本与源码相同，完整HTML仅含网关既有favicon/analytics注入。创意原项目 51ce4e3c-197f-4ee5-b136-d1885b3b8e81，deployment abce4dcf-2204-4309-b457-80d9a2ee7374 SUCCESS。
- SDK v0.3.0 UMD线上字节与构建一致、CORS=*，SHA256 ffb9eac3eda8be9f74da58bbf10e18e2dce806562c1631e444db0b4d6caa3401。本次后续客户端改动未改该版本SDK字节。
- 本任务精确提交并普通推送，合入同期admin已交付变更；主区未提交 analytics脚本、两份文档和tgz均按内容哈希核对保留。最后代码/API版本与最终 Git同步收尾记录见当前状态及生产快照。

## 交付汇总与复盘

整体 blocked，继续条件：[支付开通条件与材料草稿](../../designs/2026-10-04-payment-onboarding.design.md)及 Mac解锁后的第二示例浏览器验收。支付需要实际获准渠道、商户、经济参数及后续代码/真实交易验收，不能描述成只需填一个Key。

retrospective_decision：updated-existing-owner。已核实 Pages 的 production分支，修正原 TECHNICAL_ARCHITECTURE.md 中 GitHub Pages 描述，链接唯一命令owner与本次证据；超时/迟到/终态竞争的高影响错误已经落为实际源码/D1回归。没有新增全局开发规则。父目标仍未完成，retrospective_state=decision-recorded，不能由子模块部署成功推断整体验收完成。
