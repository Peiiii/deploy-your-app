# GemiGo SDK API 参考

> GemiGo 平台的完整 JavaScript API 文档

---

## 📚 目录

1. [通用 API](#通用-api)
   - [Environment 环境](#environment)
   - [Storage 存储](#storage)
   - [Cloud 云端托管](#cloud)
   - [Notify 通知](#notify)
   - [AI 人工智能](#ai)
   - [Clipboard 剪贴板](#clipboard)
   - [Dialog 对话框](#dialog)
   - [File 文件](#file)
   - [Network 网络](#network)
2. [桌面端 API](#桌面端-api)
   - [Scheduler 定时任务](#scheduler)
   - [FileWatch 文件监控](#filewatch)
   - [Shell 系统集成](#shell-系统集成)
   - [GlobalShortcut 全局快捷键](#globalshortcut)
   - [Autostart 开机启动](#autostart)
3. [浏览器扩展 API](#浏览器扩展-api) (通过 `@gemigo/app-sdk` npm 包使用，原 `@gemigo/extension-sdk`)
   - [Extension 扩展交互](#extension)
4. [应用清单规范 (Manifest)](#应用清单规范-manifest)

---

## <a id="通用-api"></a>1. 通用 API

所有平台均支持的基础能力。

### Auth 网页授权

`gemigo.auth.login({appId?, scopes?, display?: 'popup' | 'redirect' | 'auto', redirectUri?, persist?})` 从用户点击发起。仅支持 `identity:basic`、`storage:rw`、`points:use`；来源必须与平台已发布应用登记地址匹配。默认弹窗；整页模式需在应用启动调用 `await gemigo.auth.handleRedirectCallback()`，返回令牌或无回调时的 `null`，失败/取消会抛错。返回 URI 必须完全等于规范化的发布 URL，默认应用根 URL。SDK 校验 state、PKCE 和十分钟时限，清理回调参数，恢复原页面。`getAccessToken()` 读取应用令牌，`logout()` 清除应用登录。详见 https://docs.gemigo.io/auth-cloud 。

### <a id="environment"></a>Environment 环境

#### `gemigo.platform`
- **类型**: `string`
- **值**: `'web' | 'desktop' | 'extension'`
- **说明**: 获取当前应用运行的平台环境。

#### `gemigo.capabilities`
- **类型**: `object`
- **说明**: 返回当前环境支持的能力集合。
- **示例**:
  ```javascript
  {
    scheduler: false,
    fileWatch: false,
    fileWrite: false,
    notification: true
  }
  ```

---

### <a id="storage"></a>Storage 存储

提供跨会话的持久化键值对存储。不同应用的数据完全隔离。

#### `gemigo.storage.get(key)`
- **参数**: `key: string`
- **返回**: `Promise<any | null>`
- **说明**: 获取存储的值。

#### `gemigo.storage.set(key, value)`
- **参数**: `key: string`, `value: any`
- **返回**: `Promise<void>`
- **说明**: 存储值，对象会自动 JSON 序列化。

#### `gemigo.storage.delete(key)`
- **参数**: `key: string`
- **返回**: `Promise<void>`
- **说明**: 删除指定键。

#### `gemigo.storage.clear()`
- **返回**: `Promise<void>`
- **说明**: 清空当前应用的所有数据。

---

### <a id="cloud"></a>Cloud 云端托管

提供平台托管的云端能力（无需自建后端），用于跨设备数据与共享数据能力。

> 约定：`gemigo.storage` 仍表示本地/宿主存储；云端托管能力统一在 `gemigo.cloud` 下。

#### `gemigo.cloud.kv.get(key)`
- **参数**: `key: string`
- **返回**: `Promise<{ key: string, value: any, etag: string, updatedAt: number }>`

#### `gemigo.cloud.kv.set(key, value, options?)`
- **参数**:
  - `key: string`
  - `value: any`
  - `options?: { ifMatch?: string }`
- **返回**: `Promise<{ key: string, etag: string, updatedAt: number }>`

#### `gemigo.cloud.kv.delete(key, options?)`
- **参数**:
  - `key: string`
  - `options?: { ifMatch?: string }`
- **返回**: `Promise<void>`

#### `gemigo.cloud.kv.list(options?)`
- **参数**: `options?: { prefix?: string, limit?: number, cursor?: string }`
- **返回**: `Promise<{ items: Array<{ key, etag, updatedAt, valueBytes }>, nextCursor: string | null }>`

#### `gemigo.cloud.db.collection(name)`
- **参数**: `name: string`
- **返回**: `CloudDbCollection`
- **说明**: 集合/文档模型（对齐 `db.collection` 心智）。

> 权限说明（对齐微信演进）：
> - 默认 legacy：`permissionMode=creator_read_write`（仅创建者可读写），服务端会对 query/count **隐式追加** `_openid == auth.openid`。
> - 若启用 Security Rules：服务端按规则强制，并要求 query/count/update/remove 的条件是规则的子集（不会“静默过滤”）。

#### `CloudDbCollection.add(data, options?)`
- **参数**:
  - `data: any`
  - `options?: { id?: string }`
- **返回**: `Promise<CloudDbDoc>`

#### `CloudDbCollection.doc(id)`
- **返回**: `CloudDbDocumentRef`

#### `CloudDbDocumentRef.get()`
- **返回**: `Promise<CloudDbDoc>`

#### `CloudDbDocumentRef.set(data, options?)` 🆕
- **说明**: Upsert（不存在则创建，存在则覆盖数据）。适合“用户资料/profile”这类固定 id 的文档。
- **参数**:
  - `data: any`
  - `options?: { ifMatch?: string }`
- **返回**: `Promise<CloudDbDoc>`

#### `CloudDbDocumentRef.update(patch, options?)`
- **说明**: Patch 更新（浅合并），仅 owner 可写。
- **返回**: `Promise<CloudDbDoc>`

#### `CloudDbDocumentRef.delete()`
- **返回**: `Promise<void>`

#### `CloudDbCollection.query()`
- **返回**: `CloudDbQueryBuilder`

#### `gemigo.cloud.init(options?)`（小程序风格）🆕
- **说明**: 对齐 `wx.cloud.init({ env })` 的写法；当前仅保留配置位（未来可用于多环境路由）。
- **参数**: `options?: { env?: string }`
- **返回**: `void`

#### `gemigo.cloud.database()`（小程序风格）🆕
- **说明**: 对齐 `wx.cloud.database()`；返回一个带 `collection()` 与 `command` 的数据库对象。
- **返回**: `WxCloudDatabase`

#### `WxCloudDatabase.collection(name)`（小程序风格）🆕
- **说明**: 返回集合引用（同时也是 query 对象），支持链式：`where/orderBy/limit/skip/get`。

```js
const db = gemigo.cloud.database();
const _ = db.command;
const posts = db.collection('posts');
const feed = await posts.where({ visibility: _.eq('public') }).orderBy('createdAt', 'desc').limit(20).get();
```

> 注意：默认权限为 `creator_read_write`（仅创建者可读写）。若要实现“公开可读”的 feed，需要为该 collection 配置 Security Rules（例如 `docs/tech/WX_CLOUD_DB_SECURITY_RULES_DSL_V0.md` 的模板）。

#### `WxCloudDatabase.serverDate(options?)`（小程序风格）🆕
- **说明**: 对齐 `db.serverDate()`；用于把字段值设置为服务端时间（避免客户端时钟不准）。
- **参数**: `options?: { offset?: number }`（毫秒）

```js
const db = gemigo.cloud.database();
await db.collection('posts').add({ data: { createdAt: db.serverDate() } });
```

#### `WxCloudCollection.add({ data })`（小程序风格）🆕
- **返回**: `Promise<{ _id: string }>`

#### `WxCloudCollection.doc(id)`（小程序风格）🆕
- **返回**: `WxCloudDocumentRef`

#### `WxCloudDocumentRef.get()`（小程序风格）🆕
- **返回**: `Promise<{ data: { _id: string, ... } }>`

#### `WxCloudDocumentRef.set({ data })` / `update({ data })` / `remove()`（小程序风格）🆕
- **说明**: `update` 支持浅层字段更新；支持有限的 `db.command`（`inc/set/remove`）以对齐常见写法。

#### `WxCloudQuery.startAfter(cursor)`（分页扩展）🆕
- **说明**: 通过 cursor 分页（推荐用于 feed/无限滚动）。cursor 从 `get()` 返回的 `_meta.nextCursor` 获取。

```js
const first = await posts.where({ visibility: _.eq('public') }).orderBy('createdAt', 'desc').limit(20).get();
const cursor = first._meta?.nextCursor;
if (cursor) {
  const second = await posts.where({ visibility: _.eq('public') }).orderBy('createdAt', 'desc').limit(20).startAfter(cursor).get();
}
```

#### `WxCloudQuery.count()` / `update({ data })` / `remove()`（小程序风格）🆕
- **说明**: 对齐小程序 `where().count/update/remove` 能力（批量能力）。

```js
const total = await posts.where({ visibility: _.eq('public') }).count();
const updated = await posts.where({ _id: _.eq('some-id') }).update({ data: { views: _.inc(1) } });
const removed = await posts.where({ _id: _.eq('some-id') }).remove();
```

#### `gemigo.cloud.blob.createUploadUrl(input)` 🆕
- **说明**: 生成短时上传 URL（不需要在上传请求中带 Authorization header）。
- **参数**: `input: { path?: string; visibility?: 'private'|'public'; contentType?: string; expiresIn?: number }`
- **返回**: `Promise<{ fileId: string; uploadUrl: string; expiresIn: number }>`

#### `gemigo.cloud.blob.getDownloadUrl(input)` 🆕
- **说明**: 生成短时下载 URL（可直接用于 `<img src=...>`）。
- **参数**: `input: { fileId: string; expiresIn?: number }`
- **返回**: `Promise<{ fileId: string; url: string; expiresIn: number }>`

#### `gemigo.cloud.functions.call(name, payload?)` 🆕
- **说明**: 平台托管云函数 RPC（V0 内置函数从 `cloud.ping` 开始）。
- **参数**:
  - `name: string`（如 `'cloud.ping'`）
  - `payload?: any`
- **返回**: `Promise<any>`

#### `gemigo.cloud.callFunction({ name, data })`（小程序风格）🆕
- **说明**: 对齐 `wx.cloud.callFunction`；返回 `{ result }`。

#### `gemigo.cloud.uploadFile({ cloudPath, filePath })`（小程序风格）🆕
- **说明**: 对齐 `wx.cloud.uploadFile`；Web 端 `filePath` 传 `Blob/File`。
- **返回**: `Promise<{ fileID: string }>`

#### `gemigo.cloud.getTempFileURL({ fileList })`（小程序风格）🆕
- **说明**: 对齐 `wx.cloud.getTempFileURL`；返回短时可访问 URL（可直接用于 `<img src=...>`）。

---

### <a id="notify"></a>Notify 通知

#### `gemigo.notify(options)`
- **参数**:
  - `options`: `object`
    - `title`: `string` (必填)
    - `body`: `string` (可选)
    - `icon`: `string` (可选，URL)
    - `actions`: `Array<{ id: string, label: string }>` (可选，仅桌面端支持按钮)
- **返回**: `Promise<{ success: boolean, reason?: string }>`
- **说明**: 发送系统通知。Web 端需要用户授权。

#### `gemigo.onNotificationAction(actionId, callback)`
- **参数**:
  - `actionId`: `string` (对应 `actions` 中的 id)
  - `callback`: `function`
- **说明**: 监听通知按钮的点击事件。

---

### <a id="ai"></a>AI 人工智能

直接调用平台集成的云端大模型。

#### `gemigo.ai.chat(messages)`
- **参数**:
  - `messages`: `Array<{ role: 'user'|'assistant'|'system', content: string }>`
- **返回**: `Promise<{ role: 'assistant', content: string }>`
- **说明**: 进行多轮对话。

#### `gemigo.ai.summarize(text)`
- **参数**: `text: string`
- **返回**: `Promise<string>`
- **说明**: 总结文本内容。

#### `gemigo.ai.translate(text, options)`
- **参数**:
  - `text`: `string`
  - `options`: `{ from?: string, to: string }`
- **返回**: `Promise<{ text: string, from: string, to: string }>`
- **说明**: 翻译文本。

---

### <a id="clipboard"></a>Clipboard 剪贴板

#### `gemigo.clipboard.readText()`
- **返回**: `Promise<string>`
- **说明**: 读取剪贴板文本。

#### `gemigo.clipboard.writeText(text)`
- **参数**: `text: string`
- **返回**: `Promise<void>`
- **说明**: 写入文本到剪贴板。

#### `gemigo.clipboard.readImage()` 🆕
- **返回**: `Promise<Blob | null>`
- **说明**: 读取剪贴板中的图片。

#### `gemigo.clipboard.writeImage(blob)` 🆕
- **参数**: `blob: Blob`
- **返回**: `Promise<void>`
- **说明**: 写入图片到剪贴板。

#### `gemigo.clipboard.onChange(callback)` 🆕
- **参数**: `callback: (content: { text?: string, image?: Blob }) => void`
- **返回**: `() => void` (取消监听函数)
- **平台**: 仅桌面端支持
- **说明**: 监听剪贴板内容变化，可用来实现"复制即翻译"等功能。

```javascript
// 示例：复制即翻译
const unsubscribe = gemigo.clipboard.onChange(async ({ text }) => {
  if (text && isEnglish(text)) {
    const translated = await gemigo.ai.translate(text, { to: 'zh' });
    await gemigo.notify({ title: '翻译', body: translated.text });
  }
});
```

---

### <a id="dialog"></a>Dialog 对话框

用户交互式文件选择。

#### `gemigo.dialog.openFile(options)`
- **参数**:
  - `accept`: `string` (MIME 类型，如 `'image/*'`)
  - `multiple`: `boolean`
- **返回**: `Promise<FileEntry | FileEntry[] | null>`
- **说明**: 弹出文件选择框，返回的文件在当前会话内可读写。

#### `gemigo.dialog.openDirectory()`
- **返回**: `Promise<{ path: string } | null>`
- **说明**: 选择文件夹，返回的目录在当前会话内可读写。

#### `gemigo.dialog.saveFile(options)`
- **参数**:
  - `defaultName`: `string` (默认文件名)
  - `filters`: `Array<{ name: string, extensions: string[] }>`
- **返回**: `Promise<{ path: string } | null>`
- **说明**: 弹出保存对话框，用户选择保存位置。

#### `gemigo.dialog.message(options)`
- **参数**:
  - `title`: `string`
  - `message`: `string`
  - `type`: `'info' | 'warning' | 'error'`
  - `buttons`: `string[]`
- **返回**: `Promise<number>` (点击的按钮索引)
- **说明**: 显示系统消息框。

#### `gemigo.onFileDrop(callback)`
- **参数**: `callback: (files: FileEntry[]) => void`
- **返回**: `() => void` (取消监听)
- **说明**: 监听用户拖入的文件。

```javascript
// 示例：拖入图片自动压缩
gemigo.onFileDrop(async (files) => {
  for (const file of files) {
    if (file.name.endsWith('.png')) {
      const data = await gemigo.file.readBinary(file.path);
      const compressed = await compressImage(data);
      await gemigo.file.write(file.path, compressed);
    }
  }
});
```

---

### <a id="file"></a>File 文件

文件操作支持两种权限模式：

| 模式 | 说明 | 何时获得权限 |
|------|------|-------------|
| **Scope 预授权** | manifest 中声明的固定目录 | 安装时 |
| **Dialog 选择** | 用户通过对话框/拖拽选择 | 用户操作时 |

#### Scope 预授权配置 (manifest.json)

```json
{
  "permissions": ["file"],
  "file": {
    "scope": [
      "$DOWNLOAD",      // 下载文件夹
      "$DOCUMENT",      // 文档文件夹
      "$PICTURE",       // 图片文件夹
      "$DESKTOP",       // 桌面
      "$APP_DATA",      // 应用私有数据目录
      "$TEMP"           // 临时目录
    ]
  }
}
```

---

#### 类型定义

```typescript
interface FileEntry {
  name: string;        // 文件名
  path: string;        // 完整路径
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: number;       // 修改时间戳
}
```

#### 读写操作

##### `gemigo.file.readText(path)`
- **返回**: `Promise<string>`
- **说明**: 读取文本文件（UTF-8）。

##### `gemigo.file.readBinary(path)`
- **返回**: `Promise<ArrayBuffer>`
- **说明**: 读取二进制文件。

##### `gemigo.file.write(path, data)`
- **参数**: `path: string`, `data: string | ArrayBuffer`
- **返回**: `Promise<void>`

##### `gemigo.file.append(path, data)`
- **说明**: 追加内容到文件末尾。

---

#### 文件操作

##### `gemigo.file.exists(path)`
- **返回**: `Promise<boolean>`

##### `gemigo.file.stat(path)`
- **返回**: `Promise<{ size, mtime, ctime, isFile, isDirectory }>`

##### `gemigo.file.copy(src, dest)`
##### `gemigo.file.move(src, dest)`
##### `gemigo.file.remove(path)`

---

#### 目录操作

##### `gemigo.file.list(path)`
- **返回**: `Promise<FileEntry[]>`
- **说明**: 列出目录内容。

##### `gemigo.file.mkdir(path, options?)`
- **参数**: `options.recursive?: boolean`

---

#### 权限持久化

##### `gemigo.file.persistPermission(path)`
- **说明**: 持久化用户选择的路径权限，下次启动无需重新选择。

---

### <a id="network-网络-增强"></a>Network 网络 (增强)

突破浏览器 CORS 限制，由宿主代理请求。

#### `gemigo.network.request(url, options)`
- **参数**:
  - `url`: `string`
  - `options`:
    - `method`: `'GET' | 'POST' | 'PUT' | 'DELETE'`
    - `headers`: `Record<string, string>`
    - `body`: `string | object`
    - `responseType`: `'json' | 'text' | 'arraybuffer'`
- **返回**: `Promise<{ status: number, data: any, headers: object }>`
- **权限**: 需声明 `permissions: ['network']`
- **说明**: 发起跨域 HTTP 请求。

---

## <a id="桌面端-api"></a>2. 桌面端 API

⚠️ **注意**：使用前必须检查 `gemigo.capabilities`。

### <a id="scheduler"></a>Scheduler 定时任务

#### `gemigo.scheduler.register(config)`
- **参数**:
  - `config`: `object`
    - `id`: `string` (任务唯一标识)
    - `interval`: `string` (周期，如 `'30m'`, `'1h'`, `'2h'`, `'1d'`)
    - `startTime`: `string` (可选，如 `'08:00'`)
    - `endTime`: `string` (可选，如 `'22:00'`)
    - `notification`: `object` (同 `notify` options)
- **返回**: `Promise<{ success: boolean, reason?: string }>`
- **说明**: 注册一个后台定时任务。

#### `gemigo.scheduler.update(id, config)`
- **说明**: 更新已存在的任务。

#### `gemigo.scheduler.cancel(id)`
- **说明**: 取消任务。

#### `gemigo.scheduler.list()`
- **返回**: `Promise<Array<TaskConfig>>`
- **说明**: 列出当前应用的所有任务。

---

### <a id="filewatch"></a>FileWatch 文件监控

#### `gemigo.fileWatch.register(config)`
- **参数**:
  - `config`: `object`
    - `id`: `string`
    - `path`: `string` (如 `'~/Downloads'`)
    - `pattern`: `string` (glob 模式，如 `'*.png'`)
    - `events`: `Array<'create'|'modify'|'delete'>`
    - `action`: `{ type: 'callback', callback: string }`
- **返回**: `Promise<{ success: boolean }>`
- **说明**: 监控指定文件夹的变化。

#### `gemigo.fileWatch.cancel(id)`
- **说明**: 停止监控。

#### `gemigo.onFileWatch(callbackId, handler)`
- **说明**: 全局监听文件变化事件。

---

### <a id="shell-系统集成"></a>Shell 系统集成

#### `gemigo.shell.openExternal(url)`
- **参数**: `url: string`
- **返回**: `Promise<void>`
- **说明**: 使用系统默认浏览器打开链接。

#### `gemigo.shell.showItemInFolder(path)`
- **参数**: `path: string`
- **返回**: `Promise<void>`
- **说明**: 在文件资源管理器 (Finder/Explorer) 中显示并选中文件。

#### `gemigo.shell.openPath(path)`
- **参数**: `path: string`
- **返回**: `Promise<void>`
- **说明**: 使用系统默认应用打开文件。

---

### <a id="globalshortcut"></a>GlobalShortcut 全局快捷键

注册系统级快捷键，即使应用不在前台也能触发。

#### `gemigo.globalShortcut.register(accelerator, callback)`
- **参数**:
  - `accelerator`: `string` (如 `'Cmd+Shift+X'`, `'Ctrl+Alt+P'`)
  - `callback`: `() => void`
- **返回**: `Promise<boolean>` (是否注册成功)
- **说明**: 注册全局快捷键。

```javascript
// 示例：随时呼出截图工具
gemigo.globalShortcut.register('Cmd+Shift+S', () => {
  showScreenshotTool();
});
```

#### `gemigo.globalShortcut.unregister(accelerator)`
- **说明**: 取消注册。

#### `gemigo.globalShortcut.unregisterAll()`
- **说明**: 取消应用注册的所有快捷键。

---

### <a id="autostart"></a>Autostart 开机启动

允许应用在系统启动时自动运行。

#### `gemigo.autostart.enable()`
- **返回**: `Promise<void>`
- **说明**: 启用开机自启。

#### `gemigo.autostart.disable()`
- **返回**: `Promise<void>`
- **说明**: 禁用开机自启。

#### `gemigo.autostart.isEnabled()`
- **返回**: `Promise<boolean>`
- **说明**: 检查是否已启用。

---

## <a id="浏览器扩展-api"></a>3. 浏览器扩展 API

⚠️ **注意**：仅在 `gemigo.platform === 'extension'` 时可用。

### <a id="extension"></a>Extension 扩展交互

---

#### 菜单与交互

##### `gemigo.extension.onContextMenu(callback)`
- **参数**:
  - `callback`: `(event: { menuId: string, selectionText?: string, pageUrl?: string }) => void`
- **说明**: 监听右键菜单点击事件。

##### `gemigo.extension.getContextMenuEvent()`
- **返回**: `Promise<{ success: boolean, event?: ... }>`
- **说明**: 获取应用打开时挂起的上下文菜单事件。

##### `gemigo.extension.onSelectionAction(actionId, callback)`
- **说明**: 处理选中浮窗按钮点击。

---

#### 页面内容读取 (Read)

##### `gemigo.extension.getPageInfo()`
- **返回**: `Promise<{ url: string, title: string, favIconUrl?: string }>`
- **说明**: 获取当前激活标签页的基本信息。

##### `gemigo.extension.getPageHTML()`
- **返回**: `Promise<string>`
- **说明**: 获取当前页面的完整 HTML 内容。
- **注意**: 跨域 iframe 内容可能无法读取，会抛出 `CROSS_ORIGIN` 错误。

##### `gemigo.extension.getPageText()`
- **返回**: `Promise<string>`
- **说明**: 获取当前页面的纯文本内容（剔除 HTML 标签）。

##### `gemigo.extension.queryElement(selector)`
- **参数**: `selector: string` (CSS 选择器)
- **返回**: `Promise<{ text: string, html: string, rect: DOMRect } | null>`
- **说明**: 获取匹配元素的内容和位置信息。

##### `gemigo.extension.extractArticle()`
- **返回**: `Promise<{ title: string, content: string, author?: string, date?: string }>`
- **说明**: 智能提取页面正文内容（基于 Readability 算法）。

##### `gemigo.extension.extractLinks()`
- **返回**: `Promise<Array<{ text: string, href: string }>>`
- **说明**: 提取页面中所有链接。

##### `gemigo.extension.extractImages()`
- **返回**: `Promise<Array<{ src: string, alt: string, width: number, height: number }>>`
- **说明**: 提取页面中所有图片。

---

#### 页面内容修改 (Modify)

> ⚠️ 需要 `extension.modify` 权限

##### `gemigo.extension.highlight(selector, options?)`
- **参数**:
  - `selector`: `string` (CSS 选择器)
  - `options`: `{ color?: string, duration?: number }`
- **返回**: `Promise<() => void>` (返回移除高亮的函数)
- **说明**: 高亮页面中匹配的元素。

##### `gemigo.extension.insertWidget(config)`
- **参数**:
  - `config`: `{ html: string, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | { x: number, y: number } }`
- **返回**: `Promise<WidgetHandle>` (`{ remove(), update(html) }`)
- **说明**: 在页面中插入浮层组件。组件会自动添加应用命名空间隔离样式。

##### `gemigo.extension.injectCSS(css)`
- **参数**: `css: string`
- **返回**: `Promise<() => void>` (返回移除样式的函数)
- **说明**: 注入自定义 CSS 样式。样式会自动添加应用专属前缀避免冲突。

---

#### 页面事件监听 (Events)

##### `gemigo.extension.onSelectionChange(callback)`
- **参数**: `callback: (text: string, rect: { x, y, width, height } | null, url: string) => void`
- **返回**: `() => void` (取消订阅函数)
- **说明**: 监听用户选中文字的变化。`rect` 为选区的页面坐标，可用于 `insertWidget` 定位。

##### `gemigo.extension.getSelection()`
- **返回**: `Promise<{ text: string, rect: { x, y, width, height } | null, url: string } | null>`
- **说明**: 获取当前页面选中的文字和位置信息。

##### `gemigo.extension.onNavigate(callback)`
- **参数**: `callback: (url: string) => void`
- **返回**: `() => void` (取消订阅函数)
- **说明**: 监听页面跳转事件。

##### `gemigo.extension.onScroll(callback)`
- **参数**: `callback: (scrollY: number) => void`
- **返回**: `() => void` (取消订阅函数)
- **说明**: 监听页面滚动事件（已节流）。

---

#### 截图 (Capture)

> ⚠️ 需要 `extension.capture` 权限

##### `gemigo.extension.captureVisible()`
- **返回**: `Promise<{ success: boolean, dataUrl?: string, error?: string }>`
- **说明**: 截取当前可见区域。

##### `gemigo.extension.captureFull(options?)`
- **参数**: `options`: `{ maxHeight?: number }` (默认最大 30000px)
- **返回**: `Promise<string>` (base64 PNG)
- **说明**: 截取整个页面（长截图）。

---

#### 快捷键 (Shortcuts)

> ⚠️ 需要 `extension.shortcuts` 权限

##### `gemigo.extension.registerShortcut(combo, callback)`
- **参数**:
  - `combo`: `string` (如 `'Ctrl+Shift+T'`, `'Cmd+Alt+S'`)
  - `callback`: `() => void`
- **返回**: `() => void` (取消注册函数)
- **说明**: 注册页面级快捷键（仅在当前标签页激活时生效）。

---

#### 类型定义

```typescript
interface WidgetHandle {
  remove(): void;
  update(html: string): void;
}
```

---


## <a id="应用清单规范-manifest"></a>4. 应用清单规范 (Manifest)

`manifest.json` 是应用的配置文件。

```json
{
  // --- 基础元数据 ---
  "name": "应用名称",           // 必填
  "version": "1.0.0",          // 必填
  "description": "应用描述",    // 必填
  "icon": "icon.png",          // 必填 (相对路径)
  "author": "创作者",
  
  // --- 应用类型 ---
  // ui: 普通且前应用
  // hybrid: 有界面也有后台
  // service: 纯后台服务
  "type": "ui",                // 默认 ui
  
  // --- 平台支持 ---
  "platforms": ["web", "desktop", "extension"],
  
  // --- 入口配置 ---
  "ui": {
    "main": "index.html",      // 主界面 HTML
    "settings": "settings.html" // 设置界面 (Hybrid/Service app 使用)
  },
  "onInstall": "init.js",      // 安装初始化脚本
  
  // --- 权限声明 ---
  // 必须声明，否则 API 调用会失败
  "permissions": [
    "storage",
    "notify",
    "scheduler",
    "fileWatch",
    "fileWrite",
    "ai",
    "clipboard",
    "shell",
    "network",
    // 浏览器扩展专用权限
    "extension.modify",    // 页面内容修改
    "extension.capture",   // 截图
    "extension.shortcuts"  // 快捷键
  ],
  
  // --- 后台能力配置 ---
  "background": {
    "enabled": true,
    "capabilities": ["scheduler", "fileWatch"]
  },
  
  // --- 浏览器扩展配置 ---
  "extension": {
    "sidePanel": { 
      "enabled": true, 
      "icon": "icon.png", 
      "title": "侧边栏标题" 
    },
    // 右键菜单
    "contextMenu": [
      { 
        "id": "action1", 
        "title": "处理这段文字", 
        "contexts": ["selection", "page", "image"] 
      }
    ],
    // 选中后的快捷按钮
    "selectionAction": {
      "id": "quick-act",
      "label": "快速处理",
      "icon": "⚡️"
    }
  }
}
```


## 统一点数（SDK 0.3.0）

`gemigo.points` 提供 items、purchase、receipt、grants 和 consume；仅当前托管浏览器应用可使用，登录需 points:use。详细合同与恢复示例见 [点数教程](https://docs.gemigo.io/points)。

平台钱包与体验点使用真实后台；真钱充值/作者结算尚未开通，不能把体验点等同真实收入。
