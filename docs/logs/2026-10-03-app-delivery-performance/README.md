# 原始输入与约束

2026-10-03 会话：用户先要求检查 geeglo.gemigo.app 及其它应用慢、无法打开；随后明确「暂时忽略这个问题」，转为测量平均加载速度和优化空间。关注成本是否暴增，补充「应用都是用户上传的，并不是我们自己生产的。当然理论上也可以二次修改」。最后明确「按你的方案统一优化上线」「看它的结果怎么样」「没达到满意的预期也可以继续优化」。

有效选择：按之前讨论的缓存、304、压缩检查及发布一致性托管方案执行。现有 Cloudflare/R2，不新购服务，不主动改客户源码。上线与 exact commit/push 已由用户及 AGENTS.md 授权。全量目标是所有经 gateway 托管的客户应用，不将单个测试站上线等同交付。

基线：40 个随机 Live 公共目录样本（seed 20261002，264 个取得的目录项），39 正常、www 保留子域 404。历史首次 HTML TTFB 平均 2.765s、二次连接复用 .718s；不是全部用户平均。6 个浏览器样本，冷启动 5 个有效 FCP 平均4.203s，portfolio 首轮第三方 Tailwind timeout 被单列。固定可达 IP104.21.14.73，排除用户已暂缓的连通性故障，无带宽限制。详细原始基线在此前会话可视化目录 gemigo-app-speed/baseline.json；本次发布前复测与上线结果在本目录记录。

## 上线前验证与 implementation review
- gateway strict 定向 tsc：passed；定向 ESLint 3文件、diff --check：passed。
- test-app-delivery-cache / test-thumbnail-performance / test-deployment-runtime：passed。
- wrangler deploy --dry-run：passed，gzip5.62KiB；只包含原有ASSETS和3个vars。
- diff-only maintainability：项目无自动入口，人工审查 gateway diff 与发布 pointer、缩略图、analytics 相邻合同。新函数分别拥有缓存I/O、manifest解析、object读取和conditional matching，没有第二发布owner或source rewrite。
- mode=implementation：no findings；审查 GET/HEAD 条件顺序、缓存错误、legacy TTL、缓存 key tenant/release/query 隔离、negative缓存与fallback。残余风险仅线上 Cache API/压缩/ETag变换与网络，交生产验收关闭。

## 第二轮实现与发布前验证
- 真实直连Tailwind根CDN curl SSL timeout，浏览器两个pending均为同域。上游通过已配置代理取得，根URL302到3.4.17；SHA256 176e894661aa9cdc9a5cba6c720044cbbf7b8bd80d1c9a142a7c24b1b6c50d15，407279bytes；MIT全文1071bytes另存固定平台key。
- 发布脚本先验证所有下载hash，再写2个platform/runtime对象；未触及任何客户对象。资源先于Worker重写发布。
- 第二轮strict tsc、定向lint、4个行为/发布/thumbnail/真实Miniflare HTMLRewriter测试均passed；dry-run gzip6.47KiB。
- implementation review / diff-only maintainability：no findings。按内容hash镜像和delivery弱ETag避免旧200/304混用；检查CSP、版本/plugin、credentials、原attrs、真实原R2不变、CORS与共享缓存；验证脚本credential仅发原R2 endpoint。
- 完整回退：原Worker版本5c3939b8-7f61-422f-b6cb-a1af7c0023b6；仅回退runtime重写可用第一轮3c125788-931a-48a1-a36d-1951e9a902f2。平台镜像是独立静态文件，rollback无需修改客户发布。

## 最终实测（2026-10-03）
有效样本39/40（www保留域404单列），每应用3次请求、并发4；curl直连IPv4固定104.21.14.73，无带宽限制，后两次复用连接，**不是浏览器缓存**。第一次连接的边缘冷热状态可变，最终2条已命中，不能把首个curl统称全局冷缓存。

| 指标 | 发布前复测 | 最终 |
|---|---:|---:|
| 第一次TTFB 平均 / 中位 / p90 | 2.047 / 1.995 / 3.670s | 2.128 / 1.955 / 3.504s |
| 第二次TTFB 平均 / 中位 / p90 | .728 / .580 / 1.147s | .337 / .248 / .534s |
| 第三次TTFB 平均 / 中位 / p90 | .642 / .574 / .999s | .337 / .249 / .613s |
| 第二次HTML完整下载 平均 / 中位 | 1.199 / 1.082s | .746 / .548s |
| gateway响应头阶段 中位 | 原浏览器约316ms | 第二次13ms；第三次11ms |

