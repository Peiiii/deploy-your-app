# 授权优化交付（2026-10-04）

本轮用户批准优化授权地址、页面与登录体验；实现44b8a65，合并并发主线345ae93/bc0c109，Pages路由修正45f289a，标题修正c3ca5ae。发行与应用运行身份使用原 SDK owner。

从 https://xiaoban-voice.gemigo.app 点击“登录 GemiGo”，进入 https://gemigo.io/auth/authorize?request=<UUID>，显示平台核实的小伴名称、域名、公开提供者、权限和当前账号。已有权限显示“继续登录”，首次权限显示“同意并返回应用”；取消也返回应用。小伴采用整页方式，兼容手机/弹窗受限环境。旧 `/sdk/broker` 已发布SDK仍兼容，SDK 0.3.1保留popup默认及auto，新增handleRedirectCallback。

## 实际发布

- 生产D1 0008：6条SQL成功，增加两处source_origin及短期request表/索引。旧24条NULL来源token保留但新repository拒绝，旧会话需要重新登录；账号、Cloud、积分和Secrets保留。
- API Worker版本082ccacf-0376-4120-9440-352a7460e56f；API发行同源校验及所有scope来源约束已实测。
- Pages沿用gh-pages发布，线上index-Bilfenl2.js与本地SHA256均0647ca06a2e74905b18c6cf594b16c00eab764df2064a13826124397d350c02b。新/旧授权页面200、noindex、no-store、no-referrer；中文浏览器标题已实测。
- 文档Worker 7f0e91ea-6996-491a-8555-c8fd8e330e42；SDK官方固定分发 https://docs.gemigo.io/sdk/0.3.1/gemigo-app-sdk-0.3.1.tgz 。npm registry仍为0.2.9，本机npm未认证，未宣称registry发布。原0.3.0线上包与归档SHA256逐字一致（bcf914e50d971294378a63644a003e85ca6eeaa48602e0f69d58b594d290af8a），保留固定版本字节。
- 小伴真实上传ZIP后部署dfbf7ef8-9883-479f-bc9a-c218e8ef50d2；reconcile返回SUCCESS、static，项目最后结果succeeded。app.js/gateway.js/SDK/config线上哈希逐字一致；HTML因平台字体/图标/统计runtime注入不同，no-referrer与应用入口核对有效。详细见authorization-app-deployment.json。
- 当前源码与静态包：/Users/peiwang/Projects/voice-companion/delivery/xiaoban-source.zip 与 xiaoban-static.zip。依赖锁定官方0.3.1 tarball，README说明整页登录。104文件及解压ZIP成员检查无实际上游Keys，无.env/node_modules。

## 验收证据

实际浏览器从小伴按钮发起（未注入SDK token）：取消返回、成功授权返回、回调参数/pending记录清除、刷新恢复均通过。正常文本框收到DeepSeek真实回答。使用这次正常登录的凭证，通过应用gateway模块取得实际WS票据并收到千问92160字节音频与文本，socket closed；这是协议响应工程证据，没有在此探针播放音频或声称用户听见。见authorization-browser-live.json及artifacts/authorization-*.png。

390像素窄屏布局实测scrollWidth=390，浅色/深色截图有效。高级viewport覆盖初次未影响既有tab，因此使用CDP设置并测量实际尺寸；均已恢复。旧SDK页面显示同一核实应用。账号切换复用原auth presenter的logout/openAuthModal，UI与调用链已核对；未为演示注销用户现有CLI会话，也未模拟外部Google/GitHub登录成功。

生产API负向验证：基础发行错误来源403、请求创建错误来源403、非注册回跳400、未登录确认401、请求重复使用400、code重复兑换400、context no-store。实际D1迁移测试还覆盖旧code/token失效、scope/PKCE、CSRF、状态/URL改变、并行CAS、cap、TTL和自定义域名；SDK实际源码测试覆盖state/TTL/取消/清URL/恢复/single-flight与popup source/origin/state/关闭/超时/blocked auto/请求阶段挂起及关闭。积分/Cloud原套件、17网关不变量、合并主线的存储清理套件、Pages真实Worker路由、类型/lint/build、小伴6项测试通过。

测试平台cookie、应用SDK session、测试聊天、视口和主题恢复，探针WS关闭；用户可用小伴和设置tab保留。原4318本机服务不重启；未新增云端staging资源。

## 恢复与边界

新冻结恢复包 ~/.config/gemigo/recovery/app-authorization-20261004/wrangler.toml，no_bundle=true，保留全部DO绑定/迁移及本轮安全身份规则。`pnpm exec wrangler deploy --config <该绝对路径>` 可暂停应用连接为503、保留平台登录和安全授权；最终bundle Miniflare实测gateway503、平台me200/anonymous null、错误来源403，最终dry-run通过。勿回滚早期app-gateway bundle，否则会恢复旧发行缺口；SQL新增列不逆向删除。

本轮授权工程交付已完成。真实桌面popup硬件/外部OAuth登录没有新增实测；相关SDK分支有运行源码验证，当前小伴完整整页流程有真实线上证据。实际iOS/Android及用户扬声器听感仍未确认，原GW-10保持unverified，不能宣布整体用户验收通过。

retrospective_decision: updated-existing-owner。来源迁移、DO恢复与固定版本分发事实回写原SDK spec/部署文档；路由误报404通过原Pages/SEO owner修复并补回归。无需新增全局规则。Git最终同步与保护文件指纹在提交本证据后复核。
