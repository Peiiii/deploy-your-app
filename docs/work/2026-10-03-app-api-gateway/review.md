# 实现 Review（2026-10-04）

范围：应用 Secret/连接、D1原子票据与预算、项目级DO的HTTP/SSE/Qwen生命周期、设置UI、反向代理装配，以及小伴从本机桥迁移到应用连接。主线积分、SDK身份、统计与原代理按现有owner保留。

审查发现并已修正：

- 短上游分块在脱敏缓冲未满时没有输出，可能使ReadableStream停顿。改为继续读取直到可安全输出；UTF-8/重叠Key/全部分块尺寸的测试及云端3字节分块回显已通过。
- 慢客户端上传原本未响应会话撤销。输入reader绑定同一abort信号，取消与长度限制测试通过；调用deadline不晚于持久lease到期，避免配置读取延迟造成并发超发。
- 经Pages转发时，票据URL不能采用内部请求host。改为平台配置的公开origin，设置页复制完整平台URL；不信任客户端forwarded-host决定授权。
- 切换项目后旧设置请求可能改变反馈/busy状态。load与mutation分别带版本，跨项目往返也废弃旧异步结果，表单以project.id重新挂载。
- 上游Content-Type参数可能回显鉴权值。仅返回校验后的规范MIME，不转发供应商响应Header；上游失败正文与stack不回传。
- 含分析批次的101响应不能用普通Response复制，否则WebSocket对象丢失。保留101响应对象，沿用原分析owner。

- 项目删除原本会遗留托管密文及活动流。改由同一项目DO停止请求、清除应用表并删除项目，持久删除标记拒绝迟到调用；SQL租户清理与真实Cloudflare活动流删除验收通过。
- 首次DO迁移不能向前回滚旧Worker。恢复步骤改为保留DO的冻结503恢复包，并通过真实Cloudflare验证既有登录入口仍可用。

自动检查：项目没有登记的diff-only maintainability可执行入口，按完整findings-first与条件主观复核审查，没有临时创建检查脚本。定向tsc/lint、静态构建、真实SQL/stream检查，以及真实Cloudflare的文字、语音、隔离、额度、撤销证据见本目录。新增DO作为唯一活动生命周期owner，D1作为唯一持久预算owner；没有按协议复制授权状态。Secret管理复用项目owner，登录消费复用SDK appId，公开Origin明确不能当作强认证。

结论：实现范围无开放finding。发布后的真实Pages反向代理、实际项目部署、主线同步属于GW-09交付验收；用户物理可听与真实手机设备仍未验证，不能宣称用户验收通过。台账按真实范围更新，后续发布发现缺口继续返工。

## 授权页评审新增 finding（2026-10-04，已修复待线上复核）

[P1] 基础SDK授权发行没有绑定真实应用来源。workers/api/src/services/sdk-auth.service.ts:137-141 只对points:use核对项目与openerOrigin；identity:basic可由输入appId发行身份，授权页仅检查来源后缀、展示查询中的appId。网关消费处校验token.appId的既有测试不能证明发行处没有应用冒认。代码路径已确认，尚未进行攻击复现；GW-03证据转stale，返工需覆盖基础与积分身份发行、真实应用元数据、合法开发来源及旧SDK兼容。不能将此Finding列为单纯视觉优化。

本轮用户询问地址/美观/体验，范围为评审与设计讨论，没有部署新授权行为。当前可保留PKCE/state；规范公开入口、统一授权页和全页返回方案须按新的授权合同完成设计与验证。


## 授权优化实现 Review（scope-revision 2）

原P1基线在真实D1模拟环境复现：basic身份对外来openerOrigin签发code。修后同触发拒绝；全部scope核对已发布项目与平台Origin，旧NULL source_origin凭证排除，新code→token继承来源，兑换核对来源。请求上下文仅公开项目名、注册域名与经public-author规则过滤的提供者，不泄露ownerId/email/session。

Review finding已修正：申请请求阶段网络挂起或弹窗关闭原先未受超时控制，现在请求阶段和等待返回阶段均清理timer/listener/窗口；交换请求有30秒超时。跨页state只存session、校验十分钟时限并在兑换前清除参数，single-flight避免重复兑换。新旧页面共用一个组件，实际发行仍由原SdkAuthService负责，没有两个身份owner。

定向D1/SDK行为验证、17网关不变量、原积分/Cloud检查、worker/frontend类型、lint和构建通过。条件主观复核：请求模块隔离短期记录与公开context，旧发行/兑换路径复用；SDK只增加当前小伴与文档调用的公开方法；固定SDK旧资源保留原release包，不覆盖旧版本。项目无diff-only可执行维护性检查，未新增形式脚本。当前实现 no open findings。迁移/部署及真实授权页面返回须继续线上验收，不把mock说成浏览器成功，真实手机和物理声音继续披露。

线上复核发现并修正：平台SEO/Pages路由表未登记新授权路径，HTML虽存在但状态404。回到同一seo owner补齐known路由；新旧授权HTML均noindex/no-store/no-referrer，并扩充实际Pages Worker路由测试。小伴HTML设置no-referrer以保护回调加载阶段。重新构建和路由测试后再发布。