第二次TTFB中位改善57.2%，平均改善53.8%；冷回源本身没有明显收益，首个连接平均也未改善，不能宣称所有首访全面减半。此时普通GET/HEAD被最后一次小修（runtime no-store遵循同一缓存策略）保持原样，因此正常路径实测可沿用；不同请求头分支由Miniflare和部署后curl补验。

浏览器：隔离Chrome headless、1365×900、无代理、固定同IP、禁QUIC、每应用独立context，cold/warm各一次，load最多18秒+1秒观测。不是实际全量用户RUM。第一轮缓存后green-men-gaze和portfolio cold均18秒timeout且FCP缺失，pending为Tailwind根CDN。第二轮6/6全部加载、无失败请求，FCP平均cold3.302s、warm1.047s，最大5.188s。历史5个有效cold均值4.203s另有portfolio timeout，不能用缺失样本当0秒参与改善比例。历史warm6均值1.703s。

| 应用 | 最终cold FCP | 最终warm FCP |
|---|---:|---:|
| qingshui | 1.152s | 1.240s |
| 2-0 | 4.096s | .436s |
| app-129 | 1.476s | 1.000s |
| green-men-gaze | 5.188s | 1.992s |
| peiiii-os-portfolio | 3.840s | .780s |
| voxel-world-builder | 4.060s | .832s |

额外验证用户原入口geeglo：cold FCP4.252s、warm1.104s，cold load5.517s，无失败请求。未解决用户已暂缓的CF部分IP不可达；固定可达IP测量不能代表所有国内网络。其它外部字体/iframe/重JS仍各依用户产物情况，未冒称统一源码优化。

## 生产生命周期与资源证据
最终第二轮Worker版本 e36b8ad9-cf41-44b6-b838-d8dca8121523，覆盖*.gemigo.app/*；后续仅runtime no-store分支补验版本见收尾。独立QA slug qa-cache-681258b0：热HTML hit，准确JS ETag304/HTML*304/HEAD/SPA/previous asset/私有404；发布新版本2.567s可见、rollback3.265s、legacy更新10.890s（含客户端新连接/轮询，符合预先2秒容差）。所有本任务QA对象删除，prefix list为0；客户对象未改。

镜像线上GET：gzip、CORS*、immutable、CF/cache HIT；解压后SHA256与上游一致。运行时script存在，green/portfolio样式表分别2/3个，没有Tailwind pending。平台source manifest与发布工具在仓库可重放，LICENSE另存并可访问。原始精简测量在 [evidence](evidence/)；请求头只保留缓存、类型、etag、timing，不保存凭据。

## 成本与收敛
不新增服务或固定月费。普通热请求仍调用Worker，但R2读2→0；pointer/body TTL为短暂与按版本组合。镜像+LICENSE新增408350bytes，R2标准存储未计免费额度的毛估算约$0.0000061/月；R2出口免费。默认Tailwind的首次/过期浏览器镜像加载会增加Worker请求，超Paid计划额度的请求单价$0.30/百万，另计实际CPU；不能声称Cache API绕过Worker收费或账单零增长。CPU与整账户共享额度未做账单实测，不凭响应wall time推算CPU。计价来源：[Workers](https://developers.cloudflare.com/workers/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing/)。

第二次响应改善超过30%、hot gateway小于100ms、Tailwind6样本无首屏timeout，达到实现前定义的门槛；继续改用户任意JS或镜像动态字体会引入不同兼容范围，当前证据没有必要追加这类改写。保留首访网络与自有重资源的真实边界。

## 复盘
retrospective_decision: updated-existing-owner。原architecture网关与访问流程回写已验证缓存owner、freshness、delivery mirror和HTML ETag边界，指向源码manifest与本记录；不新建流程Skill/规则。可复用事实：不能由任意上传文件名猜immutable；不能用header阶段加速声称首屏同等改善；Cloudflare beacon等可能移除HTML ETag，保留统计并如实说明。具体数据仅作为本环境历史记录，不升级为全局SLO。retrospective_state: completed；parent_status: ready-for-completion-check（待最后版本入口与Git核对）。
