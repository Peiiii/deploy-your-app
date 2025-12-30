# Chrome Web Store 上架傻瓜清单（一步一步照做）

> 目标：把 `GemiGo` 浏览器插件提交到 Chrome Web Store 并进入审核。

---

## A. 你需要准备的账号/文件（提前 10 分钟搞定）

1) **Chrome Web Store Developer 账号**
- 入口：Chrome Web Store Developer Dashboard
- 需要：Google 账号 + 一次性开发者注册费

2) **隐私政策网页 URL（必须）**
- 需要是公网可访问的网页链接（不能是本地文件）
- 如果你还没有隐私政策页面：先在 `gemigo.io` 上放一个最简页面（后面有可复制的模板文案）

3) **截图（建议先准备 3 张）**
- 图 1：Side Panel 首页（Installed Apps / Explore 入口）
- 图 2：Explore 列表（展示平台应用）
- 图 3：App 运行页（包含「页面权限」条、Power Mode、授权当前站点按钮）

---

## B. 打包（我已经帮你做成一条命令）

在仓库根目录执行：

1) 生成生产构建 + 生成 zip：
- `pnpm package:extension`

2) 你要上传的文件在：
- `browser-extension/release/gemigo-v0.1.0.zip`

注意：
- 这个命令会 **拒绝** Dev build（避免把 localhost 放开 / Dev 名称上传）

---

## C. 本地验收（上传前必须做一次）

1) Chrome 打开：`chrome://extensions`
2) 右上角打开：Developer mode
3) 点击：Load unpacked
4) 选择目录：`browser-extension/dist`
5) 验收点（照着点就行）：
- 打开任意网站（例如 `https://www.v2ex.com/`）
- 点击扩展图标打开 Side Panel
- Explore → Refresh（默认 API Base URL 是 `https://gemigo.io`）
- 安装一个 App → 打开 App
- 在顶部「页面权限」条：
  - 点「仅授权当前站点」→ 再点「重试」
  - 或点「Power Mode」→ 再点「重试」
- 回到 App 内功能，确认“读取页面/分析”不再报 `Content script not available`

---

## D. 提交到 Chrome Web Store（你需要填写的表单信息）

进入 Developer Dashboard → New item / Upload new package：
- 上传：`browser-extension/release/gemigo-v0.1.0.zip`

### D1) 基本信息（可直接填写/粘贴）

**Name**
- `GemiGo`

**Short description（短描述）**
- `在浏览器侧边栏运行已部署的 AI 应用，并在用户授权后读取当前页面用于分析。`

**Detailed description（详细描述，可直接粘贴）**
- `GemiGo 是一个浏览器侧边栏（Side Panel）容器，用于运行你在 GemiGo 平台已部署的应用。`
- `当你在网页上使用应用的“读页面/选区/高亮”等能力时，扩展会在用户授权后，通过 content script 读取当前页面内容并提供给应用使用。`
- `你可以选择：仅授权当前站点，或开启 Power Mode 一次性授权所有站点（可随时撤销）。`

**Category**
- 建议：`Productivity`（或你觉得更匹配的类别）

**Language**
- `Chinese (Simplified)`（可加英文版后续再补）

### D2) 权限用途说明（审核最关心，建议照抄）

你会在权限/隐私相关页面看到类似“Explain why you need these permissions”的输入框，建议写：

**activeTab**
- `用于在用户主动使用扩展时，访问当前活动标签页，以便应用读取页面内容/选区进行分析。`

**scripting**
- `用于在用户授权后向当前页面注入 content script，以实现读取页面文本、获取选区、以及可选的页面高亮/插入小组件等能力。`

**storage**
- `用于保存用户已安装的应用列表、设置项（例如 API Base URL）以及运行所需的少量状态。`

**contextMenus**
- `用于在用户右键菜单中提供“用 GemiGo 处理选中文本/总结页面”等入口，并将选区事件发送到 Side Panel 应用。`

**notifications**
- `用于向用户展示扩展内的结果提示/错误提示（例如网络请求失败）。`

**host_permissions（自有域名）**
- `默认允许在 gemigo 自有域名（gemigo.io / gemigo.app）上注入脚本，便于用户在平台页面内直接使用扩展能力。`

**optional_host_permissions（Power Mode / 站点授权）**
- `用于让用户按需授权：仅授权当前站点，或开启 Power Mode 一次性授权所有站点。扩展不会在未授权的网站读取页面内容。`

### D3) 隐私政策（必须填 URL）

填你准备好的隐私政策 URL。

下面是一份“最简隐私政策模板”（你可以放到网页上再填 URL）：

**隐私政策（模板）**
- `本扩展仅在用户主动触发相关功能（例如读取页面、分析页面、处理选区）并完成授权后，才会读取当前页面内容。`
- `读取到的页面内容仅用于完成用户发起的分析任务，可能会被发送到 GemiGo 平台的后端服务进行处理。`
- `扩展不会在后台持续收集浏览记录或页面内容。`
- `用户可随时在 Chrome 扩展设置中撤销站点授权或关闭 Power Mode。`
- `如需删除相关数据或提出问题，请联系：<你的联系邮箱>`

---

## E. 发布后你可能需要做的（避免被卡）

1) **版本号管理**
- 每次重新上传 zip 前，先修改 `browser-extension/manifest.json` 的 `version`（例如 `0.1.1`）
- 然后再跑：`pnpm package:extension`

2) **平台侧要有可安装的应用**
- 只有在 Web 端项目设置里开启了 `Enable in Browser Extension` 的项目，才会在插件 Explore 里出现
- 且应用 URL 必须是 `https://*.gemigo.app`（与 `frame-src` 匹配）

