# GemiGo 应用运行时与 SDK 设计

> 面向应用开发者的运行时环境、SDK API 和开发规范

---

## 概述

GemiGo 上的应用是标准 HTML/JS 页面，但可以通过 GemiGo SDK 获得平台提供的增强能力。

```
┌─────────────────────────────────────────────────────────────┐
│                    第三方应用代码                            │
│                  (HTML / CSS / JS)                          │
└──────────────────────────┬──────────────────────────────────┘
                           ↓ 调用
┌─────────────────────────────────────────────────────────────┐
│                    GemiGo SDK                               │
│           window.gemigo.* (统一 API)                        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓ 适配
┌─────────────────┬─────────────────┬─────────────────────────┐
│   Web 运行时     │   桌面端运行时    │   扩展运行时            │
│   (iframe)      │   (webview)      │   (sidepanel)          │
│   能力受限       │   完整能力        │   部分能力              │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 一、运行时环境

### Web 平台

- **容器**：iframe (sandbox)
- **沙箱策略**：`allow-scripts allow-forms allow-same-origin`
- **限制**：无法访问上层窗口、无法弹窗、无后台运行

### 桌面端

- **容器**：Electron webview
- **能力**：通过 preload 注入完整 API
- **特权**：文件系统、后台任务、系统通知

### 浏览器扩展

- **容器**：sidepanel iframe
- **能力**：与 Web 平台类似，额外支持剪贴板

---

## 二、SDK API

### 检测运行环境

```javascript
// 获取当前平台
const platform = gemigo.platform;  // 'web' | 'desktop' | 'extension'

// 检测能力
const canSchedule = gemigo.capabilities.scheduler;  // boolean
const canWatchFiles = gemigo.capabilities.fileWatch;  // boolean
```

### 存储 API

```javascript
// 本地持久化存储（两端都支持）
await gemigo.storage.get(key);           // 获取
await gemigo.storage.set(key, value);    // 设置
await gemigo.storage.delete(key);        // 删除
await gemigo.storage.clear();            // 清空
```

**实现差异**：
- Web：localStorage
- 桌面端：应用专属文件存储

### 通知 API

```javascript
// 发送通知
await gemigo.notify({
  title: '提醒',
  body: '这是通知内容',
  actions: [
    { label: '确定', id: 'confirm' },
    { label: '取消', id: 'cancel' },
  ]
});

// 监听通知按钮点击
gemigo.onNotificationAction('confirm', () => {
  console.log('用户点击了确定');
});
```

**降级行为**：
- Web：使用浏览器 Notification API（需用户授权）
- 桌面端：系统原生通知

### 定时任务 API（仅桌面端）

```javascript
// 注册定时任务
await gemigo.scheduler.register({
  id: 'water-reminder',
  interval: '2h',              // 支持: '30m', '1h', '2h', '1d'
  startTime: '08:00',          // 可选：开始时间
  endTime: '22:00',            // 可选：结束时间
  notification: {              // 触发时发送的通知
    title: '💧 该喝水了',
    body: '距离上次已过 2 小时',
    actions: [
      { label: '喝了 +1', id: 'drink' },
      { label: '稍后提醒', id: 'snooze' },
    ]       
  }
});

// 更新任务
await gemigo.scheduler.update('water-reminder', { interval: '1h' });

// 取消任务
await gemigo.scheduler.cancel('water-reminder');

// 列出所有任务
const tasks = await gemigo.scheduler.list();
```

**Web 降级**：静默失败，返回 `{ success: false, reason: 'platform_not_supported' }`

### 文件监控 API（仅桌面端）

```javascript
// 监控文件夹
await gemigo.fileWatch.register({
  id: 'compress-downloads',
  path: '~/Downloads',
  pattern: '*.png',
  action: {
    type: 'run_tool',
    tool: 'image_compress',
    output: '~/Compressed'
  }
});

// 取消监控
await gemigo.fileWatch.cancel('compress-downloads');
```

### 文件操作 API

```javascript
// 选择文件（两端都支持）
const file = await gemigo.file.pick({
  accept: 'image/*',           // MIME 类型
  multiple: false,             // 是否多选
});

// 读取文件（桌面端支持任意路径）
const content = await gemigo.file.read('/path/to/file');

