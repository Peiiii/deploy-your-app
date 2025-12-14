# GemiGo 应用运行时

> 应用在各平台如何被加载、运行和管理

---

## 概述

GemiGo 应用本质是 HTML/JS 页面，运行在平台提供的沙箱容器中。

```
┌─────────────────────────────────────────────────────────────┐
│                     应用代码 (HTML/JS)                       │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     GemiGo 运行时                            │
│  • 加载应用代码                                              │
│  • 注入 SDK                                                  │
│  • 管理生命周期                                              │
│  • 提供沙箱隔离                                              │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────┬─────────────────┬─────────────────────────┐
│   Web 容器       │   桌面端容器     │   扩展容器              │
│   (iframe)      │   (webview)      │   (sidepanel)          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 一、Web 平台运行时

### 容器：iframe

```html
<!-- 平台页面 -->
<div class="app-container">
  <iframe
    id="app-frame"
    src="https://r2.gemigo.app/apps/{appId}/index.html"
    sandbox="allow-scripts allow-forms allow-same-origin"
  ></iframe>
</div>
```

### 沙箱策略

| 权限 | 是否允许 | 说明 |
|------|---------|------|
| `allow-scripts` | ✅ | 允许 JS 执行 |
| `allow-forms` | ✅ | 允许表单提交 |
| `allow-same-origin` | ✅ | 允许 localStorage |
| `allow-top-navigation` | ❌ | 禁止跳转父窗口 |
| `allow-popups` | ❌ | 禁止弹窗 |

### SDK 注入

```javascript
// 平台在 iframe onload 时注入 SDK
const iframe = document.getElementById('app-frame');
iframe.onload = () => {
  const script = iframe.contentDocument.createElement('script');
  script.src = '/gemigo-sdk-web.js';
  iframe.contentDocument.head.appendChild(script);
};
```

### SDK 实现（Web 版）

```typescript
// gemigo-sdk-web.js
const gemigoSDK = {
  platform: 'web',
  
  capabilities: {
    scheduler: false,
    fileWatch: false,
    fileWrite: false,
    notification: Notification.permission === 'granted',
  },
  
  storage: {
    async get(key) {
      const data = localStorage.getItem(`gemigo:${key}`);
      return data ? JSON.parse(data) : null;
    },
    async set(key, value) {
      localStorage.setItem(`gemigo:${key}`, JSON.stringify(value));
    },
    async delete(key) {
      localStorage.removeItem(`gemigo:${key}`);
    },
    async clear() {
      Object.keys(localStorage)
        .filter(k => k.startsWith('gemigo:'))
        .forEach(k => localStorage.removeItem(k));
    },
  },
  
  async notify(options) {
    if (Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body });
      return { success: true };
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(options.title, { body: options.body });
        return { success: true };
      }
    }
    return { success: false, reason: 'permission_denied' };
  },
  
  scheduler: {
    async register() {
      return { success: false, reason: 'platform_not_supported' };
    },
    async cancel() {
      return { success: false, reason: 'platform_not_supported' };
    },
  },
  
  file: {
    async pick(options) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = options?.accept || '*';
        input.multiple = options?.multiple || false;
        input.onchange = () => {
          resolve(options?.multiple ? Array.from(input.files) : input.files[0]);
        };
        input.click();
      });
    },
  },
  
  ai: {
    async chat(messages) {
      const response = await fetch('https://api.gemigo.app/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
      return response.json();
    },
  },
  
  clipboard: {
    async readText() {
      return navigator.clipboard.readText();
    },
    async writeText(text) {
      await navigator.clipboard.writeText(text);
    },
  },
};

window.gemigo = gemigoSDK;
```

---

## 二、桌面端运行时

### 容器：Electron webview

```html
<!-- Electron 渲染进程 -->
<webview
  id="app-view"
  src="app://{appId}/index.html"
  preload="preload.js"
  webpreferences="contextIsolation=yes"
