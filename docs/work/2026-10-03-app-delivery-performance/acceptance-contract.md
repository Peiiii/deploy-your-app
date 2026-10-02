# 应用托管性能交付合同

- contract-id: app-delivery-performance-20261003
- parent-goal: 全部用户上传应用通过统一托管优化上线，验证加载收益、发布正确性与成本，实测驱动收敛。
- scope-revision: 1；用户明确委托，技术门槛为授权内 AI 决定，依据现有测量。
- 来源：../../logs/2026-10-03-app-delivery-performance/README.md；设计：../../designs/2026-10-03-app-delivery-performance.design.md。

## 有效标准
- AP-01：普通 HTML/资源统一边缘缓存；相同 app/release 热请求不读 R2；缓存错误可回源，租户与私有路径正确隔离，SPA/previous asset/thumbnail 不退化。
- AP-02：GET/HEAD ETag 校验（weak/list/*）304 无 body；HEAD 无 body；新发布/回滚 ≤5秒、legacy 原地更新 ≤10秒（在线测量容差2秒）；公共任意文件名可更新。
- AP-03：上线后同 40 个 HTTP 样本三次访问、并发4、直连固定可达 IP；有效200的第二次连接复用 TTFB 中位数较历史 .591s 改善至少30%，线上热 gateway 中位数 ≤100ms（之前约316ms）。同6浏览器样本冷/热FCP完整报告，超时不得排除后宣称全体更快。未达门槛继续沿瓶颈迭代；网络与第三方资源需独立归因。
- AP-04：不新增固定付费服务、每次热请求 R2读取从2降至0；冷缓存最多原有2次（fallback按原逻辑），新增开销仅既有 Worker Cache API 操作与少量CPU；R2 bytes/发布产物不变。
- AP-05：适用类型检查、lint、真实部署与 thumbnail 回归、wrangler dry-run、完整 implementation review 通过；只提交任务文件，推送 master，gateway线上生效并独立 QA 验证更新/回滚/304/HEAD/压缩。

架构不变量：发布 pointer 是版本 owner；R2 文件不改写；gateway 是公共缓存策略 owner。真实边界：用户明确暂缓直连不可达；不能用可达IP结果宣称解决国内连通性。

## Active ledger
| ID | Required | Status | 当前证据 | 失效原因 |
|---|---|---|---|---|
| AP-01 | true | passed | 本地核心缓存测试+真实Miniflare；线上QA hit/private/SPA/previous与thumbnail回归；详细证据见日志 | — |
| AP-02 | true | passed | 线上QA JS ETag/HTML*304与HEAD，发布2.567s、回滚3.265s、legacy10.890s含2秒容差；详细证据见日志 | — |
| AP-03 | true | passed | evidence/summary.json：二次TTFB中位 .580→.248，gateway13ms；6浏览器完整cold/warm结果；详细证据见日志 | — |
| AP-04 | true | passed | 2→0读取断言；原服务bindings不变；platform镜像408350bytes与官方边际计价；详细证据见日志 | — |
| AP-05 | true | passed | strict tsc、lint、4行为测试、dry-run、review passed；master推送/线上gateway与QA证据；最后小修上线待收尾核对；详细证据见日志 | — |

单阶段，当前门：实现统一托管策略→行为测试→对比实测→按最大缺口迭代→生产 QA→Review/交付/复盘。open-required: AP-01..05。parent_status: in-progress。无待决范围变化。

契约 review: passed。删除“全球所有网络打开”“第三方脚本无任何失败”“重新构建所有客户应用”等噪声标准，前者被用户暂缓，后两者不是获批托管方案可保证的结果；第三方瓶颈仍属于实测与优化判断，不隐藏超时。

## 授权内设计学习
第一轮浏览器暴露共性Tailwind根CDN超时，增加AP-06（Required:true，Status:not-run）：同字节固定3.4.17平台镜像，准确重写无query根URL；保留显式版本/插件/CSP/credentials，客户R2源字节不变。再次6浏览器样本无Tailwind首屏18秒超时，并报告完整FCP。此项对应原目标的实测不满意继续优化，未减少原标准；AP-01..05相关证据在代码变更后需要重验。

线上学习：Cloudflare自动HTML beacon等变换会移除HTML ETag（39样本仅2保留），服务器仍正确支持conditional匹配与*；JS/CSS镜像ETag正常。继续保留已有Web Analytics和压缩，不以关闭统计换取header。浏览器HTML并非全部能获得ETag，完整响应仍可用边缘缓存加速；在线bodyless304已由JS精确ETag和HTML*验证。

## AP-06 evidence update
- Required:true；Status:passed；同原字节镜像线上hash/gzip/ETag；真实HTMLRewriter source/CSP/plugin/version/credentials/SRI属性不变；最终6/6浏览器无timeout，green5.188s/portfolio3.840s首屏；见日志evidence/browser-final.json。
- AP-04授权内增量：客户发布产物不变，平台额外408350bytes；请求/CPU有边际计费，不是新固定服务。
- AP-02已验证conditional server合同；Cloudflare HTML变换移除部分browser ETag的边界已显式记录，不宣称每个HTML浏览器自动304。
