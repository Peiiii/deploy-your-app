# GemiGo Browser Extension Platform - Feature Design

## Vision
一个运行在浏览器侧边栏中的应用平台，用户可以将平台上部署的任意应用"安装"到这个环境中，这些应用自动获得与浏览器交互的能力。

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Chrome Browser                                                             │
├─────────────────────────────────────────┬──────────────────────────────────┤
│                                         │        GemiGo Side Panel         │
│                                         │  ┌────────────────────────────┐  │
│                                         │  │ 🏠 首页  📦 应用  ⚙️ 设置  │  │
│          当前网页内容                    │  ├────────────────────────────┤  │
│                                         │  │                            │  │
│     (App 可通过 SDK 读取/操作)          │  │   [ 嵌入的 App 内容 ]       │  │
│                                         │  │   (iframe 加载已部署应用)   │  │
│                                         │  │                            │  │
│                                         │  │                            │  │
└─────────────────────────────────────────┴──────────────────────────────────┘
                      │                                    │
                      │          postMessage               │
                      ▼                                    ▼
              ┌───────────────┐                   ┌─────────────────┐
              │ Content Script │◄────────────────►│ Extension Core  │
              │ (页面注入脚本)  │                   │ (Service Worker)│
              └───────────────┘                   └─────────────────┘
                                                          ▲
                                                          │
                                                  ┌───────┴───────┐
                                                  │   GemiGo SDK  │
                                                  │ (注入到 App)   │
                                                  └───────────────┘
```

---

## 核心组件

### 1. Side Panel (主界面)
Chrome 原生侧边栏，作为应用的运行容器。

| 区域 | 功能 |
|------|------|
| **顶部导航** | 首页 / 应用列表 / 设置 |
| **应用区域** | iframe 加载当前激活的应用 |
| **底部工具栏** | 快捷操作、通知、登录状态 |

### 2. App Runtime
管理应用的加载、生命周期和权限。

```typescript
interface AppManifest {
  id: string;
  name: string;
  url: string;           // 部署的应用 URL
  icon: string;
  permissions: Permission[];  // 请求的能力
}

type Permission = 
  | 'page:read'          // 读取当前页面内容
  | 'page:modify'        // 修改页面 DOM
  | 'contextMenu'        // 右键菜单
  | 'notifications'      // 通知
  | 'storage'            // 本地存储
  | 'clipboard'          // 剪贴板
  | 'tabs';              // 标签页操作
```

### 3. SDK (`@gemigo/extension-sdk`)
注入到 App iframe 中，提供与扩展通信的桥梁。

```typescript
// 示例 API
const gemigo = window.gemigo;

// 读取当前页面
const pageContent = await gemigo.page.getContent();
const selection = await gemigo.page.getSelection();

// 右键菜单
gemigo.contextMenu.register({
  id: 'my-action',
  title: 'Process with MyApp',
  contexts: ['selection'],
  onClick: (info) => { /* ... */ }
});

// 通知
gemigo.notifications.show({ title: 'Done!', message: '...' });

// 存储
await gemigo.storage.set('key', value);
const data = await gemigo.storage.get('key');

// 事件监听
gemigo.events.on('page:changed', (url) => { /* ... */ });
```

---

## 通信机制

```
┌──────────────┐   postMessage   ┌──────────────┐   chrome.* API   ┌──────────────┐
│   App (iframe)│ ◄────────────► │  Side Panel  │ ◄──────────────► │   Browser    │
│   + SDK       │                │  (Host)      │                  │   APIs       │
└──────────────┘                 └──────────────┘                  └──────────────┘
                                        │
                                        │ chrome.tabs.sendMessage
                                        ▼
                                 ┌──────────────┐
                                 │Content Script│ ───► 当前页面 DOM
                                 └──────────────┘
```

**安全边界**：
- App 在 iframe 沙箱中运行，无法直接访问 chrome.* API
- 所有能力请求必须通过 SDK → Host → Service Worker 转发
- Host 根据 App Manifest 中声明的权限进行校验

---

## 用户流程

### 安装应用
1. 用户在平台上部署了一个应用
2. 应用详情页显示"添加到浏览器扩展"按钮
3. 点击后，应用的 Manifest 同步到扩展的本地存储
4. 侧边栏应用列表中出现新应用

### 使用应用
1. 用户打开侧边栏
2. 点击应用图标 → iframe 加载应用 URL
3. 应用内的 SDK 自动初始化，建立与 Host 的连接
4. 应用可以读取当前页面内容、注册右键菜单等

---

## 权限模型

| 权限 | 风险等级 | 授权方式 |
|------|----------|----------|
| `storage` | 低 | 默认授予 |
| `notifications` | 低 | 默认授予 |
| `page:read` | 中 | 首次使用时提示 |
| `page:modify` | 高 | 明确用户确认 |
| `tabs` | 高 | 明确用户确认 |

---

## 技术实现

### 目录结构
```
browser-extension/
├── manifest.json
├── sidepanel/           # Side Panel 主界面
│   ├── index.html
│   └── app.tsx          # React 应用
├── background/          # Service Worker
│   ├── index.ts
│   ├── app-runtime.ts   # App 生命周期管理
│   └── permission.ts    # 权限校验
├── content-scripts/     # 页面注入脚本
│   └── bridge.ts        # 页面操作桥接
├── sdk/                 # @gemigo/extension-sdk
│   └── index.ts         # 注入到 App 的 SDK
└── shared/
    └── types.ts
```

### 技术栈
- **Manifest V3** (Chrome 推荐标准)
- **React + TypeScript** (与主项目一致)
- **Vite** 构建 (作为 monorepo 的一部分)

---

## 分阶段里程碑

### Phase 1: 基础框架
- [ ] Side Panel 基础 UI (应用列表 + 导航)
- [ ] App iframe 加载机制
- [ ] SDK 基础通信 (postMessage)
- [ ] 用户登录/同步应用列表

### Phase 2: 核心能力
- [ ] `page:read` - 读取页面内容
- [ ] `storage` - 本地存储
- [ ] `notifications` - 通知推送
- [ ] 权限请求弹窗

### Phase 3: 高级交互
- [ ] `contextMenu` - 右键菜单注册
- [ ] `page:modify` - 页面 DOM 操作
- [ ] `tabs` - 标签页操作
- [ ] 应用间通信

### Phase 4: 生态
- [ ] 应用市场展示 (侧边栏内)
- [ ] 一键安装按钮 (网页端)
- [ ] 开发者文档 & SDK 发布
