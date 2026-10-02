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
