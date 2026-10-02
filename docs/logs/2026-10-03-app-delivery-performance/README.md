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
