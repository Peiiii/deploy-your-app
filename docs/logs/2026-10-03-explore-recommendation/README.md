# 探索流推荐交付记录

[执行状态](../../work/2026-10-03-explore-recommendation/current-state.md) / [合同](../../work/2026-10-03-explore-recommendation/acceptance-contract.md) / [设计](../../designs/2026-10-03-personalized-explore.design.md)

## 原始输入与约束

2026-10-03 当前聊天，原件为用户消息，以下保留必要原话与用途：
- “jev”是候选线索；用户纠正“别直接当成一个我的要求”，要求搜索并自主评估。
- “成本允许的范围内，直接上你觉得最好的方案”，考虑 AI 开发效率，不交逐步残缺版本；保持低成本与口碑/体验。
- “现在 OpenAI 和那个 Cloudflare 都有相关的这个api”，用于比较供应商，不是必须全部上线。
- “比较解耦比较可插拔…失败了之后…留下一堆技术债”，只在视频流/探索局部实验，不全路径默认接入；本设计收敛为探索全屏应用流。
- 最后授权：“你来落地，就直接交付，结果不要不要半成品啊。”此次从方案进入完整开发与线上交付。
- 主项目已有明确全托管授权；主区其它任务WIP不归本任务。

## 过程记录

启动：读取 lifecycle/design/review/implementation 与大型交付/验收/记录方法；建立隔离worktree，迁入已核对设计。确认现有AI平台为DashScope，OpenAI网关也配置为DashScope，不能把网关名称当OpenAI凭据；Cloudflare OAuth包含AI write，BGE真实调用成功。设计中供应商均待比较，未声称某模型胜出。

## 交付汇总与复盘

工程、生产验收与实现Review完成；已上线20%局部实验。真实增长结论仍需后续用户数据，不以工程验收替代。

选型：当前公开Live目录实查546件，数量替代此前566快照，不是训练用户量。Cloudflare BGE-M3真实返回1024维，response无usage；BGE reranker真实返回usage。30场景同候选实测：向量基准hit@3=100%、MRR≈0.961，reranker≈93.3%、MRR≈0.923。主路径选择离线向量+代码兴趣匹配，保留局部bge对照可切换；普通请求没有外部模型等待。OpenAI无凭据、Jev402、DashScope及实际兼容网关401，均未计为质量失败。详情见model-benchmark.json。设计复审已按此证据更新，没有降低验收标准。

实现：新增独立推荐模块、附加D1表、流专属manager/UI；签发身份与状态绑定、DNT签名无存储分页、稳定批次、真实动作、权限再核对、原子预算与失败保留预留、总开关和运维报告已接通。真实Miniflare D1测试已通过身份/分页/隐私/对照/事件/负反馈/关闭/并发费用；当时生产与浏览器验收待发布后核验，最终结果见后文。

## 本地阶段验证与实现 Review（发布前记录）

- 真实Miniflare D1：推荐/对照分流、近期偏好/兴趣切换/负反馈/清除、签名身份/账号切换/退出隔离、DNT无行为与无批次存储、更新私密状态再筛选、分页直到89项终态无重复、重复初始化不吞掉目录、事件重试幂等、非法输入、并发原子预算、超时保留费用、未知usage不冒称实际费用；删除全部7个推荐表后原目录仍可使用。`pnpm test:recommendation`通过。
- 原目录206候选真实D1回归、加载/缓存回归通过；性能脚本只将schema预热置于实际用于计数的代理binding，避免首次建表计入暖请求SQL，不修改产品行为。
- 全项目tsc、触达TS/eslint、域名登记、前端build和Worker dry-run通过。已有Browserslist和大bundle提醒不属于此次失败。
- 当前源码完整Web浏览器：中文进入流→12项首批→打开可交互ColorLab iframe→退出预览→偏好清除/关闭保存→负反馈→连续翻页；固定公开目录本地fixture用于隔离数据，真实线上API/浏览器仍在发布后核验，不把fixture当上线证明。手机390×844控件无水平溢出。截图local-preferences.jpg。
- 关停演练：浏览器停在第6件作品，关闭局部总开关后≤30秒，滚动4220保持4220，当前作者保持一致，队列12改为16（保留前6项、后接原recent且去重），推荐控件和反馈消失。后台关闭无新AI已由真实D1测试确认。
- 30中英文固定候选质量比较通过；追加相同生产8-bit量化基准，hit@3仍100%、MRR≈0.961；6场反转候选输入重排top5全部一致。标注只评价描述相关性，不证明增长或实际可玩。

