# GemiGo 项目功能全集

本文档按模块梳理 GemiGo（deploy-your-app）的完整功能集合，便于产品规划与研发对齐。与 [功能说明](FEATURES.md)、[文档中心](README.md)、[系统架构](architecture/ARCHITECTURE.md) 互补。

---

## 1. 产品定位

- **产品名**：GemiGo（仓库名 deploy-your-app）
- **一句话**：面向非专业用户的前端应用一键部署平台。
- **核心体验**：从 GitHub 仓库、ZIP 文件或 HTML 代码快速部署为可访问的 Web 应用，零配置、极速上线。
- **在线体验**：[https://gemigo.io](https://gemigo.io)

---

## 2. 仓库与包结构

| 包/目录 | 职责 |
|---------|------|
| `frontend/` | React 前端（Dashboard、部署向导、应用市场、个人中心、管理后台等） |
| `workers/api/` | API Worker：用户认证、项目 CRUD、部署请求代理、会话管理 |
| `workers/r2-gateway/` | R2 存储网关：按子域名从 R2 提供静态资源 |
| `workers/screenshot-service/` | 截图服务 |
| `workers/genai-proxy-worker/` | GenAI 代理（如 `/v1beta/models/:model`） |
| `workers/openai-gateway-worker/` | OpenAI 兼容网关（`/v1/models`、`/v1/chat/completions`） |
| `server/` | Node 部署服务：克隆、安装依赖、构建、部署到 local/Cloudflare/R2，SSE 日志流 |
| `packages/app-sdk/` | GemiGo App SDK（发布到 npm） |
| `browser-extension/` | 浏览器扩展 |
| `desktop/` | 桌面端应用（gemigo-desktop） |

---

## 3. 部署能力

### 3.1 代码来源

- GitHub 仓库（HTTPS / `git@` 格式）
- 上传 ZIP 文件
- 粘贴 HTML 代码直接部署

### 3.2 构建与修复

- 自动识别构建输出目录（`dist/`、`build/`、`out/`）
- 自动执行依赖安装（npm）与项目构建（`npm run build`）
- 自动修复常见构建问题（如缺失 HTML entry、资源路径等）

### 3.3 部署目标

| 目标 | 说明 |
|------|------|
| `local` | 构建产物部署到服务器本地，通过 `/apps/<project-slug>/` 访问 |
| `cloudflare` | 上传到 Cloudflare Pages，获得 `*.pages.dev` 域名 |
| `r2` | 在阿里云构建，产物上传 Cloudflare R2，经 R2 Gateway Worker 提供访问（如 `*.gemigo.app`） |

---

## 4. 前端界面与路由

| 路径 | 页面/能力 |
|------|-----------|
| `/` | 首页 |
| `/dashboard` | 项目列表与状态 |
| `/deploy` | 新建部署向导 |
| `/explore` | 应用市场（探索、分类、标签、点赞、收藏、搜索排序） |
| `/projects/:id` | 项目设置 |
| `/admin` → `/admin/projects` | 管理后台（项目） |
| `/design/branding` | 品牌设计页 |
| `/me` | 个人资料 |
| `/u/:id` | 用户公开主页 |
| `/privacy`、`/privacy-policy` | 隐私政策 |

### UI 特性

- 深色模式
- 响应式设计
- 实时部署日志（SSE）
- 项目状态：Live / Building / Failed / Offline
- 中文界面与 i18n（i18next）

---

## 5. 用户体系

- 邮箱注册/登录
- Google OAuth
- GitHub OAuth
- 会话管理（Session/Cookie）
- 用户数据与项目数据持久化（D1 或本地 JSON，由 `STORAGE_TYPE` 决定）

---

## 6. 应用市场

- 探索其他用户部署的应用
- 按分类、标签筛选
- 点赞与收藏
- 搜索与排序

---

## 7. 后端 API 与数据

### 7.1 API Worker（Cloudflare）

- 认证相关：`/api/v1/auth/*`（邮箱、OAuth、登出等）
- 项目 CRUD：`GET/POST /api/v1/projects` 等
- 部署请求代理至 Node 服务

### 7.2 Node 部署服务

- `POST /api/v1/context`：上下文
- `POST /api/v1/analyze`：代码分析（含 AI 能力，依赖 DashScope 等）
- `POST /api/v1/deploy`：触发部署
- `GET /api/v1/deployments/:id/stream`：SSE 实时日志流

### 7.3 数据存储

- **STORAGE_TYPE=file**：`data/projects.json`、`data/builds/`、`data/apps/`
- **STORAGE_TYPE=d1**：Cloudflare D1（用户、项目等）
- 构建产物：R2 或本地 `data/apps/`

---

## 8. 基础设施与 Workers

| 组件 | 用途 |
|------|------|
| Cloudflare Pages | 前端托管（gemigo.io） |
| API Worker | 认证、项目、代理 |
| R2 Gateway Worker | 子域名 → R2 静态资源 |
| Screenshot Service | 截图 |
| GenAI Proxy Worker | GenAI 接口代理 |
| OpenAI Gateway Worker | OpenAI 兼容接口（/v1/models, /v1/chat/completions） |
| Cloudflare D1 | 数据库（可选） |
| Cloudflare R2 | 构建产物存储 |
| Docker + 阿里云 | Node 部署服务运行环境 |
| GitHub Actions | CI/CD、自动部署 |

---

## 9. 配置与环境变量

- **后端**：`server/.env`，如 `DEPLOY_TARGET`、`DASHSCOPE_API_KEY`、Cloudflare/R2/D1 相关变量，见 [环境变量](getting-started/ENVIRONMENT.md)。
- **前端**：`frontend/.env`，如 `VITE_API_BASE_URL`、`GEMINI_API_KEY`（Demo 用）。
- **生产**：GitHub Secrets/Variables + 部署脚本注入。

---

## 10. 扩展与客户端

- **App SDK**：`@gemigo/app-sdk`，供在 GemiGo 上运行的应用使用。
- **浏览器扩展**：Chrome 扩展，见 `extension/` 与 `browser-extension/`。
- **桌面端**：gemigo-desktop，见 `desktop/` 与 [桌面端发布](deployment/DESKTOP_RELEASE.md)。

---

## 11. 技术栈摘要

- **前端**：React 19、TypeScript、Vite (Rolldown)、Zustand、React Router、Tailwind、i18next
- **API 层**：Cloudflare Workers、D1
- **部署服务**：Node.js、Express、Docker
- **存储**：R2、D1 或本地文件

---

## 12. 文档索引

- 功能说明：[FEATURES.md](FEATURES.md)
- 文档中心：[README.md](README.md)
- 快速开始：[getting-started/GETTING_STARTED.md](getting-started/GETTING_STARTED.md)
- 环境变量：[getting-started/ENVIRONMENT.md](getting-started/ENVIRONMENT.md)
- 认证设置：[getting-started/AUTH_SETUP.md](getting-started/AUTH_SETUP.md)
- 系统架构：[architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
- API Worker：[architecture/API_WORKER_ARCHITECTURE.md](architecture/API_WORKER_ARCHITECTURE.md)
- 部署指南：[deployment/DEPLOY.md](deployment/DEPLOY.md)
- App SDK / 扩展 / 技术分析：见 [文档中心](README.md)

---

*文档维护：与代码和 FEATURES.md、ARCHITECTURE 同步；大功能变更时更新本全集。*