// 写入文件（仅桌面端）
await gemigo.file.write('/path/to/file', content);
```

### AI API

```javascript
// AI 对话
const response = await gemigo.ai.chat([
  { role: 'user', content: '帮我总结这段文字...' }
]);

// AI 总结
const summary = await gemigo.ai.summarize(longText);

// AI 翻译
const translated = await gemigo.ai.translate(text, { to: 'en' });
```

### 剪贴板 API

```javascript
// 读取剪贴板
const text = await gemigo.clipboard.readText();

// 写入剪贴板
await gemigo.clipboard.writeText('Hello');
```

---

## 三、能力矩阵

| API | Web | 桌面端 | 扩展 | 说明 |
|-----|-----|--------|------|------|
| `storage` | ✅ | ✅ | ✅ | 数据不互通 |
| `notify` | ⚠️ | ✅ | ⚠️ | Web/扩展需授权 |
| `scheduler` | ❌ | ✅ | ❌ | 静默失败 |
| `fileWatch` | ❌ | ✅ | ❌ | 静默失败 |
| `file.pick` | ✅ | ✅ | ✅ | 能力等价 |
| `file.read` | ⚠️ | ✅ | ⚠️ | Web 需用户选择 |
| `file.write` | ❌ | ✅ | ❌ | - |
| `ai` | ✅ | ✅ | ✅ | 云端 API |
| `clipboard` | ✅ | ✅ | ✅ | - |

---

## 四、应用清单 (manifest.json)

每个应用需要提供 manifest.json 声明基本信息和所需权限。

```json
{
  "name": "喝水提醒",
  "version": "1.0.0",
  "description": "每隔一段时间提醒你喝水",
  
  "type": "hybrid",           // 'ui' | 'hybrid' | 'service'
  
  "platforms": [              // 支持的平台
    "web",
    "desktop"
  ],
  
  "ui": {
    "main": "index.html",     // 主界面
    "settings": "settings.html"  // 设置界面（可选）
  },
  
  "onInstall": "init.js",     // 安装时执行（可选）
  
  "permissions": [            // 所需权限
    "storage",
    "notification",
    "scheduler"
  ],
  
  "background": {             // 后台能力（可选）
    "enabled": true,
    "capabilities": ["scheduler", "notification"]
  }
}
```

### 应用类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `ui` | 纯界面应用 | AA 分账、GPA 计算器 |
| `hybrid` | 界面 + 后台 | 喝水提醒、背单词 |
| `service` | 纯后台服务 | 文件夹自动压缩 |

---

## 五、应用生命周期

### 安装

```
用户点击"安装"
    ↓
平台下载应用文件
    ↓
验证 manifest.json
    ↓
请求用户确认权限
    ↓
执行 onInstall（如有）
    ↓
应用安装完成
```

### 运行

```
用户打开应用
    ↓
平台创建 iframe/webview 容器
    ↓
注入 GemiGo SDK
    ↓
加载应用 HTML
    ↓
应用代码调用 gemigo.* API
```

### 卸载

```
用户点击"卸载"
    ↓
停止所有后台任务
    ↓
询问是否保留数据
├── 保留：仅清理任务
└── 删除：清理任务 + 数据
    ↓
从列表移除
```

---

## 六、开发指南

### 快速开始

```html
<!DOCTYPE html>
<html>
<head>
  <title>我的应用</title>
</head>
<body>
  <h1>Hello GemiGo!</h1>
  <button id="btn">发送通知</button>

  <script>
    document.getElementById('btn').onclick = async () => {
      await gemigo.notify({
        title: '你好',
        body: '这是来自应用的通知'
      });
    };
  </script>
</body>
</html>
```

### 检测平台并降级

```javascript
async function init() {
  // 通用功能
  const data = await gemigo.storage.get('myData') || {};
  
  // 桌面专属功能
  if (gemigo.platform === 'desktop') {
    await gemigo.scheduler.register({
      id: 'reminder',
      interval: '1h',
      notification: { title: '记得打卡' }
    });
  } else {
    // Web 端提示
    showMessage('下载桌面端以获得后台提醒功能');
  }
}
```

### 最佳实践

1. **渐进增强** - 核心功能在 Web 也能用，桌面端提供增强体验
2. **权限最小化** - 只申请必要的权限
3. **优雅降级** - 检测平台，对不支持的功能给出提示
4. **响应式设计** - 适配不同容器尺寸
