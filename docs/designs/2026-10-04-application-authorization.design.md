# 应用登录与授权优化

状态：design-ready；用户已明确要求按上一轮评审优化。标准feature/bugfix混合，L4发布；上位合同gemigo-app-api-gateway-20261003 scope revision2。

## 用户链路与验收

用户在小伴点登录 → 桌面弹窗/手机整页到gemigo.io/auth/authorize?request=<短期随机ID> → 显示平台核实的小伴名称、应用域名、提供者、中文权限解释 → 登录平台账号或确认当前账号 → 同意并返回小伴 → 看到登录成功，可用文字和语音。取消返回原应用可重试；刷新授权页保留同一请求；关闭弹窗、超时、请求过期及来源不符给出明确反馈。

桌面弹窗被阻止时auto模式直接整页；弹窗打开但无可用opener时页面明确提供整页重新登录指引，不静默发码。SDK默认popup保留既有消费者行为，小伴显式auto并在启动await handleRedirectCallback。开发者选择redirect时使用同一方法恢复，不在后台自动扩大授权。

首次和已授权用户均看到当前账户与返回应用；已授权时使用“继续登录”并简化权限解释，新增权限仍明确呈现。邮箱登录沿用现有AuthModal，Google/GitHub沿用平台OAuth且redirect保留短期request链接；不另建账户系统。

AUTH-01短地址及旧/sdk/broker兼容；02真实应用信息/中文权限/品牌与明暗主题/账号切换/移动布局；03基础、存储与积分发行统一来源验证及旧未验证凭证失效；04整页正常/取消/刷新/PKCE/state错误/过期返回并清掉URL临时参数；05桌面弹窗正常、关闭和blocked auto回退；06SDK公开类型/构建/示例/旧消费者；07API/Pages/docs/SDK/小伴上线与主线同步。原GW-03按新增发行来源威胁重验；GW-10物理声音和真实手机仍待用户。

## 选型

仅换皮不能修复来源缺口和手机链路；独立auth子域要迁移cookie/OAuth回调，无当前收益。采用现平台域名、同一SDK身份owner与请求生命周期。短请求存D1，10分钟有效、有上限和过期清理，不放API Key、token或PKCE verifier到地址。旧带参数页面通过同一后端context校验和issuer，只保留已发布SDK需要的popup路径。

issuer对每一种scope都要求平台同源cookie操作，并验证appId对应Live未删除项目、输入来源严格等于项目公开URL origin。生产不再接受任意localhost或任意gemigo.app子域；本地平台可用本地开发库登记的项目URL。回跳URI严格等于项目登记的完整URL（归一化URL表示）；SDK将原页面路径/查询/hash保存在会话状态并在验证成功后恢复。scope只接受identity:basic、storage:rw、points:use，始终含basic；来源与回跳不能靠查询宣称。

GET公开context只返回该应用授权所需的真实展示投影，不返回owner私有邮箱/id、Session或令牌。授权请求记录appId、origin、redirectURI、state、S256 challenge、scopes、mode、有效期和使用时间；发码一次性CAS。新请求和旧API调用复用同一authorize发行校验。SDK popup消息核对origin/source/state；redirect回到注册URL携带短期code/state或error，不含token。SDK会话记录绑定appId、API地址、返回URL、verifier、state和10分钟有效期；响应state不符、过期或来源错误不交换令牌，回调参数先移除，不进入应用历史。

持久SDK auth codes/access tokens新增source_origin；新发行写已验证来源，查询不接受NULL的旧凭证。保留旧记录及账号/数据/积分，旧会话需重新登录；不靠一次性批量删除和发布时间窗口判断是否安全。code仅从有来源的记录兑换，issuer与repo维护同一事实。无需更改长期Key、原全局文字网关或付费机制。

## Review与验证

Design Review：旧路径外部需要已证实；短请求新增表用于当前手机/第三方OAuth恢复而非未来扩展。来源、registered callback、popup与redirect生命周期、刷新/取消/旧会话迁移均有owner和失败出口；无开放设计finding。未知真实手机设备仍明确披露。

验证：SQLite/Miniflare旧身份冒认修前基线；新增来源/平台CSRF/PKCE/one-use/TTL/旧凭证/权限unknown/回跳错误；SDK运行代码的popup、redirect、state错/过期/恢复/取消/URL清理；旧积分套件不变业务结果；worker/frontend/SDK tsc+lint+build；实际线上小伴点击→授权页→返回→文字/语音，截图；桌面popup能力若环境限制则按层级留证而不宣称真人设备已验。

抽象审计：保留SDK Auth service/repo作为唯一发行owner，新增请求记录与授权展示是同一生命周期的必要投影；删除前端来源后缀的权限裁决，保留纯格式错误提示。延后独立auth子域、任意自定义client注册体系、自动扩权、支付、身份供应商新增。

## 实施前接入细化（Review passed）
小伴以整页跳转为主路径，避免当前 IAB 曾返回弹窗句柄却无法展示弹窗的已观察问题；SDK 保留 popup 默认与 auto（手机跳转/被阻止则跳转），桌面应用可自行选择。回调参数使用 gemigo_code/gemigo_state/gemigo_error 避免占用应用通用参数。注册 URL 必须规范化后完全相等。未降低授权安全和验收标准。
