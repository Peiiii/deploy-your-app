# GemiGo 平台开发指南 (For AI Coding Agents)

> 本文档供 AI Coding Agent（如 Cursor、Windsurf、Claude、Cline 等）使用。  
> 用户可将本文档复制给 AI Agent，帮助其快速理解 GemiGo 平台并开发可部署的应用。

---

## 🌐 平台简介

**GemiGo** 是一个面向非专业用户的前端应用一键部署平台。

- **官网**: https://gemigo.io
- **核心能力**: 将 GitHub 仓库、ZIP 文件或 HTML 代码快速部署为可访问的 Web 应用
- **托管**: 自动部署到 Cloudflare，享受全球 CDN 加速

### 部署方式

| 方式 | 说明 |
|------|------|
| **GitHub 仓库** | 粘贴仓库 URL，自动克隆、构建、部署 |
| **ZIP 文件** | 上传 ZIP 压缩包，自动解压部署 |
| **HTML 代码** | 直接粘贴 HTML/CSS/JS 代码，即时部署 |

---

## 🧩 浏览器插件 SDK

GemiGo 提供了一个浏览器扩展 SDK，允许应用在浏览器侧边栏中运行，并与网页进行深度交互。

### SDK 引入方式

在 HTML 中通过 CDN 引入（推荐 unpkg）：

```html
<!-- 使用最新版本 -->
<script src="https://unpkg.com/@gemigo/app-sdk/dist/gemigo-app-sdk.umd.js"></script>

<!-- 或指定版本号 -->
<script src="https://unpkg.com/@gemigo/app-sdk@0.2.5/dist/gemigo-app-sdk.umd.js"></script>
```

> **注意**: 如果应用部署在 GemiGo 浏览器扩展中运行，也可以使用本地路径 `/sdk/gemigo-app-sdk.umd.js`（扩展会自动提供）。

SDK 会在 `window.gemigo` 上暴露全局对象。

---

## � TypeScript 类型定义

如果你的项目使用 TypeScript，可以直接使用以下类型定义：

```typescript
// gemigo-sdk.d.ts

// ============================================================================
// Extension API Types
// ============================================================================

interface PageInfo {
  url: string;
  title: string;
  favIconUrl?: string;
}

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionResult {
  text: string;
  rect: SelectionRect | null;
}

interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

interface LinkInfo {
  href: string;
  text: string;
  title?: string;
}

interface ImageInfo {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface HighlightResult {
  success: boolean;
  count?: number;
  highlightId?: string;
  error?: string;
}

interface WidgetResult {
  success: boolean;
  widgetId?: string;
  error?: string;
}

interface CSSResult {
  success: boolean;
  styleId?: string;
  error?: string;
}

interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

interface ExtractArticleResult {
  success: boolean;
  title?: string;
  content?: string;
  excerpt?: string;
  url?: string;
  error?: string;
}

interface ExtractLinksResult {
  success: boolean;
  links?: LinkInfo[];
  error?: string;
}

interface ExtractImagesResult {
  success: boolean;
  images?: ImageInfo[];
  error?: string;
}

interface QueryElementResult {
  success: boolean;
  elements?: ElementInfo[];
  count?: number;
  error?: string;
}

interface ContextMenuEvent {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
}

type WidgetPosition = 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'center';

interface ExtensionAPI {
  getPageInfo(): Promise<PageInfo | null>;
  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<SelectionResult>;
  
  extractArticle(): Promise<ExtractArticleResult>;
  extractLinks(): Promise<ExtractLinksResult>;
  extractImages(): Promise<ExtractImagesResult>;
  queryElement(selector: string, limit?: number): Promise<QueryElementResult>;
  
  highlight(selector: string, color?: string): Promise<HighlightResult>;
  removeHighlight(highlightId: string): Promise<{ success: boolean; error?: string }>;
  
  insertWidget(html: string, position?: WidgetPosition): Promise<WidgetResult>;
  updateWidget(widgetId: string, html: string): Promise<{ success: boolean; error?: string }>;
  removeWidget(widgetId: string): Promise<{ success: boolean; error?: string }>;
  
  injectCSS(css: string): Promise<CSSResult>;
  removeCSS(styleId: string): Promise<{ success: boolean; error?: string }>;
  
  captureVisible(): Promise<CaptureResult>;
  
  // Event handlers
  onContextMenu(callback: (event: ContextMenuEvent) => void): () => void;
  onSelectionChange(handler: (text: string, rect: SelectionRect | null, url?: string) => void): () => void;
}

// ============================================================================
// Network API Types
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ResponseType = 'json' | 'text' | 'arraybuffer';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string | object;
  responseType?: ResponseType;
}

interface RequestResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

interface NetworkAPI {
  request<T = unknown>(url: string, options?: RequestOptions): Promise<RequestResponse<T>>;
}

// ============================================================================
// Storage API Types
// ============================================================================

interface StorageAPI {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// Notify API Types
// ============================================================================

interface NotifyOptions {
  title: string;
  message?: string;
  icon?: string;
}

interface NotifyResult {
  success: boolean;
  reason?: string;
}

// ============================================================================
// GemiGo SDK
// ============================================================================

interface GemigoSDK {
  platform: 'extension' | 'desktop' | 'web';
  extension: ExtensionAPI;
  network: NetworkAPI;
  storage: StorageAPI;
  notify(options: NotifyOptions): Promise<NotifyResult>;
}

declare global {
  interface Window {
    gemigo: GemigoSDK;
  }
}

export {};
```