></webview>
```

### 通过 preload 注入 API

```typescript
// preload.js - Electron preload 脚本
import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的原生 API
const nativeAPI = {
  platform: 'desktop',
  
  capabilities: {
    scheduler: true,
    fileWatch: true,
    fileWrite: true,
    notification: true,
  },
  
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('storage:delete', key),
    clear: () => ipcRenderer.invoke('storage:clear'),
  },
  
  notify: (options) => ipcRenderer.invoke('notify', options),
  
  scheduler: {
    register: (config) => ipcRenderer.invoke('scheduler:register', config),
    update: (id, config) => ipcRenderer.invoke('scheduler:update', id, config),
    cancel: (id) => ipcRenderer.invoke('scheduler:cancel', id),
    list: () => ipcRenderer.invoke('scheduler:list'),
  },
  
  fileWatch: {
    register: (config) => ipcRenderer.invoke('fileWatch:register', config),
    cancel: (id) => ipcRenderer.invoke('fileWatch:cancel', id),
  },
  
  file: {
    pick: (options) => ipcRenderer.invoke('file:pick', options),
    read: (path) => ipcRenderer.invoke('file:read', path),
    write: (path, data) => ipcRenderer.invoke('file:write', path, data),
  },
  
  ai: {
    chat: (messages) => ipcRenderer.invoke('ai:chat', messages),
    summarize: (text) => ipcRenderer.invoke('ai:summarize', text),
    translate: (text, options) => ipcRenderer.invoke('ai:translate', text, options),
  },
  
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  },
};

contextBridge.exposeInMainWorld('gemigo', nativeAPI);

// 注册事件监听
ipcRenderer.on('notification:action', (_, actionId) => {
  window.dispatchEvent(new CustomEvent('gemigo:notification:action', { detail: actionId }));
});
```

### 主进程服务实现

```typescript
// main/scheduler.ts
import { ipcMain, Notification } from 'electron';
import schedule from 'node-schedule';

class SchedulerService {
  private jobs = new Map<string, schedule.Job>();
  
  constructor() {
    ipcMain.handle('scheduler:register', (_, config) => this.register(config));
    ipcMain.handle('scheduler:cancel', (_, id) => this.cancel(id));
    ipcMain.handle('scheduler:list', () => this.list());
  }
  
  async register(config) {
    const job = schedule.scheduleJob(this.toCron(config.interval), () => {
      if (this.inTimeRange(config.startTime, config.endTime)) {
        if (config.notification) {
          const notification = new Notification(config.notification);
          notification.show();
        }
      }
    });
    
    this.jobs.set(config.id, job);
    await this.persist();
    return { success: true };
  }
  
  // ... 其他方法
}
```

---

## 三、浏览器扩展运行时

### 容器：Side Panel iframe

```html
<!-- sidepanel.html -->
<div id="app-container">
  <iframe
    id="app-frame"
    src="https://r2.gemigo.app/apps/{appId}/index.html"
    sandbox="allow-scripts allow-forms allow-same-origin"
  ></iframe>
</div>
```

### SDK 注入（扩展版）

```typescript
// content-script.js or sidepanel.js
const gemigoSDK = {
  platform: 'extension',
  
  capabilities: {
    scheduler: false,
    fileWatch: false,
    fileWrite: false,
    notification: true,
  },
  
  storage: {
    async get(key) {
      const result = await chrome.storage.local.get(`gemigo:${key}`);
      return result[`gemigo:${key}`] || null;
    },
    async set(key, value) {
      await chrome.storage.local.set({ [`gemigo:${key}`]: value });
    },
  },
  
  async notify(options) {
    chrome.notifications.create({
      type: 'basic',
      title: options.title,
      message: options.body || '',
      iconUrl: options.icon || 'icon.png',
    });
    return { success: true };
  },
  
  extension: {
    async getPageInfo() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { url: tab.url, title: tab.title };
    },
    
    onContextMenu(menuId, callback) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'contextMenu' && message.menuId === menuId) {
          callback(message.data);
        }
      });
    },
  },
  
  // ... 其他 API
};
```

### 扩展能力实现详解

#### 1. 动态菜单注册 (Background Script)

扩展在启动或安装新应用时，读取所有应用的 manifest 并注册菜单。

```typescript
// background.js
async function updateContextMenus() {
  await chrome.contextMenus.removeAll();
  const apps = await getInstalledApps();
  
  apps.forEach(app => {
    if (app.manifest.extension?.contextMenu) {
      app.manifest.extension.contextMenu.forEach(item => {
        chrome.contextMenus.create({
          id: `${app.id}:${item.id}`, // 组合 ID：应用ID:菜单ID
          title: item.title,
          contexts: item.contexts,
          parentId: 'root-menu'     // 统一归类在 GemiGo 主菜单下
        });
      });
    }
  });
}
```

#### 2. 事件路由与应用唤醒

当用户点击菜单时，Background Script 负责：
1. 解析出目标应用 ID。
2. 检查应用是否正在运行（是否有活跃的 Side Panel 或 iframe）。
3. 如果未运行，先在隐藏的 Offscreen Document 中启动应用运行时。
4. 发送消息给应用。

```typescript
// background.js
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const [appId, menuId] = info.menuItemId.split(':');
  
  // 准备数据
  const eventData = {
    type: 'contextMenu',
    menuId: menuId,
    data: {
      text: info.selectionText,
      pageUrl: tab.url,
      pageTitle: tab.title
    }
  };
  
  // 尝试发送给活跃的应用实例
  const sent = await sendMessageToApp(appId, eventData);
  
  // 如果发送失败（应用未运行），则启动 Offscreen Document 处理
  if (!sent) {
    await createOffscreenDocument(appId);
    await sendMessageToApp(appId, eventData);
    // 处理完后设定超时自动关闭 Offscreen
  }
});
```

#### 3. Offscreen Document (后台运行环境)

对于不需要界面的操作（如"保存到笔记"），我们使用 Chrome 的 Offscreen API 提供临时的 DOM 环境来运行应用逻辑。

```typescript
// offscreen.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target === 'offscreen') {
    // 加载应用 iframe
    const iframe = document.createElement('iframe');
    iframe.src = getAppUrl(msg.appId);
    document.body.appendChild(iframe);
    
    // iframe 加载后转发消息给它
    iframe.onload = () => {
      iframe.contentWindow.postMessage(msg.data, '*');
    };
  }
});
```

---

## 四、应用生命周期

### 安装

```
用户点击"安装"
    ↓
