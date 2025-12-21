# Extension SDK v1（浏览器插件场景）设计文档

本文档面向“浏览器侧边栏运行第三方 App（iframe）”场景，定义统一 `@gemigo/app-sdk`（原 `@gemigo/extension-sdk`）在 extension 环境下的 v1 最小闭环能力、权限边界与实现拆分，目标是让上层应用能稳定构建“划词翻译/总结、阅读模式、网页标注”等高频用例，同时确保可维护、可扩展、可控风险。

---

## 1. 目标（产品视角）

### 1.1 v1 北极星：让 App 在网页上“做事”

v1 需要让第三方 App 在不直接接触 `chrome.*` 的前提下，完成三类核心用户价值：

1. **读**：读网页信息（URL、标题、选中内容、正文/链接/图片）
2. **写**：以“可逆、可撤销”的方式在页面上做轻量呈现（高亮、浮层、注入 CSS）
3. **联**：能调用外部服务（AI/翻译/业务 API）且不被 CORS 卡死，并能持久化偏好/历史

### 1.2 v1 要避免的坑

- **安全/信任崩塌**：扩展拥有 `<all_urls>`、写页面能力，如果没有权限/授权/审计，用户无法信任。
- **开发体验割裂**：types/docs/实现不一致，上层开发者会踩坑，难以规模化生态。
- **可维护性差**：功能散落在 host/content-script/service-worker，缺少统一协议和能力治理。

---

## 2. 非目标（v1 不做）

- 跨浏览器（Firefox/Safari）兼容
- 复杂自动化（类似 RPA：点击、输入、流程编排）
- 强隐私模式（端侧加密/零知识）与企业合规审计
- App 市场的分发、收费、签名校验（可留接口但不强依赖）

---

## 3. 核心架构（统一视角）

### 3.1 组件职责

- **App（iframe）**：第三方应用，运行在 `sidepanel` iframe 中
- **SDK（App 内）**：`@gemigo/app-sdk`（原 `@gemigo/extension-sdk`），提供 `gemigo.*` API，对上层隐藏通信细节
- **Host（Side Panel）**：React 容器，负责 App 运行时、权限校验、与扩展能力对接
- **Service Worker（MV3）**：长生命周期协调者，负责 `chrome.tabs/scripting` 等能力调用
- **Content Script（页面注入）**：与真实网页 DOM 交互（读写页面、监听 selection 等）

### 3.2 通信通道

当前实现基于 `penpal`：
- App iframe ⇄ Host（sidepanel）通过 `postMessage` 建立 RPC
- Host ⇄ Service Worker 用 `chrome.runtime.sendMessage`
- Service Worker ⇄ Content Script 用 `chrome.tabs.sendMessage`

建议 v1 固化一套“HostMethods/协议版本”，避免各模块随意拼接消息类型。

---

## 4. v1 能力清单（MVP 闭环）

v1 推荐“5 类能力”闭环：**Read / Events / UI Overlay / Storage / Network**。

### 4.1 Read（读取网页）

必须：
- `extension.getPageInfo()`
- `extension.getSelection()`
- `extension.getPageText()`（或 `extractArticle()` 二选一至少一个稳定）

应有：
- `extension.getPageHTML()`（注意跨域 iframe 不可读）
- `extension.extractArticle()`
- `extension.queryElement(selector, limit?)`
- `extension.extractLinks()` / `extension.extractImages()`

产品理由：覆盖“翻译/总结/阅读模式/内容提取”的核心输入。

### 4.2 Events（触发入口）

必须：
- `extension.onContextMenu(handler)` + `extension.getContextMenuEvent()`
- `extension.onSelectionChange(handler)`

应有（v1.1）：
- `extension.onNavigate(handler)`
- `extension.onScroll(handler)`

产品理由：让 App “在正确时机出现”，减少用户操作成本。

### 4.3 UI Overlay（网页内可逆呈现）

