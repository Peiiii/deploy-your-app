# 架构文档

本文档介绍 GemiGo 项目的整体架构和技术设计。

## 📋 目录

- [系统概览](#系统概览)
- [架构分层](#架构分层)
- [技术栈](#技术栈)
- [数据流](#数据流)
- [核心模块](#核心模块)
- [部署架构](#部署架构)

## 系统概览

GemiGo 是一个分布式的前端应用部署平台，采用微服务架构：

```
┌─────────────────┐
│   浏览器客户端    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────┐
│   Cloudflare Pages              │
│   (gemigo.io)                   │
│   - 前端静态资源                 │
│   - _worker.js (API 代理)       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Cloudflare Workers            │
│   (gemigo-api)                  │
│   - 用户认证                     │
│   - 项目 CRUD                    │
│   - 部署请求代理                  │
└────────┬────────────────────────┘
         │
         ├─────────────────┐
         ▼                 ▼
┌─────────────────┐  ┌──────────────┐
│  Cloudflare D1  │  │ Node 部署服务 │
│  数据库          │  │ (Aliyun)    │
│  - 用户数据      │  │ - 构建执行    │
│  - 项目数据      │  │ - 部署到 R2  │
└─────────────────┘  └──────┬───────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Cloudflare R2 │
                    │ 存储构建产物   │
                    └──────────────┘
```

## 架构分层

### 1. 前端层 (Frontend)

**位置**: `frontend/`

**技术栈**:
- React 19 + TypeScript
- Vite (Rolldown)
- Zustand (状态管理)
- React Router (路由)
- Tailwind CSS (样式)

**架构模式**:
- **Presenter 模式**: 业务逻辑封装在 Managers 中
- **Provider 模式**: 通过 ServiceFactory 获取服务提供者
- **Store 模式**: 使用 Zustand 管理全局状态

**主要模块**:
```
frontend/src/gemini-deploy/
├── components/      # UI 组件
├── pages/          # 页面组件
├── managers/       # 业务逻辑管理器
├── services/       # API 服务层
├── stores/         # Zustand 状态存储
└── types/          # TypeScript 类型定义
```

### 2. API 网关层 (API Worker)

**位置**: `workers/api/`

**技术栈**:
- Cloudflare Workers
- TypeScript
- Cloudflare D1 (数据库)

**职责**:
- 用户认证和授权
- 项目数据 CRUD
- 部署请求代理
- 会话管理

**架构模式**:
- **MVC 模式**: Controller → Service → Repository
- **路由模式**: 集中式路由表 (`routes.ts`)

**主要模块**:
```
workers/api/src/
├── controllers/    # 控制器（处理 HTTP 请求）
├── services/       # 业务逻辑服务
├── repositories/   # 数据访问层
├── utils/          # 工具函数
└── types/          # 类型定义
```

### 3. 部署服务层 (Node Service)

**位置**: `server/`

**技术栈**:
- Node.js + Express
- TypeScript
- Docker

**职责**:
- 代码仓库克隆
- 依赖安装
- 项目构建
- 部署到目标平台（R2/Pages）
- SSE 日志流

**架构模式**:
- **模块化架构**: 按功能划分模块
- **Provider 模式**: 可插拔的部署提供者

**主要模块**:
```
server/src/
├── modules/         # 业务模块
│   ├── deployment/ # 部署模块
│   ├── projects/   # 项目模块
│   └── ...
├── routes/         # 路由定义
└── common/         # 通用工具
```

### 4. 存储网关层 (R2 Gateway)

**位置**: `workers/r2-gateway/`

**职责**:
- 从 R2 读取构建产物
- 根据子域名路由到对应应用
- 提供静态资源服务

截至2026-10-03，公共缓存策略由 gateway 持有：deployment pointer 边缘缓存5秒，文件按 tenant/release R2 key 缓存；releases 为不可变版本，legacy current 最多5秒缓存。浏览器普通应用URL使用 no-cache + conditional ETag/HEAD，避免任意文件名覆盖后被缓存一年。版本发布/rollback可见性最多5秒，legacy原地更新最多10秒；Cloudflare HTML变换可能移除客户端ETag，不能假定所有HTML都能自动304。

默认无query的Tailwind CDN根脚本在交付HTML时替换成平台同字节固定版本镜像；上传源码不变，CSP/显式版本/插件query等保留原地址。资源版本/hash由 [runtime-assets.json](../../workers/r2-gateway/runtime-assets.json) 持有，发布脚本先验证hash再上传镜像和许可证，之后才能发布gateway。原始验证与线上数据见 [性能交付记录](../logs/2026-10-03-app-delivery-performance/README.md)。

Google Fonts交付由 [google-fonts.ts](../../workers/r2-gateway/google-fonts.ts) 持有：HTML静态链接、内联CSS及带标记的同源CSS/nested imports在交付时转换；Google CSS与gstatic字体通过平台assets域限域镜像和缓存，完整浏览器UA协商WOFF2，上游2.5秒限时。无条件字体CSS由async helper在文档ready后经CSSOM加载，正文样式先显示；作者字体选择与原始R2文件不变。CSP/SRI、条件import、动态JS引用与超大文件保留边界。缓存namespace隔离交付变更；旧namespace承接已缓存CSS。字体成功不等于全国网络或任意图片/API已加速，真实本机证据见 [字体优化交付记录](../logs/2026-10-03-google-fonts-delivery/README.md)。

## 技术栈

### 前端技术

| 技术 | 用途 | 版本 |
|------|------|------|
| React | UI 框架 | 19.2 |
| TypeScript | 类型系统 | 5.9 |
| Vite | 构建工具 | 7.2 (Rolldown) |
| Zustand | 状态管理 | 5.0 |
| React Router | 路由 | 6.30 |
| Tailwind CSS | 样式 | 3.x |
| i18next | 国际化 | 25.7 |

### 后端技术

| 技术 | 用途 | 版本 |
|------|------|------|
| Node.js | 运行时 | 18+ |
| Express | Web 框架 | - |
| TypeScript | 类型系统 | 5.9 |
| Cloudflare Workers | 边缘计算 | - |
| Cloudflare D1 | 数据库 | - |
| Cloudflare R2 | 对象存储 | - |

### 基础设施

| 服务 | 用途 |
|------|------|
| Cloudflare Pages | 前端托管 |
| Cloudflare Workers | API 网关 |
| Cloudflare D1 | 数据库 |
| Cloudflare R2 | 对象存储 |
| Docker | 容器化 |
| GitHub Actions | CI/CD |

## 数据流

### 用户登录流程

```
1. 用户点击登录
   ↓
2. 前端调用 /api/v1/auth/email/login
   ↓
3. API Worker 验证凭证
   ↓
4. 创建 Session，返回 Cookie
   ↓
5. 前端存储用户状态
```

### 项目部署流程

```
1. 用户在 Dashboard 创建项目
   ↓
2. 前端调用 POST /api/v1/projects
   ↓
3. API Worker 保存到 D1
   ↓
4. 前端调用 POST /api/v1/deploy
   ↓
5. API Worker 代理到 Node 服务
   ↓
6. Node 服务执行部署：
   - git clone
   - npm install
   - npm run build
   - 上传到 R2
   ↓
7. 通过 SSE 推送日志
   ↓
8. 部署完成，返回访问 URL
```

### 应用访问流程

```
1. 用户访问 <slug>.gemigo.app
   ↓
2. DNS 解析到 R2 Gateway Worker
   ↓
3. Worker 解析当前发布版本，优先读边缘缓存，未命中回源 R2
   ↓
4. 返回静态资源
```

## 核心模块

### 前端模块

#### Presenter 模式

`Presenter` 是前端的核心协调者，封装了所有业务逻辑：

```typescript
class Presenter {
  ui: UIManager          // UI 状态管理
  project: ProjectManager    // 项目管理
  deployment: DeploymentManager  // 部署管理
  auth: AuthManager      // 认证管理
  analytics: AnalyticsManager  // 数据分析
  reaction: ReactionManager  // 互动管理（点赞、收藏）
}
```

#### Service Factory

通过 `ServiceFactory` 获取服务提供者，支持 Mock 和真实实现切换：

```typescript
// 开发环境可以使用 Mock Provider
// 生产环境使用 HTTP Provider
const provider = ServiceFactory.getProjectProvider();
```

### API Worker 模块

#### 路由系统

集中式路由表 (`routes.ts`)：

```typescript
router.add({
  path: '/api/v1/projects',
  method: 'GET',
  handler: projectsController.listProjects,
});
```

#### 错误处理

统一的错误处理机制：

```typescript
try {
  // 业务逻辑
} catch (error) {
  if (error instanceof AppError) {
    return handleError(error);
  }
  throw error;
}
```

### Node 服务模块

#### 部署提供者

可插拔的部署提供者：

```typescript
interface DeploymentProvider {
  deploy(project: Project): Promise<DeploymentResult>;
}

// 实现：
// - LocalProvider (本地部署)
// - CloudflarePagesProvider (Pages 部署)
// - R2Provider (R2 部署)
```

## 部署架构

### 开发环境

```
本地开发
├── Vite Dev Server (前端)
├── Express Server (后端)
└── Wrangler Dev (Workers)
```

### 生产环境

```
生产部署
├── Cloudflare Pages (前端)
├── Cloudflare Workers (API)
├── Docker Container (Node 服务)
└── Cloudflare R2 (存储)
```

### CI/CD 流程

```
GitHub Push
  ↓
GitHub Actions
  ├── 构建前端
  ├── 构建后端 Docker 镜像
  ├── 部署到 Cloudflare Pages
  ├── 部署 Workers
  └── 部署 Node 服务到服务器
```

## 安全考虑

### 认证与授权

- Session-based 认证
- OAuth 2.0 (Google, GitHub)
- 密码哈希 (SHA-256 + Salt)

### 数据安全

- 敏感信息存储在环境变量
- API Token 加密传输
- CORS 配置

### 部署安全

- Docker 容器隔离
- 最小权限原则
- 定期安全更新

## 扩展性

### 水平扩展

- Workers 自动扩展
- R2 存储无限扩展
- Node 服务可多实例部署

### 功能扩展

- 插件化的部署提供者
- 可配置的 AI 服务
- 模块化的代码结构

## 性能优化

### 前端优化

- 代码分割
- 懒加载路由
- 图片优化

### 后端优化

- Workers 边缘计算（低延迟）
- R2 CDN 加速
- 构建缓存

## 监控与日志

### 日志

- Cloudflare Workers 日志
- Node 服务日志
- 部署日志（SSE）

### 监控

- Cloudflare Analytics
- 错误追踪
- 性能指标

---

**更多详细信息请参考各模块的专门文档。**

