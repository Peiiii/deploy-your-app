# 用户应用托管性能优化

## 目标与事实
用户授权统一优化、上线并按结果继续迭代。应用由用户上传，不改其源码；用户已暂缓无代理网络不可达问题。原始约束见 ../logs/2026-10-03-app-delivery-performance/README.md。

当前每请求串行读取 deployment.json 和文件；已有版本发布目录不可变，current 为存量可变目录。HTML no-cache 但未执行条件请求；普通文件名也缓存一年。Cloudflare 已压缩，无需 Worker 实时压缩。

## 冻结方案
唯一对外缓存策略 owner 为 R2 gateway；复用已有 R2 和 Cache API，不新增付费服务或改发布数据格式。
1. 发布指针（包括缺指针时 current 的解析结果）边缘缓存 5 秒，校验 tenant/prefix 后才写入。损坏指针返回 503，不缓存错误。缓存读取异常回源，后台写异常记录而不破坏响应。
2. 文件缓存以 origin + 内部命名空间 + 完整 R2 key 隔离 tenant 和 release；忽略查询参数，因为同一 R2 object 不因查询变化。只缓存成功完整文件；releases 缓存 1 天，current 缓存 5 秒。不缓存不存在文件，不将 SPA alias 写成文件缓存；仍复用 index.html 缓存。新发布/回滚最多 5 秒生效，legacy 原地更新最多 10 秒（指针与文件 TTL 叠加）。
3. 客户可任意命名文件，不能从文件名猜测内容不可变。普通公共 URL 一律 no-cache + R2 ETag：每次校验，匹配（包括 weak/list/*）返回无 body 304。GET/HEAD 共享完整文件缓存，HEAD 不返回 body；其它 method 保持现有读静态行为且不做缓存/304。主动 Cache-Control:no-cache 或 no-store 绕过边缘读取，no-store 不写缓存。
4. 发布指针决定版本后再匹配 ETag，避免旧内容 304。私有路径拒绝仍在所有缓存前；旧版本静态资源 fallback、SPA、缩略图与 pageview 保持现有消费者语义。内部 cache key 不能从外部路径直接命中。
5. 返回缓存诊断与 gateway Server-Timing，复测相同 40 个 HTTP 样本和 6 个浏览器样本。已有压缩继续依赖 Cloudflare。客户第三方资源慢时保留实测证据，不能把 gateway 加速写成所有应用首屏同等加速。

## 替代方案
每次读 pointer 再缓存文件能保留立即可见性，但仍有约 150–300ms 回源等待；已选有界 5 秒指针缓存。全 CDN/国内迁移涉及用户暂缓的连通性问题与额外成本，当前不采用。自动改写 HTML/第三方 JS 有用户代码兼容风险，当前按获批托管方案完成后由真实瓶颈判断收益。

## 验证与发布
见唯一 active contract。本地行为测试覆盖发布切换/rollback/legacy 原地更新、304/HEAD/tenant/private/SPA/previous assets、缓存故障和 no-store；回归真实发布测试、缩略图。gateway 单独类型检查、定向 lint、wrangler dry-run、diff-only review。只部署 gateway。独立 QA slug 在 R2 写自有 fixtures，在线验证 lifecycle 后删除；不写客户对象。

## Design review
mode=design，2026-10-03：no findings，design-review: passed。用户原始目标→托管统一覆盖存量 current 与 releases→真实 40/6 样本和独立在线发布场景均已映射。修正主要反例：不能按文件名猜 immutable；legacy 双 TTL 10 秒；负指针缓存必须在首个发布后有界失效；没有 Cache API 全球刷新承诺。未新增流程审批，授权来源为当前用户消息与 AGENTS.md。