Review mode=implementation：独立从用户原话与R1–R10反查源码/diff及相邻认证、目录、React生命周期、费用、关停合同。项目无diff-only维护性入口，采用findings-first和条件主观复核。发现并关闭：账号/模式变化的旧游标、空页继续获取、未消费批次误去重、关闭响应旧队列残留、未知usage错误标成actual、匿名作者分散、输入null、nullable标签、账号重载iframe/header状态。修复后相关证据重验，当前无开放finding。新增局部数据/排序/model边界均有真实消费者；没有引入插件平台或多模型路由。生产性能与实际模型绑定作为发布完成门，未以本地网络数据替代。

## 运维与退出

凭据由生产RECOMMENDATION_SECRET与本地ignored .dev.vars拥有，不进仓库。运维工具只接受此模块动作；已有管理员session也可调用同一endpoint。

```sh
# 在已安全载入RECOMMENDATION_SECRET的环境中执行；不要把secret写进命令历史
pnpm recommendation:ops report
pnpm recommendation:ops disable
pnpm recommendation:ops enable 20
pnpm recommendation:ops ranker content
pnpm recommendation:ops ranker bge
pnpm recommendation:ops index
pnpm recommendation:ops cleanup
```

默认content仅离线索引/更新付AI费用；bge切换不改UI和画像，最多每身份每分钟2次/1.2秒等待。月AI硬预算$10；embedding未知usage计保守预留，重排已报告usage才有已知费用；二者不冒充供应商最终发票。索引最多32项/运维请求、16项/2分钟cron；最多1500公开候选，增长超过此规模需在同一owner调整有界检索策略。数据库和Worker费用另计，未升级或购买套餐。当前546目录每月cron约2360万行读量级（实际含清理扫描），按D1超额价格$0.001/百万行计是几美分量级；账号共享额度/其它业务不计为本模块免费承诺。来源：[D1价格](https://developers.cloudflare.com/d1/platform/pricing/)、[Workers价格](https://developers.cloudflare.com/workers/platform/pricing/)。

永久退出：先disable并确认所有浏览器队列已传播关闭、新索引/AI停止（在途调用已有预算责任仍保留）；按35天行为/90天调用记录约定导出必要聚合复盘。移除推荐目录、前端RecommendationFeed接入（恢复原ExploreFeed props）、两条局部routes、cron调用、env/AI绑定/secret及对应脚本/推荐隐私说明；独立逆向迁移DROP explore_rec_settings/features/batches/events/budget/calls/rate，不改projects、auth、engagement、发布链路。删除演练已在真实D1通过；生产此次只部署/启用，不实际删除实验。

复盘判断：当前关键事实和选型已回到此设计/日志owner；通用流程已覆盖，没有需要新增的共享规则。retrospective_decision=no-increment（不将一次实现边界错误升级为全局规则）。发布后仍需复核完成门，当前不能宣称真实用户收益。

生产首次速度门未通过：20次zh/en真实兴趣请求，Worker p95约5.34s，包含客户端传输p95约6.56s（production-performance-before.json），不能报为完成。返回实现修正数据库串行往返、候选加载重字段、跨请求公共向量缓存与重复解码；交付保持percent=0。索引全部546件已实调成功，19次调用含cron，保守预留2252microUSD（$0.002252），embedding无usage，不能称供应商最终账单。新增索引领取时数据库再次核对已完成版本，以避免其它isolate旧缓存重复收费，真实D1回归已通过。


## 最终生产结果（2026-10-03）

- 生产D1现有主区APAC/NRT，并非本次迁库。API配置placement.region=aws:ap-northeast-1后减少跨区域多轮SQL；没有新增数据库/微服务或购买套餐。最终API版本bbd675ab-4793-4ce1-b7cf-b160ec1c723b，代码提交3736691；Web包含780fb87手机反馈布局修正与340e6de亮色封面上的偏好按钮对比度修正，产物index-DgnKTc_a.js / index-B0quAaXB.css。最终发布/远程Git状态由现场fetch、ls-remote与主区工作树同步核对。
- 选中content主路径：32次真实Chrome请求（20次初始优化后、12次最终API，zh/en交替、真实MathBoard兴趣，同公开目录），Worker p95=213ms，包含浏览器网络的p95=1708.6ms。完整样本有一次2256.8ms网络尾延迟，没有删除异常点。新连接curl独立保留，不能把TLS/代理传输当Worker处理时间。production-performance.json / production-performance-targeted-curl.json；首次失败基线保留production-performance-before.json。
- 可选bge已在生产AI binding实调成功，超时和预算耗尽均返回有效公开作品；单模型900ms窗口不足以约束冷目录准备，最终从请求起共享700ms排序截止时间，超时仍保留预留责任。该候选真实网络端到端p95未达1.8s，且30场景质量没有优势，因此**不选为生产默认**，只保留手动运维比较能力，不自动启用/推广。失败样本全部在production-model-branches.json，没有以主路径通过掩盖候选失败。用户没有指定模型，R5/R6交付的是经比较选中的主路径；不是将此候选承诺为可推广方案。
- 首批公开作品索引546件；最后报告已建立548条向量记录，新增作品/版本变化由后台续建，累计25次index调用。生产全部索引/线上比较累计预算责任2802microUSD=$0.002802；已知重排usage费用195microUSD=$0.000195，其余为未知usage与超时保守责任，不能当最终发票。月AI预算$10独立原子预留；Worker/D1等原有基础设施费用另算，未把免费额度算成成本承诺。production-report.json保留当前配置/用量/insufficient-sample。
- 手机真实入口进入流12项、手动推荐、打开ColorLab并实际点黄光交互、退出、负反馈、清除偏好、关闭历史保存、12→24→36→40分页通过。Education+zh生产对照16项和推荐13项分别分页到hasMore=false，批次无重复；数量不同来自实际已曝光去重。浏览器记录production-ui.json。关闭保存后localStorage无推荐token，后续页persistent=false；登录/切换账号/收藏状态合同由真实D1边界验证，未使用生产真人账号做写入。
- 生产关停：当前第6件MathBoard、作者创作者WBR5MZ、滚动4220均保持；队列40→17，控件/负反馈消失，后续原recent去重。后台index返回disabled，调用和预算与关闭前一致。production-disabled.json；完整移除7表与原目录可用演练在真实本地D1通过，未在生产删表。
- 新Web真实手机390×844与桌面1280×800可加载；普通目录和/api/v1/me返回既有合同，未混入推荐数据。手机截图复核发现负反馈挡作者，已移到右下角；偏好入口增加深色背景，亮色封面仍可读，反馈说明进入信息区正常文档流；关闭预览使用既有中英文close翻译，避免露出common.exit键。
- 当前配置enabled=1,percent=20,ranker=content,experiment=explore-v1。仅探索全屏流20%默认推荐，对照80%原recent；所有人可选试用推荐/最近发布，首页/网格/搜索保持原目录。真实入口：https://gemigo.io/explore?lang=zh-CN → 视频流模式 → 试用推荐；匿名可试，原点赞/收藏需要登录。

最终Review mode=implementation：按原话、R1–R10与本任务提交（排除合并来的其它任务）复核身份/权限再筛、模型费用责任、稳定分页、默认分流、关停队列、配置恢复和手机布局；性能返工与截图finding已关闭。无新增可维护性检查入口，使用项目约定findings-first；当前no findings。选型失败候选、网络极端等待、真实增长样本不足均已明确，不冒充用户验收通过。

复盘最终判断：retrospective_decision=no-increment；本次事实、选型和生产证据均在既有设计/日志owner更新，无共享开发规则增量。已交付可用入口，待用户确认体验；不存在已授权且可继续关闭的工程缺口。主观推荐效果及因果增长不属于可伪造的当日工程证明。

最终并发复核补充：事件在读批次与实际写入之间可能遇到reset。写入改为INSERT SELECT WHERE EXISTS当前有效且归属正确的批次，D1语句原子判定；accepted返回实际changes。真实D1代理仅控制调度顺序、数据与SQL均真实，用reset落在lookup后/write前的边界验证旧事件不能恢复已清除画像。该finding已由适用tsc/lint、完整真实D1定向测试及生产HTTP协议冒烟关闭；已部署3736691 / API bbd675ab-4793-4ce1-b7cf-b160ec1c723b。生产新匿名测试身份首写1、重试0、清除成功、旧批次晚到0，测试后清除自身画像，未当真人事件或增长样本。最终Review再次通过，原主路径性能证据仍有效（只改变事件写入）。

修后页面证据production-final-ui.json：手机作者右边界320.3、负反馈左边界338，不相交；桌面也不相交，均无水平溢出。最新Web实际加载index-DgnKTc_a.js，偏好入口真实computed background=rgba(0,0,0,0.6)、display=inline-block。production-mobile-before.jpg是修前截图，最终截图工具未返回，未把旧截图当修后证据；真实用户黄金交互、页面快照与布局几何已完成。
