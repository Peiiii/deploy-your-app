# 静态产物发布与闲鱼独占 VPS

日期：2026-10-07；flow=standard；risk=L4；design-document=required；plan=required。

## 用户目标与现有事实

用户要求停止 GemiGo 的低频 VPS 源码构建能力，只部署产物，复用 Docker-fupf（47.236.251.192）专门运行闲鱼。随后明确：其它原有可用输入输出保留，入口和操作体验最小变化，不让用户重新学习或配置。

当前 HTML、静态 ZIP、GitHub 全经 deployController → Node publisher；HTML/无 build 脚本的静态包虽不执行命令，上传 R2、返回状态、内容分析仍经 Node。删除应用也依赖 Node 清理。网站访问、账号、项目、AI/云存储 API 在 Cloudflare。生产默认 R2，现有 releases/<deploymentId> 与 deployment.json 指针保证先上传后切换。新发布由 AppGateway 每项目串行，D1 deployment_attempts 是发布结果 owner。

## 用户链路与兼容范围

原 /deploy 的 HTML、ZIP、GitHub 三入口继续存在。HTML粘贴/上传、静态ZIP（含单层外包目录）、GitHub静态仓库原样输入，仍获得同一 slug.gemigo.app 地址、发布日志和成功/失败反馈；CLI/扩展/桌面仍用原 API。更新时完整新版本上传成功才切指针；失败保留旧网站。刷新/关页不终止任务，设置页仍读取结果。删除仍从原设置页执行并清理项目文件。已有网站、鉴权、云存储、AI网关、缩略图、分析与推荐不改。

唯一能力收缩：不运行 npm/pnpm/yarn/bun 安装和 build。不一刀切关闭 GitHub/ZIP；源码含现成 dist/build/out 时自动使用产物。确实只有需编译源码且无可用产物时，原错误反馈提示上传构建目录 ZIP。元数据仍自动补齐，只从已准备内容取上下文，保留用户编辑字段。

失败尝试与已发布应用分别表达：已有成功 URL/lastSuccessAt 的应用更新失败后保持 Live 和原成功时间，最近发布结果仍显示 failed。否则原 AppGateway 的 Live 门会连带禁用仍在服务的旧版 API，违反本次保留其它可用路径的要求；首次发布失败仍为 Failed，不制造成功记录。

## 采用的主链路

继续复用 AppGateway 的项目串行与 Durable Object storage/alarm，不增加另一个队列或公开入口。部署请求鉴权/去重/D1记录后，将任务保存在该对象；alarm 分批执行准备、文件上传、指针切换与状态收尾。任务凭据不保存客户端Cookie。DO重启从保存阶段/游标重入，同一项目新任务排队，删除与发布共享串行门。SSE按原事件格式读取 D1/持久进度；reconcile 原路径保留，停止向 builder 发请求。

HTML直接形成 index.html；ZIP使用 zip.js 的范围 Reader 从现有 ASSETS 临时源逐条流式解压，避免75MiB压缩包和500MiB展开内容同时驻留128MiB Worker。支持普通ZIP编码/存储/Deflate/目录包装，CRC与路径校验；保留75MiB输入、500MiB展开、10,000文件上限。不公开.env/.npmrc/.git/node_modules，拒绝路径越界/链接/重复条目/加密损坏包。GitHub公开仓库按既有默认/指定分支读取codeload ZIP并存入原临时源前缀，禁止任意URL或执行仓库脚本。

发布状态唯一归D1，DO仅拥有工作游标；R2持有源与manifest及不可变产物，原pointer协议/网关不改。准备结果提取上下文复用原元数据策略。现有可观察静态JS的GenAI规则改写提取纯函数供Node与Worker共享；不重新设计代理能力。R2存储清理复用原release保留规则，移动生产owner至Worker，删除前清理完成，失败保留待清理标记并重试。

分批上限控制CPU和子请求；每批保存游标与下次alarm，上传可幂等覆盖本任务release，任务失效/删除不再激活。指针写入不确定时读取确认，已切换后不可清理正在服务的产物。状态收尾失败由alarm重试，不将已上线发布报告失败。旧D1终态直接可读；上线前把旧builder待执行数量清空，已终态和旧网站不迁移。现有75MiB等上限必须在真实workerd环境取证，不能仅用Node模拟通过。

## 取舍与排除方案

只关闭Node构建分支仍依赖VPS上传/清理，不满足目标。浏览器解压直传会改变客户端协议、CLI/扩展兼容与关页恢复，不采用。新建通用调度框架无消费者收益；复用当前DO是最窄owner。仅新增当前需要的归档/静态发布与R2清理模块，不改前端布局；只补源码错误的中英文文案。

## 交付与机器迁移

先验证/Review并发布Worker，再在旧builder停止期间验证HTML/ZIP/GitHub静态、更新/失败保留、SSE/reconcile/元数据/删除、原站访问和原API合同。停用原GitHub Actions的VPS生产自动部署，保留隔离构建校验/手工开发工具，防止占回专用机器。保留旧容器和持久目录作可恢复备份，不删除用户数据、不释放实例、不续费。

闲鱼沿已有单活SOP：准备目标独立/opt/xianyu-auto-dev、Docker app/tunnel和私有认证；源8.219.57.52空闲后停本项目app/tunnel，导出最新一致性快照，迁移权益/订单/凭证/产物/原隧道，目标启动后核健康、真实Codex/Chromium/ZIP、已有链接不变。失败先停目标再恢复最新源；不改源上的NextClaw/代理，不启动Mac。目标必须只有闲鱼业务。更新闲鱼项目运维事实与heartbeat。Agiso会话失效/无测试买家继续作为已知实单边界，不制造付款。

## 验证与 Design Review

详见活跃合同。设计审查：核对旧入口/数据→新链路、关页恢复、任务并发/删除、指针失败/已激活重试、流式内存/CRC、静态GitHub与ZIP和共享改写的覆盖；无未关闭finding，design-review=passed。生产密钥/私有订单不进入Git或日志。

上游依据：[R2范围读取](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[流式内存](https://developers.cloudflare.com/workers/runtime-apis/streams/)、[zip.js范围Reader](https://gildas-lormeau.github.io/zip.js/api/classes/ZipReader.html)。
