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

## 交付汇总与复盘

进行中；尚未交付，不宣称真钱充值或作者到账。