> **使用方式**: 将上述代码保存为 `gemigo-sdk.d.ts` 文件放入项目中，即可获得完整的类型提示。

---

## �📚 API 完整参考

### 1. 页面信息 (extension.*)

#### getPageInfo()
获取当前页面的基本信息。

```typescript
const info = await gemigo.extension.getPageInfo();
// Returns: { url: string, title: string, favicon?: string }
```

#### getPageHTML()
获取页面完整 HTML 内容。

```typescript
const html = await gemigo.extension.getPageHTML();
// Returns: string (完整 HTML)
```

#### getSelection()
获取用户当前选中的文本。

```typescript
const selection = await gemigo.extension.getSelection();
// Returns: { text: string, rect?: DOMRect }
```

---

### 2. 视觉修改 (extension.*)

#### highlight(selector, color?)
高亮匹配 CSS 选择器的元素。

```typescript
const result = await gemigo.extension.highlight('h1', 'yellow');
// Returns: { success: boolean, highlightId?: string, count?: number }
```

#### removeHighlight(highlightId)
移除指定的高亮。

```typescript
await gemigo.extension.removeHighlight(highlightId);
```

#### insertWidget(html, position?)
在页面上插入浮动 HTML 组件。

```typescript
const result = await gemigo.extension.insertWidget(
  '<div style="padding: 16px; background: white; border-radius: 8px;">Hello!</div>',
  'bottom-right' // 可选: 'top-left', 'top-right', 'top-center', 'bottom-left', 'bottom-right', 'bottom-center', 'center'
);
// Returns: { success: boolean, widgetId?: string }
```

#### removeWidget(widgetId)
移除指定的组件。

```typescript
await gemigo.extension.removeWidget(widgetId);
```

#### injectCSS(css)
向页面注入自定义 CSS。

```typescript
const result = await gemigo.extension.injectCSS(`
  body { background: #f5f5f5 !important; }
  .ad-banner { display: none !important; }
`);
// Returns: { success: boolean, styleId?: string }
```

#### removeCSS(styleId)
移除注入的 CSS。

```typescript
await gemigo.extension.removeCSS(styleId);
```

---

### 3. 内容提取 (extension.*)

#### captureVisible()
截取页面可见区域。

```typescript
const result = await gemigo.extension.captureVisible();
// Returns: { success: boolean, dataUrl?: string }
```

#### extractArticle()
使用 Readability 提取文章正文。

```typescript
const article = await gemigo.extension.extractArticle();
// Returns: {
//   success: boolean,
//   title?: string,
//   excerpt?: string,
//   content?: string,  // HTML 格式的正文
//   byline?: string,
//   siteName?: string
// }
```

#### extractLinks()
提取页面所有链接。

```typescript
const result = await gemigo.extension.extractLinks();
// Returns: { success: boolean, links?: Array<{ href: string, text: string }> }
```

#### extractImages()
提取页面所有图片。

```typescript
const result = await gemigo.extension.extractImages();
// Returns: { success: boolean, images?: Array<{ src: string, alt?: string, width?: number, height?: number }> }
```

#### queryElement(selector, limit?)
查询元素并返回信息。

```typescript
const result = await gemigo.extension.queryElement('a.nav-link', 10);
// Returns: {
//   success: boolean,
//   elements?: Array<{ tag: string, text?: string, attributes?: Record<string, string> }>
// }
```

---

### 4. 网络请求 (network.*)

#### request(url, options?)
发起 HTTP 请求（绕过 CORS 限制）。

```typescript
const response = await gemigo.network.request('https://api.example.com/data', {
  method: 'POST',           // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer xxx'
  },
  body: { foo: 'bar' },     // 自动 JSON 序列化
  responseType: 'json',     // 'json' | 'text' | 'arraybuffer'
  timeout: 30000            // 超时时间（毫秒）
});

// Returns: {
//   success: boolean,
//   status?: number,
//   statusText?: string,
//   headers?: Record<string, string>,
//   data?: any,
//   error?: string
// }
```

---

### 5. 本地存储 (storage.*)

#### get(key)
获取存储的值。

```typescript
const value = await gemigo.storage.get('user_preferences');
// Returns: T | undefined
```

#### set(key, value)
存储值。

```typescript
await gemigo.storage.set('user_preferences', { theme: 'dark', language: 'zh' });
```

#### remove(key)
删除指定键。

```typescript
await gemigo.storage.remove('user_preferences');
```

#### clear()
清空所有存储。

```typescript
await gemigo.storage.clear();
```

---

### 6. 通知 (notify)

#### notify(options)
显示浏览器通知。

```typescript
await gemigo.notify({
  title: '操作成功',
  body: '文章已保存到收藏夹'
});
```

---

## � 部署到 GemiGo

| 方式 | 步骤 |
|------|------|
| **HTML 代码** | 访问 gemigo.io → 新建项目 → 选择「HTML 代码」→ 粘贴代码 → 部署 |
| **ZIP 文件** | 将项目打包为 ZIP（`index.html` 在根目录）→ 上传 → 部署 |
| **GitHub** | 粘贴仓库 URL → 自动构建部署 |

---

## 🔗 相关资源

- **官网**: https://gemigo.io
- **GitHub**: https://github.com/Peiiii/deploy-your-app
- **NPM**: https://www.npmjs.com/package/@gemigo/app-sdk

---

*最后更新: 2024-12-25*
