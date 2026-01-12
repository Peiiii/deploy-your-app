# GemiGo 开发者指南

> 构建一次，随处运行的 AI 增强应用

---

## 📚 目录

1. [简介](#简介)
2. [核心概念](#核心概念)
   - [三种应用形态](#三种应用形态)
   - [渐进增强](#渐进增强)
   - [云端托管 (Gemigo Cloud)](#云端托管-gemigo-cloud)
3. [快速开始 (Hello World)](#快速开始)
4. [教程示例](#教程示例)
   - [示例 1：极简记事本 (Web/全平台)](#示例-1极简记事本)
   - [示例 2：喝水提醒 (桌面端增强)](#示例-2喝水提醒)
   - [示例 3：翻译助手 (AI + 浏览器扩展)](#示例-3翻译助手)
5. [最佳实践](#最佳实践)

> 🔍 需要查看 API 详情？请查阅 [API 参考文档](./APP_SDK_API.md)

---

## <a id="简介"></a>1. 简介

**GemiGo 应用**本质上是标准的 Web 应用（HTML/CSS/JS），但拥有原生桌面能力和 AI 增强能力。

**为什么选择 GemiGo？**
- **简单**：只用写 HTML/JS，无需学习 Electron 或 Swift。
- **强大**：通过 `window.gemigo` 调用文件系统、后台任务、AI 模型。
- **跨端**：一套代码同时运行在网页、桌面端和浏览器扩展中。

---

## <a id="核心概念"></a>2. 核心概念

### <a id="三种应用形态"></a>三种应用形态

| 类型 | 说明 | 典型例子 | 适用平台 |
|------|------|----------|----------|
| **UI App** | 普通 Web 应用，无后台 | 计算器、记事本 | Web, Desktop |
| **Hybrid App** | 有界面也有后台任务 | 时钟、番茄钟 | Web(仅界面), Desktop(全功能) |
| **Service App** | 无主界面，纯后台运行 | 文件整理自动脚本 | Desktop |

### <a id="渐进增强"></a>渐进增强

GemiGo 鼓励一套代码适应所有平台。你应该先实现核心功能，再检测平台能力进行增强。

**原则**：
1. **核心优先**：保证应用在 Web 端也能提供基础价值。
2. **能力检测**：使用前检查 `gemigo.capabilities`。
3. **优雅降级**：如果不支持某能力，给用户友好的提示。

```javascript
// 示例：文件保存功能
if (gemigo.capabilities.fileWrite) {
  // 桌面端：直接写入文件系统
  await gemigo.file.write('/path/to/log.txt', content);
} else {
  // Web 端：提供下载链接
  downloadFile('log.txt', content);
}
```

### <a id="云端托管-gemigo-cloud"></a>云端托管 (Gemigo Cloud)

如果你的应用需要：

- **跨设备恢复数据**（用户换设备/清缓存后数据还在）
- **共享/社区数据**（帖子/评论/点赞等）

请使用 `gemigo.cloud`（平台托管后端能力），而不是仅使用 `gemigo.storage`。

约定：

- `gemigo.storage.*`：本地/宿主存储（轻量、离线友好，但不保证跨设备）
- `gemigo.cloud.*`：云端托管（需要登录 + scopes）

使用 `gemigo.cloud` 的最小流程：

1) 触发登录（必须在用户点击事件里调用，避免弹窗被拦截）：

```js
await gemigo.auth.login({
  // 按需申请 scopes（最小权限）。如果你的应用用不到 blob/functions，可以不申请。
  scopes: ['identity:basic', 'storage:rw', 'db:rw', 'blob:rw', 'functions:invoke'],
});
```

2) 用户私有数据（KV）：

```js
await gemigo.cloud.kv.set('settings/theme', { mode: 'dark' });
const theme = await gemigo.cloud.kv.get('settings/theme');
```

3) 社区/共享数据（集合/文档）：

```js
const posts = gemigo.cloud.db.collection('posts');
await posts.add({ title: 'Hello', body: 'First post', visibility: 'public' });
const feed = await posts.query().where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(20).get();
```

小程序（`wx.cloud`）风格写法（推荐，心智更一致）：

```js
const db = gemigo.cloud.database();
const _ = db.command;

const posts = db.collection('posts');
await posts.add({ data: { title: 'Hello', body: 'First post', createdAt: db.serverDate() } });
const first = await posts.where({ visibility: _.eq('public') }).orderBy('createdAt', 'desc').limit(20).get();
const feed = first.data;

// cursor-first（推荐）：用 `_meta.nextCursor` 翻下一页（比大 skip 更稳定）
const cursor = first._meta?.nextCursor;
if (cursor) {
  const second = await posts.where({ visibility: _.eq('public') }).orderBy('createdAt', 'desc').limit(20).startAfter(cursor).get();
  console.log('page2', second.data);
}

// 批量能力（对齐小程序 where().count/update/remove）
const total = await posts.where({ visibility: _.eq('public') }).count();
await posts.where({ _id: _.eq('some-id') }).update({ data: { views: _.inc(1) } });
await posts.where({ _id: _.eq('some-id') }).remove();
```

说明：

- `kv` 默认按“应用 + 当前登录用户”隔离（天然是用户私有数据）。
- `db` 的默认行为对齐微信 legacy：默认仅创建者可读写（`creator_read_write`）；若要做“公开广场/社区”，请配置 Security Rules（建议用模板规则）。

如果你要做“作者主页 / 浏览某个用户发过的公开内容”，需要为该 collection 配置 Security Rules（例如“public 可读 + 自己可写”的模板），然后在查询里带上规则分支的等值条件（例如 `visibility='public'`）：

```js
const authorPosts = await posts
  .query()
  .where('ownerId', '==', someAppUserId)
  .where('visibility', '==', 'public')
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get();
```

4) 上传图片/附件（Blob，适合头像/封面/帖子图片等）：

```js
const { fileId, uploadUrl } = await gemigo.cloud.blob.createUploadUrl({
  path: `posts/${crypto.randomUUID()}.png`,
  visibility: 'public',
  contentType: 'image/png',
});
await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: fileBlob });
// 把 fileId 存到你的文档里（如 posts/avatars/...）
```

展示图片（返回的是短时 URL，可直接用于 `<img src=...>`）：

```js
const { url } = await gemigo.cloud.blob.getDownloadUrl({ fileId });
```

5) 云函数（Functions，平台托管计算/RPC）：

```js
const ping = await gemigo.cloud.functions.call('cloud.ping');
```

---

## <a id="快速开始"></a>3. 快速开始

创建一个文件夹 `my-first-app`，在里面新建两个文件：

**manifest.json** (配置文件)
```json
{
  "name": "Hello GemiGo",
  "version": "1.0.0",
  "type": "ui",
  "platforms": ["web", "desktop"],
  "permissions": ["notify"]
}
```

**index.html** (应用代码)
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Hello GemiGo 👋</h1>
  <button id="btn">发送通知</button>
  
  <script>
    document.getElementById('btn').onclick = async () => {
      // 调用 GemiGo API
      await gemigo.notify({ 
        title: '你好！', 
        body: '这是我的第一个 GemiGo 应用' 
      });
    };
  </script>
</body>
</html>
```

---

## <a id="教程示例"></a>4. 教程示例

### <a id="示例-1极简记事本"></a>示例 1：极简记事本

**涉及能力**：`storage` (全平台支持)

此应用可以保存用户的笔记，即使关闭浏览器或重启电脑数据依然存在。使用 `gemigo.storage` 而不是 `localStorage` 的好处是它在不同环境（如扩展）中表现一致且更安全。

```html
<!-- index.html -->
<style>
  textarea { width: 100%; height: 200px; }
</style>

<textarea id="note" placeholder="写点什么..."></textarea>
<p id="status"></p>

<script>
  const note = document.getElementById('note');
  const status = document.getElementById('status');

  // 1. 加载保存的数据
  async function load() {
    const saved = await gemigo.storage.get('my-note');
    if (saved) note.value = saved;
  }

  // 2. 自动保存
  note.addEventListener('input', async () => {
    status.innerText = '保存中...';
    await gemigo.storage.set('my-note', note.value);
    status.innerText = '已保存';
  });

  load();
</script>
```

### <a id="示例-2喝水提醒"></a>示例 2：喝水提醒

**涉及能力**：`scheduler` (桌面端), `notify`

此应用展示了**Hybrid App**的特性：在桌面端注册后台任务，每小时提醒喝水，即使应用界面关闭了也能运行；在 Web 端则提示用户下载桌面版。

**manifest.json**
```json
{
  "name": "喝水提醒",
  "type": "hybrid",
  "permissions": ["scheduler", "notify"],
  "background": {
    "capabilities": ["scheduler"]
  }
}
```

**index.html**
```html
<button id="start-btn">开启提醒 (每小时)</button>

<script>
  document.getElementById('start-btn').onclick = async () => {
    
    // 1. 检查能力（渐进增强）
    if (!gemigo.capabilities.scheduler) {
      alert('请下载 GemiGo 桌面端以使用后台提醒功能！');
      return;
    }

    // 2. 注册后台任务
    const result = await gemigo.scheduler.register({
      id: 'water-reminder-job',
      interval: '1h', // 使用简单的时间描述
      notification: {
        title: '💧 该喝水了',
        body: '保持健康，多喝水！',
        actions: [{ id: 'drink', label: '喝了' }]
      }
    });

    if (result.success) {
      alert('提醒已开启！即使关闭应用窗口也会生效。');
    }
  };
  
  // 3. 监听通知按钮点击
  window.addEventListener('gemigo:notification:action', (e) => {
    if (e.detail === 'drink') {
      console.log('用户喝水了 +1');
      // 这里可以记录喝水数据到 storage
    }
  });
</script>
```

### <a id="示例-3翻译助手"></a>示例 3：翻译助手

**涉及能力**：`ai` (全平台), `extension` (浏览器扩展)

此应用展示了如何利用 **AI 能力** 和 **浏览器扩展集成**。它既可以在网页中使用，也可以作为浏览器扩展，在用户浏览其他网页时通过右键菜单调用。

**manifest.json**
```json
{
  "name": "AI 翻译",
  "permissions": ["ai"],
  "extension": {
    // 注册右键菜单
    "contextMenu": [
      { 
        "id": "trans", 
        "title": "用 AI 翻译", 
        "contexts": ["selection"] // 仅在选中文字时显示
      }
    ]
  }
}
```

**index.html**
```html
<div id="history"></div>

<script>
  // 通用翻译函数
  async function translate(text) {
    // 调用平台内置大模型，不仅免费而且无需配置 Key
    const res = await gemigo.ai.chat([
      { role: 'user', content: `翻译成中文: ${text}` }
    ]);
    return res.content;
  }

  // 1. 处理来自浏览器扩展的调用
  if (gemigo.platform === 'extension') {
    gemigo.extension.onContextMenu('trans', async (data) => {
      const translation = await translate(data.text);
      
      // 发送通知显示结果
      await gemigo.notify({ title: '翻译结果', body: translation });
      
      // 记录历史
      saveHistory(data.text, translation);
    });
  }
  
  // ... saveHistory 实现省略
</script>
```

---

## <a id="最佳实践"></a>5. 最佳实践

### 权限最小化

只在 `manifest.json` 中申请你真正需要的权限。用户安装时会看到权限列表，过多的权限申请会降低用户的信任度。

### 处理异步操作

所有 SDK API 都是异步的（返回 Promise）。务必使用 `async/await` 或 `.then()` 处理。

```javascript
// ❌ 错误
const data = gemigo.storage.get('key');
console.log(data); // Promise { <pending> }

// ✅ 正确
const data = await gemigo.storage.get('key');
console.log(data); // 'value'
```

### 平台兼容性

不要假设应用一定运行在桌面端。如果使用了特定平台的能力（如 `scheduler`），一定要先检查 `gemigo.capabilities`，并为不支持的环境提供替代方案或提示。