必须（以可撤销为准则）：
- `extension.highlight(selector, color?) -> { highlightId }` + `removeHighlight(highlightId)`
- `extension.insertWidget(html, position) -> { widgetId }` + `updateWidget/removeWidget`
- `extension.injectCSS(css) -> { styleId }` + `removeCSS(styleId)`

产品理由：上层“翻译气泡/正文阅读模式/高亮标注”都需要最低成本的 UI 注入。

### 4.4 Storage（持久化）

必须：
- `storage.get(key)` / `storage.set(key, value)` / `storage.delete(key)` / `storage.clear()`

约束：
- **按 App 隔离命名空间**（以 `appId` 作为前缀或独立 storage area）
- 支持容量提示/失败原因（Chrome 配额/序列化失败）

产品理由：没有持久化就没有习惯与留存（偏好、历史、词库）。

### 4.5 Network（跨域代理）

必须：
- `network.request(url, options)`（宿主代理请求，绕过 CORS）

约束（v1 必须做安全边界）：
- 默认**拒绝**跨域请求，除非 App manifest 显式声明允许的域名白名单
- 请求/响应需要大小限制与超时
- 禁止携带用户浏览器 cookie（除非明确设计并授权）

产品理由：上层常需要调用 AI/翻译/业务 API；“可控的跨域能力”是平台关键。

---

## 5. 权限模型（v1 必须落地）

### 5.1 权限声明：App Manifest

每个 App 必须携带 manifest（可以由平台生成/托管），至少包含：
- `id` / `name` / `version`
- `permissions`：如 `extension.modify`、`extension.capture`、`network`、`storage`
- `network.allowlist`：允许访问的域名列表（或 pattern）

### 5.2 授权策略：首次使用弹窗 + 可撤销

建议把权限授权拆成两层：
- **安装时**：只展示“能力概览”
- **首次使用敏感能力时**：弹窗确认（写页面、截图、跨域网络）

Host 需要维护：
- `appId -> grantedPermissions`（本地持久化）
- 撤销入口（设置页）

### 5.3 最小特权原则

- `extension.modify` 不应默认授予
- `network` 默认拒绝跨域；必须白名单
- `capture` 属于高风险；需要明确授权与提示

---

## 6. 与现状的差距（gap）

### 6.1 types/docs/实现不一致（必须收敛）

当前 `packages/extension-sdk/src/types/extension.ts` 描述了许多 API（`captureFull/registerShortcut/onNavigate/onScroll/onSelectionAction` 等），但 `packages/extension-sdk/src/apis/extension.ts` 实现不完整，且返回类型也不同。

v1 需要做到：
- **以实现为准**修订 types/docs，或
- **以 types 为准**补齐实现（优先补 v1 需要的）

### 6.2 缺少 storage/network

现有 SDK 实际只实现了 `notify` + `extension.*` 的一部分。
要满足真实 App，需要把 `storage` 与 `network` 接进来并完成权限治理。

### 6.3 Host 未落地“按 App 权限校验”

目前 host 基本是“直接转发”，缺少 manifest 校验与授权弹窗。
v1 必须补齐，否则无法对外分发。

---

## 7. 实现方案（拆分与里程碑）

### 7.1 Step 0：收敛协议与版本

- 定义 `HostMethodsV1`（一份 TS interface），作为 App 通过 penpal 可调用的全集
- SDK 只调用 `HostMethodsV1`，并把 API 分模块导出（`extension/storage/network`）
- 协议加版本字段（如 `X-Gemigo-Protocol: 1` 或 host handshake 返回版本）

### 7.2 Step 1：把 v1 “Read + Events + Overlay” 做稳

- Host ↔ Content Script 的消息类型统一（现有已经有较多实现）
- SDK 的 types 与实现对齐（先删掉未实现的 types，或标注为可选/实验）
- Overlay API 返回的 `*Id` 必须可撤销（host/content-script 维护 registry）

