# 应用标签页图标自动补齐

## 目标、来源与证据

用户 2026-10-03 指出许多应用没有标签页图标，要求检查 HTML 内已经存在但未按 favicon 协议配置的标识；随后明确「你搞吧，直接授权给你」。交付覆盖当前 `*.gemigo.app` R2 托管入口的新旧应用，部署后生效。仅识别页面已经提供的内容；无明确标识时用应用名称生成图标。

调查：7 个线上样本均未声明 favicon。qingshui 首页 `img[alt=logo]` 是实际可加载的 1080×1080 JPEG，跨源不允许 canvas CORS；app-129 导航 `.spider-logo svg` 的红色来自外部 CSS；3 个 React 页面原始 body 是空 root。缺失 `/favicon.ico` 被现有 SPA fallback 返回 HTML。截图作业只覆盖公开应用且已有封面时不启动浏览器，不能直接作为所有应用的图标 owner。

## 用户链路

用户打开已有或刚发布的应用：页面照常加载，缺图标时先有名称图标；页面渲染后自动选择可信 logo，标签页出现该应用自身的标识。存在有效 favicon 时保持其声明。应用重新部署或脚本渲染出 logo 后，识别以当前页面为输入，不沿用上一发布的 logo。无需配置或重新部署旧应用。

## 主方案与边界

选择 gateway 的 HTMLRewriter 加同源轻量浏览器脚本。候选是构建期提取、截图作业提取、页面运行期提取；运行期能直接取得 React DOM、CSS 颜色和真实图片解码结果，也不新增浏览器作业/数据库/客户产物状态。代价是每次页面访问会运行一个有界识别器，以及严格 CSP 页面不能执行补充脚本。

- gateway 保持 R2 客户对象原样；为缺 favicon 的 head 补同源名称 SVG，并在无 CSP 的 HTML 尾部加入 async 脚本，不等待它下载即可触发应用 DOMContentLoaded；识别 10 秒预算从页面就绪后的扫描启动计算。脚本端点明确返回 JavaScript；缺失 `/favicon.ico` 明确返回 SVG，绝不进入 SPA HTML fallback。真实根 favicon 优先当前发布，不借用上一发布文件。
- 有 CSP 响应头或 meta 时不注入脚本或改写 head，保持策略；未声明图标的页面仍可通过浏览器原有 `/favicon.ico` 请求取得同源默认图标。严格 CSP 下的智能提取作为已知兼容边界披露，不放宽客户策略。
- 运行期先验证作者声明的 icon、根 favicon，再检查非标准 favicon、touch icon、manifest 与有明确 logo/brand 语义的图片、SVG、单字/emoji 标识。实际解码确认可用，保留作者有效 icon；不把 favicon 标签缺失解释为 logo 缺失。
- 识别结合语义、导航/页头位置、尺寸及宽高比；排除操作按钮、装饰、大幅横版文字 logo、追踪像素。最多检查有限候选，MutationObserver 只等待 10 秒内的动态标识，选定后停止。没有可靠候选使用名称图标。
- 真实 React 作品集的导航 SVG 没有 logo 类名，但与 `PEIIII_OS` 文字同组。此分支使用应用 title 主段与直接父容器短文字的匹配，要求位于 nav/header/banner、父容器只有一个图形；旁边的 SYSTEM NORMAL / 时钟 / 网络图形不满足名称匹配，按钮仍排除。方案补充 Review 通过；不依赖 React 组件名或压缩后的 JS 名称。
- 内联 SVG 带 computed fill/stroke 等必要样式，移除执行内容与外部引用后转 PNG；图片或 CSS 背景 logo 在 canvas 可导出时转 PNG，否则复用已解码的原图 URL，不通过后端任意 URL 代理。对 qingshui 跨源 JPEG 必须验证 Chromium 实际取用 favicon，不以图片能显示替代验收。
- 所有生成链接使用标准 `rel=icon`；平台生成节点有独立标识，识别时忽略自身。不把临时失败永久记住，不持久化二次猜测状态；刷新自然重试。
- runtime 同源 URL 采用响应校验；HTML 的 hosting ETag 纳入图标逻辑版本，避免旧 304 跳过本次补齐。SVG 名称/URL 使用正确转义，base href 不改变平台资源定位。

owner 为 `workers/r2-gateway`；浏览器只负责当前文档的标识派生。保留既有发布 pointer/缓存/analytics owner，不扩展 SDK manifest 或 metadata 数据模型。新增文件局限 gateway 图标逻辑、定向测试与本设计/交付记录；项目无 planned-path preflight 或 diff-only maintainability 自动入口，按实际 diff 人工审查。

## 验收与实施顺序

flow=standard，task-type=feature，风险=L3/L4；design-document=required，plan=not-required（单次 gateway 发布，无数据迁移）。active-contract=smart-favicon-20261003，账本在对应 logs README。先完成真实跨源图标可行性实验，再实现 runtime/gateway，组装真实 Miniflare + Chromium 回归，定向 tsc/lint 与 diff-only review，部署 gateway 并验证真实样本，精确提交推送和本地 master 同步，复盘。

黄金链路：qingshui 当前 URL → 首页加载 → JPEG logo 变为浏览器实际 favicon；app-129 当前 URL → CSS 红蜘蛛正确转成 favicon；新部署动态 React 标识 → 10 秒内显示 → 重部署更换 logo → 刷新取得新标识。作者有效图标、多候选、坏声明、缺文件、CSP、base、跨源失败均须定向覆盖。

性能预算：不阻塞页面加载或用户操作，无服务端识别作业，无新增 R2 读发生在普通 HTML 热请求；识别等待总预算 10 秒、候选有界、观察回调节流；生成图标数据限制到 256px 和有限 SVG 元素。运行时间由实际浏览器测试记录，不宣称未实测的命中率或全浏览器兼容。

## 方案 Review

mode=design：核对用户目标和当前发布入口后通过。弃用截图队列作为图标 owner，避免漏私有应用/旧应用；不新增服务端图片代理，避免跨源 URL 获取进入生产凭据边界。关键风险为跨源图片能否被浏览器实际登记为 favicon、SVG 样式拷贝和 CSP，分别进入前置实验及回归验收。无待定产品选择。
