# GemiGo 平台技术架构

> GemiGo 网站/后端服务的技术实现

---

## 相关文档

| 文档 | 内容 |
|------|------|
| 本文档 | GemiGo 平台自身的架构 |
| [APP_RUNTIME.md](./APP_RUNTIME.md) | 应用在各平台如何运行 |
| [APP_SDK.md](./APP_SDK.md) | 应用开发者 SDK API |
| [AI_GATEWAY_ANALYSIS.md](./AI_GATEWAY_ANALYSIS.md) | AI Gateway（GenAI 兼容 + OpenAI-compatible）设计分析 |

---

## 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户端                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Web 前端       │   桌面端         │   浏览器扩展            │
│   (React SPA)   │   (Electron)    │   (MV3 Extension)      │
└────────┬────────┴────────┬────────┴────────────┬────────────┘
         │                 │                     │
         └─────────────────┼─────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare 服务                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  gemigo-api     │  │  r2-gateway     │                  │
│  │  (Workers)      │  │  (Workers)      │                  │
│  │  • 用户认证     │  │  • 静态文件服务  │                  │
│  │  • 应用管理     │  │  • 缩略图       │                  │
│  │  • 部署触发     │  │                 │                  │
│  └────────┬────────┘  └─────────────────┘                  │
│           ↓                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  D1 Database    │  │  R2 Storage     │                  │
│  │  (gemigo-       │  │  (gemigo-apps)  │                  │
│  │   projects)     │  │  • 应用文件     │                  │
│  └─────────────────┘  │  • 缩略图       │                  │
│                       └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  genai-proxy    │  │  screenshot-    │                  │
│  │  (Workers)      │  │  service        │                  │
│  │  • AI 代理      │  │  (Workers)      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐                                        │
│  │ openai-gateway  │                                        │
│  │ (Workers)       │                                        │
│  │ • OpenAI API    │                                        │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 一、Web 前端（已实现）

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | React 19 + TypeScript | 最新版本 |
| 状态 | Zustand | 轻量状态管理 |
| 路由 | react-router-dom | SPA 路由 |
| 构建 | Vite (rolldown-vite) | 极速构建 |
| 国际化 | i18next | 多语言 |
| AI | @google/genai | Gemini 集成 |
| 部署 | GitHub Pages | 静态托管 |

### 目录结构

```
frontend/
├── src/
│   ├── gemini-deploy/       # 主应用模块
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # UI 组件
│   │   ├── services/        # API 服务
│   │   └── store/           # 状态管理
│   ├── i18n/                # 国际化
│   └── main.tsx             # 入口
├── public/                  # 静态资源
└── vite.config.ts           # Vite 配置
```

### 核心页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 项目部署入口 |
| 应用发现 | `/discover` | 浏览应用（规划中） |
| 应用详情 | `/app/:id` | 查看/运行应用 |
| 创作者中心 | `/creator` | 管理已发布应用 |

---

## 二、云端服务（已实现）

### Workers 架构

```
workers/
├── api/                     # gemigo-api（主 API）
│   ├── src/
│   │   ├── index.ts         # 入口
│   │   ├── routes/          # 路由处理
│   │   └── services/        # 业务逻辑
│   └── wrangler.toml        # D1 + R2 绑定
├── r2-gateway/              # R2 静态文件网关
├── genai-proxy-worker/      # AI 代理服务
├── openai-gateway-worker/   # OpenAI-compatible AI 网关
└── screenshot-service/      # 截图服务
```

### 数据存储

#### D1 数据库 (gemigo-projects)

```sql
-- 项目/应用表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE,
  user_id TEXT,
  repo_url TEXT,
  deploy_url TEXT,
  thumbnail_url TEXT,
  status TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

#### R2 存储 (gemigo-apps)

```
gemigo-apps/
├── apps/
│   ├── {slug}/
│   │   ├── index.html
│   │   ├── assets/
│   │   └── thumbnail.png
│   └── ...
└── ...
```

### API 设计

```
/api
├── /auth
│   ├── POST /login
│   ├── POST /register
│   └── GET  /me
│
├── /projects
│   ├── GET    /             # 项目列表
│   ├── GET    /:id          # 项目详情
│   ├── POST   /             # 创建项目
│   ├── PUT    /:id          # 更新项目
│   ├── DELETE /:id          # 删除项目
│   └── POST   /:id/deploy   # 触发部署
│
├── /apps                    # 应用市场（规划中）
│   ├── GET    /             # 应用列表
│   ├── GET    /:id          # 应用详情
│   └── POST   /:id/install  # 安装应用
│
└── /ai
    ├── POST   /chat
    └── POST   /generate
```

### wrangler.toml 配置

```toml
name = "gemigo-api"
main = "src/index.ts"

[vars]
APPS_ROOT_DOMAIN = "gemigo.app"
DEPLOY_TARGET = "r2"
PLATFORM_AI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
PLATFORM_AI_MODEL = "qwen3-max"
AUTH_REDIRECT_BASE = "https://gemigo.io"

[[d1_databases]]
binding = "PROJECTS_DB"
database_name = "gemigo-projects"
database_id = "e1e28d75-d0a0-4f8e-9b5d-714454686a4f"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gemigo-apps"
```

---

## 三、桌面端（规划中）

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Electron | 跨平台桌面 |
| 前端 | React + TypeScript | 与 Web 共享代码 |
| 主进程 | Node.js | 本地能力 |
| 构建 | electron-builder | 打包分发 |

### 目录结构（规划）

```
desktop/
├── src/
│   ├── main/                # Electron 主进程
│   │   ├── index.ts
│   │   ├── app-manager.ts   # 应用管理
│   │   ├── scheduler.ts     # 定时任务
│   │   ├── file-watcher.ts  # 文件监控
│   │   └── notification.ts  # 系统通知
│   ├── preload/             # preload 脚本
│   │   └── index.ts
│   └── renderer/            # 渲染进程（React）
├── resources/
└── electron-builder.yml
```

---

## 四、浏览器扩展（规划中）

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 标准 | Chrome Extension MV3 |
| UI | React + TypeScript |
| 构建 | Vite + CRXJS |

### 目录结构（规划）

```
extension/
├── src/
│   ├── background/          # Service Worker
│   ├── content/             # Content Scripts
│   ├── sidepanel/           # 侧边栏
│   └── shared/
├── manifest.json
└── ...
```

---

## 五、部署流程

### 应用发布流程

```
创作者提交 GitHub 仓库
         ↓
API 接收请求，验证权限
         ↓
触发部署服务
         ↓
拉取代码，构建
         ↓
上传到 R2 (gemigo-apps/{slug}/)
         ↓
生成截图/缩略图
         ↓
更新 D1 数据库记录
         ↓
返回访问 URL
```

### 域名规划

| 域名 | 用途 |
|------|------|
| `gemigo.io` | 主站前端 |
| `api.gemigo.io` | API 服务 |
| `gemigo.app` | 应用托管 |
| `{slug}.gemigo.app` | 单个应用 |

---

## 六、开发命令

```bash
# 开发
pnpm dev                    # 同时启动前端 + 后端 + Worker

# 单独启动
pnpm dev:frontend           # 前端
pnpm dev:server             # Node 服务

# 构建
pnpm build                  # 构建全部
pnpm build:frontend         # 构建前端

# 部署
pnpm deploy:pages           # 部署前端到 GitHub Pages
pnpm deploy:workers         # 部署所有 Workers
```