验收用例：
- 划词翻译：右键菜单触发 + 获取 selection + widget 展示结果
- 阅读模式：extractArticle + injectCSS/insertWidget

### 7.3 Step 2：引入 Storage（per-app）

- Host 提供 `storage.*`：底层用 `chrome.storage.local`
- 以 `appId` 为命名空间：key 统一前缀或独立结构
- 加配额/错误码（例如 `QUOTA_EXCEEDED`）

### 7.4 Step 3：引入 Network（带白名单与授权）

实现策略：
- App 调用 `gemigo.network.request()`
- SDK → Host：请求 `network.request`
- Host：校验 `permission=network` + `allowlist`，再转发给 Service Worker
- Service Worker：使用 `fetch`（或 `chrome.scripting` + page fetch）做代理，返回结构化响应

### 7.5 Step 4：权限弹窗与可撤销（平台化门槛）

Host UI 增加：
- “该 App 请求能力”弹窗
- 设置页查看/撤销权限
- 风险提示：写页面/截图/跨域请求

---

## 8. 建议的 API 形态（v1 对外稳定面）

建议对外只承诺以下稳定接口：

- `gemigo.extension.*`（读/事件/overlay/截图可见区域）
- `gemigo.storage.*`
- `gemigo.network.request`
- `gemigo.notify`（可选）

并把“未稳定/未实现”明确标为实验或移除，避免上层误用。

---

## 9. 代码落地清单（到仓库的具体改动）

> 目标：让 v1 能“真被用起来”，并且后续新增能力不会把协议搞乱。

### 9.1 SDK（`packages/extension-sdk`）

1. **补齐模块与导出**
   - 新增 `apis/storage.ts`、`apis/network.ts`（或按现有结构放入 `apis/`）
   - 在 `packages/extension-sdk/src/sdk.ts` 组装 `storage/network`，对外保持 `gemigo.storage.*`、`gemigo.network.*`
2. **收敛 types 与实现**
   - 以 v1 “稳定面”为准，修订 `packages/extension-sdk/src/types/extension.ts`
   - 未实现的 API：要么补实现，要么从 types/docs 移除或标注为实验
3. **协议版本/握手**
   - `packages/extension-sdk/src/core/connection.ts` 在握手阶段暴露 `protocolVersion`
   - SDK 在初始化时读取并缓存版本（用于后续兼容）

### 9.2 Host（`browser-extension/sidepanel`）

1. **统一 HostMethodsV1**
   - 在 `browser-extension/sidepanel/src/app-container.tsx` 明确定义 `HostMethodsV1`（类型 + 实现）
2. **权限校验与授权弹窗**
   - 引入 `AppManifest`（存储在 `chrome.storage.local` 或由远端提供）
   - 对 `extension.modify` / `extension.capture` / `network` 做权限校验
   - 缺权限时：返回结构化错误码（例如 `PERMISSION_DENIED`）

### 9.3 Service Worker / Content Script（`browser-extension/background` / `browser-extension/content-scripts`）

1. **Network 代理**
   - Service Worker 处理 `NETWORK_REQUEST` 消息并执行 `fetch`
   - 约束：超时、大小限制、禁止携带 cookie（或明确策略）
2. **Selection / Navigation 事件（v1/v1.1）**
   - Content Script 监听 selectionchange（已存在类似实现），统一事件结构并转发给 Host

---

## 10. 验收用例（v1 必须通过）

1. **划词翻译（最低可用）**
   - 右键菜单打开 App → `getContextMenuEvent()` 取得 selection → `network.request()` 调翻译 API → `insertWidget()` 展示结果
2. **阅读模式**
   - `extractArticle()` → `injectCSS()` 隐藏干扰元素/调整排版
3. **权限体验**
   - 首次调用 `insertWidget/highlight/injectCSS` 时弹窗授权（或安装时授权），拒绝后返回可识别错误并不影响 App 继续运行
