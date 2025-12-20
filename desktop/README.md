## Gemigo Desktop (shell)

- **用途**: 最小 Electron 外壳，直接加载线上 Web 站点，便于快速验证桌面端价值。
- **默认入口**: `https://gemigo.io`，可通过环境变量覆盖。

### 开发 & 运行

```bash
# 在仓库根目录
pnpm --filter gemigo-desktop install   # 首次安装依赖
pnpm --filter gemigo-desktop dev       # 构建后启动 Electron，加载远程站点
```

- 覆盖入口：`DESKTOP_WEB_URL=https://staging.gemigo.io pnpm --filter gemigo-desktop dev`
- 构建包（需要安装依赖）：`pnpm --filter gemigo-desktop run pack`
- 如遇 `ELECTRON_RUN_AS_NODE=1` 导致 Electron 以 Node 模式运行（表现为 `require('electron').app` 为空），`dev` 脚本已强制清空该变量；手动运行时也可先 `unset ELECTRON_RUN_AS_NODE`。

### 行为说明

- 仅作为“薄壳”：业务 UI/登录/接口沿用线上 Web。
- 禁用 `nodeIntegration`，启用 `contextIsolation` 与 `sandbox`；无额外 preload 能力暴露。
- 所有 `window.open` 会在系统默认浏览器中打开，避免在桌面端无限弹窗。
- **OAuth 登录走系统浏览器**：当页面发起 `GET /api/v1/auth/google/start` 或 `GET /api/v1/auth/github/start` 跳转时，桌面端会拦截该导航并改为 `shell.openExternal(...)`，确保登录在系统默认浏览器完成（而不是在 Electron WebView 内）。
- **登录完成回跳桌面端**：浏览器登录成功后会 302 到 `gemigo-desktop://auth?token=...`，桌面端收到 deep link 后用 token 完成一次“桌面端登录”，随后刷新主窗口回到入口页。

### 验收清单（Desktop OAuth）

> 目标：桌面端点击第三方登录时“外跳浏览器登录”，完成后“自动回到桌面端并刷新登录态”。

1. 启动桌面端：`pnpm dev:desktop`（或先打包安装后启动）。
2. 在桌面端点击「Google / GitHub 登录」：
   - 期望：系统默认浏览器被打开（桌面端 WebView 不进入 Google/GitHub 登录页）。
3. 在浏览器完成登录：
   - 期望：浏览器触发 `gemigo-desktop://auth?token=...`，桌面端自动被唤起并回到应用前台。
4. 桌面端登录态刷新：
   - 期望：桌面端刷新后已处于登录状态（能正常访问需要登录的页面/能力）。
5. 单实例行为：
   - 期望：当应用已打开时，再次触发 `gemigo-desktop://...` 不会启动第二个实例，而是聚焦现有窗口并完成登录刷新。

手动触发 deep link（用于排障）：
- macOS：`open 'gemigo-desktop://auth?token=test'`
- Linux：`xdg-open 'gemigo-desktop://auth?token=test'`
- Windows（PowerShell）：`Start-Process 'gemigo-desktop://auth?token=test'`

### Release（下载安装）

本项目支持两种方式获取安装包：

1. **本地打包**
   - 运行：`pnpm --filter gemigo-desktop run pack`
   - 产物目录：`desktop/release/`（例如 macOS 的 `.dmg/.zip`、Windows 的 `.exe`、Linux 的 `.AppImage`）

2. **GitHub Release 自动构建**
   - 一条命令（推荐）：`pnpm release:desktop`（会读取 `desktop/package.json` 的版本号并 push `desktop-v<version>` tag）
   - 打 Tag 触发：`desktop-v*`（例如：`desktop-v0.1.2`）
   - Workflow：`.github/workflows/desktop-release.yml`
   - Release 附件会包含 macOS / Windows / Linux 对应安装包

注意：
- 未做签名/公证的安装包在 macOS/Windows 可能会被系统拦截，需要用户手动“仍要打开”；正式发版建议补齐签名（mac notarization / Windows code signing）。
