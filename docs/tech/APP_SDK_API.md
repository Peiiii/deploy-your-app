# GemiGo SDK API 参考

> GemiGo 平台的完整 JavaScript API 文档

---

## 📚 目录

1. [通用 API](#通用-api)
   - [Environment 环境](#environment)
   - [Storage 存储](#storage)
   - [Notify 通知](#notify)
   - [AI 人工智能](#ai)
   - [Clipboard 剪贴板](#clipboard)
   - [File 文件 (基础)](#file-基础)
2. [桌面端 API](#桌面端-api)
   - [Scheduler 定时任务](#scheduler)
   - [FileWatch 文件监控](#filewatch)
   - [File 文件 (高级)](#file-高级)
3. [浏览器扩展 API](#浏览器扩展-api)
   - [Extension 扩展交互](#extension)
4. [应用清单规范 (Manifest)](#应用清单规范-manifest)

---

## <a id="通用-api"></a>1. 通用 API

所有平台均支持的基础能力。

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
- **说明**: 读取剪贴板文本。需用户授权。

#### `gemigo.clipboard.writeText(text)`
- **参数**: `text: string`
- **返回**: `Promise<void>`
- **说明**: 写入文本到剪贴板。

---

### <a id="file-基础"></a>File 文件 (基础)

#### `gemigo.file.pick(options)`
- **参数**:
  - `options`:
    - `accept`: `string` (MIME 类型，如 `'image/*'`)
    - `multiple`: `boolean` (默认 `false`)
- **返回**: `Promise<File | File[] | null>`
- **说明**: 弹出系统文件选择框。

#### `gemigo.file.read(path)`
- **参数**: `path: string`
- **返回**: `Promise<ArrayBuffer | string>`
- **Web 端限制**: 只能读取用户刚刚通过 `pick` 选中的文件。

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

### <a id="file-高级"></a>File 文件 (高级)

#### `gemigo.file.write(path, data)`
- **参数**:
  - `path`: `string` (绝对路径)
  - `data`: `string | ArrayBuffer`
- **返回**: `Promise<void>`
- **说明**: 写入文件到系统任意位置。需声明 `permissions: ['fileWrite']`。

---

## <a id="浏览器扩展-api"></a>3. 浏览器扩展 API

⚠️ **注意**：仅在 `gemigo.platform === 'extension'` 时可用。

### <a id="extension"></a>Extension 扩展交互

#### `gemigo.extension.onContextMenu(menuId, callback)`
- **参数**:
  - `menuId`: `string` (manifest 中定义的 id)
  - `callback`: `(data: { text, pageUrl, pageTitle }) => Promise<any>`
- **说明**: 处理右键菜单点击。

#### `gemigo.extension.onSelectionAction(actionId, callback)`
- **说明**: 处理选中浮窗按钮点击。

#### `gemigo.extension.getPageInfo()`
- **返回**: `Promise<{ url: string, title: string, selection: string }>`
- **说明**: 获取当前激活标签页的信息。

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
    "clipboard"
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