平台下载 manifest.json
    ↓
验证权限声明
    ↓
用户确认权限
    ↓
下载应用文件（或记录 URL）
    ↓
执行 onInstall 脚本（如果有）
    ↓
注册后台任务（如果声明了）
    ↓
安装完成
```

### 启动

```
用户打开应用
    ↓
创建容器（iframe/webview）
    ↓
加载应用 HTML
    ↓
注入 SDK
    ↓
触发应用 DOMContentLoaded
    ↓
应用运行中
```

### 卸载

```
用户点击"卸载"
    ↓
停止后台任务
    ↓
询问是否保留数据
    ↓
清理存储（可选）
    ↓
从列表移除
```

---

## 五、应用清单 (manifest.json)

```json
{
  "name": "喝水提醒",
  "version": "1.0.0",
  "description": "定时提醒你喝水",
  
  "type": "hybrid",
  
  "platforms": ["web", "desktop"],
  
  "ui": {
    "main": "index.html",
    "settings": "settings.html"
  },
  
  "onInstall": "init.js",
  
  "permissions": [
    "storage",
    "notification",
    "scheduler"
  ],
  
  "background": {
    "enabled": true,
    "capabilities": ["scheduler", "notification"]
  },
  
  "extension": {
    "contextMenu": [
      { "id": "quick-drink", "title": "记录喝水" }
    ],
    "sidePanel": {
      "enabled": true,
      "icon": "💧",
      "title": "喝水提醒"
    }
  }
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 应用名称 |
| `version` | ✅ | 版本号 |
| `type` | ✅ | `ui` / `hybrid` / `service` |
| `platforms` | ✅ | 支持的平台 |
| `ui.main` | - | 主界面入口 |
| `onInstall` | - | 安装时执行的脚本 |
| `permissions` | - | 所需权限 |
| `background` | - | 后台能力声明 |
| `extension` | - | 浏览器扩展能力 |

---

## 六、安全机制

### 沙箱隔离

- 每个应用运行在独立的 iframe/webview 中
- 无法访问宿主页面 DOM
- 无法访问其他应用的数据
- 只能通过 SDK API 与平台交互

### 权限控制

- 应用必须在 manifest 中声明所需权限
- 用户安装时确认权限
- API 调用时验证权限

```typescript
// 平台验证权限
function handleSchedulerRegister(appId, config) {
  const app = getInstalledApp(appId);
  if (!app.manifest.permissions.includes('scheduler')) {
    return { success: false, reason: 'permission_denied' };
  }
  // ... 执行注册
}
```

### 数据隔离

- 每个应用的 storage 数据相互隔离
- 使用 `gemigo:{appId}:{key}` 作为存储键
- 卸载时可选择删除数据
