# 统一 App SDK（`@gemigo/app-sdk`）计划与实现说明

目标：上层应用只接入 **一个 SDK**（`gemigo`），无需关心运行在 Web / Desktop / Browser Extension，SDK 自动适配并通过 `capabilities` 提供可用能力集合；未支持能力必须可预测失败（统一错误码），而不是挂起或 silent fail。

---

## 1. 约束与原则

1. **一个入口**：统一使用 `@gemigo/app-sdk`（CDN/UMD 依然暴露全局 `gemigo`）。
2. **自动适配**：SDK 初始化时探测运行环境并选择 adapter：
   - `extension`：iframe 内且可与 Side Panel Host 建立握手（penpal RPC）
   - `desktop`：存在桌面端 bridge（未来由 preload 注入）
   - `web`：默认兜底（能力受限）
3. **能力不删**：types 可以保留全量能力，但需要：
   - `gemigo.capabilities` 真实反映当前可用能力
   - 不可用能力调用必须抛出统一 `SDKError(code='NOT_SUPPORTED')`
4. **跨平台一致**：同一个 API 名称、参数、错误码在三端一致；差异只体现在 `capabilities`。
5. **安全默认**：高风险能力必须 gated（`network` / `extension.modify` / `extension.capture` 等）。

---

## 2. 现阶段一次性落地范围（本次实现）

> 以“浏览器插件场景”优先（因为已具备 host/SW/content-script），同时把 Web/Desktop 的自动适配骨架搭好。

### 2.1 SDK 侧（统一入口）

- 统一入口：`@gemigo/app-sdk`（包名升级自现有 `@gemigo/extension-sdk`）
- `gemigo.platform`：`'web' | 'desktop' | 'extension'`
- `gemigo.capabilities`：由宿主握手返回（extension），web/desktop 提供合理默认
- `gemigo.storage.*`：
  - extension：Host 代理到 `chrome.storage.local`（按 appId 隔离）
  - web：localStorage（按 appId 隔离）
  - desktop：预留（未实现 → `NOT_SUPPORTED`）
- `gemigo.network.request()`：
  - extension：Host → Service Worker `fetch` 代理（带 allowlist）
  - web：默认 `NOT_SUPPORTED`（不承诺“突破 CORS”能力）
  - desktop：预留（未实现 → `NOT_SUPPORTED`）

### 2.2 Extension Host / Service Worker

- Host 增加握手：`getProtocolInfo()`，返回 `protocolVersion/platform/capabilities/appId`
- Host 增加：
  - Storage：`storageGet/storageSet/storageDelete/storageClear`
  - Network：`networkRequest`（权限 + allowlist 校验后转发给 SW）
  - 权限 gate：`extension.modify`、`extension.capture`、`network`
- Service Worker 增加 `NETWORK_REQUEST`：执行 `fetch` 并返回结构化响应

---

## 3. 核心协议与错误码

### 3.1 Host 握手协议（extension）

`getProtocolInfo():`
- `protocolVersion: 1`
- `platform: 'extension'`
- `appId: string`（由 Host 绑定）
- `capabilities:`
  - `storage: boolean`
  - `network: boolean`
  - `extension: { read: boolean; events: boolean; modify: boolean; capture: boolean }`

### 3.2 统一错误码（SDKError.code）

- `NOT_SUPPORTED`
- `PERMISSION_DENIED`
- `NETWORK_NOT_ALLOWED`
- `TIMEOUT`
- `INTERNAL_ERROR`

---

## 4. 权限与 allowlist（extension v1）

### 4.1 权限来源

本次先以 Side Panel 安装的 app 配置为准（`InstalledApp.permissions` / `InstalledApp.networkAllowlist`）。

### 4.2 默认策略

- `read/events` 默认允许
- `extension.modify` / `extension.capture` / `network` 需要在 app 配置中显式声明
- `networkAllowlist` 不存在则默认拒绝任何跨域请求

后续可升级为：远端 manifest + 首次使用弹窗授权 + 可撤销授权页。

---

## 5. 验收用例（本次实现应通过）

1. 现有 demo apps 不需要修改业务逻辑即可继续工作（仅 SDK 内部升级 + Host 增强）。
2. `gemigo.storage.*` 在 extension 环境可用且按 appId 隔离。
3. `gemigo.network.request()` 在 extension 环境可用，且会被 allowlist 正确拒绝/放行。
4. web 环境加载 SDK 不会“卡死等待 host”，不可用能力明确返回 `NOT_SUPPORTED`。

