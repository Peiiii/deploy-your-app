# GemiGo 功能文档

**产品名称**: GemiGo  
**域名**: gemigo.io  
**定位**: 面向非专业用户的前端应用一键部署平台

---

## 核心功能

### 1. 项目部署

#### 1.1 代码来源
- ✅ **GitHub 仓库**: 支持从 GitHub 仓库 URL 部署（支持 `https://` 和 `git@` 格式）
- ✅ **ZIP 文件**: 支持上传 ZIP 压缩包部署
- ✅ **自动识别**: 自动识别构建输出目录（`dist/`、`build/`、`out/`）

#### 1.2 构建流程
- ✅ **依赖安装**: 自动执行 `npm install`（包含 devDependencies）
- ✅ **项目构建**: 自动执行 `npm run build`
- ✅ **构建修复**: 自动修复常见构建问题（如缺失 HTML entry script、资源路径调整等）

#### 1.3 部署目标
- ✅ **本地部署** (`local`): 将构建产物部署到服务器本地，通过 `/apps/<project-slug>/` 访问
- ✅ **Cloudflare Pages** (`cloudflare`): 将构建产物上传到 Cloudflare Pages，获得 `*.pages.dev` 域名

### 2. 前端界面

#### 2.1 Dashboard
- ✅ **项目列表**: 展示所有已部署项目
- ✅ **项目信息**: 显示项目名称、状态、访问链接、部署时间
- ✅ **状态标识**: 实时显示项目状态（Live / Building / Failed / Offline）
- ✅ **快速访问**: 一键打开已部署应用

#### 2.2 新建部署
- ✅ **部署向导**: 引导式部署流程
- ✅ **代码分析**: 支持粘贴代码片段进行 AI 分析（界面已实现，后端为 stub）
- ✅ **实时日志**: 通过 SSE 实时显示部署日志（clone、install、build、deploy 等步骤）
- ✅ **状态跟踪**: 实时显示部署状态（IDLE → BUILDING → DEPLOYING → SUCCESS/FAILED）

#### 2.3 UI 特性
- ✅ **深色模式**: 支持明暗主题切换
- ✅ **响应式设计**: 适配不同屏幕尺寸

### 3. 后端服务

#### 3.1 API 接口
- ✅ `GET /api/v1/projects` - 获取项目列表
- ✅ `POST /api/v1/projects` - 创建新项目
- ✅ `POST /api/v1/analyze` - 代码分析（当前为 stub，返回原代码）
- ✅ `POST /api/v1/deploy` - 触发部署任务
- ✅ `GET /api/v1/deployments/:id/stream` - SSE 实时日志流

#### 3.2 部署服务
- ✅ **异步任务**: 部署任务异步执行，不阻塞 API 响应
- ✅ **日志记录**: 完整的部署日志记录（时间戳、级别、消息）
- ✅ **错误处理**: 完善的错误捕获和日志记录
- ✅ **工作目录管理**: 自动管理构建工作目录和缓存

#### 3.3 数据持久化
- ✅ **项目数据**: 项目信息存储在 `data/projects.json`
- ✅ **构建缓存**: 构建产物存储在 `data/builds/`
- ✅ **静态资源**: 本地部署的应用存储在 `data/apps/`

### 4. 部署配置

#### 4.1 环境变量（Secrets）
- ✅ `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
- ✅ `CLOUDFLARE_PAGES_API_TOKEN` - Cloudflare Pages API Token
- ✅ `DASHSCOPE_API_KEY` - DashScope API Key（用于平台 AI 功能）

#### 4.2 环境变量（Variables）
- ✅ `DEPLOY_TARGET` - 部署目标（`local` 或 `cloudflare`，默认 `local`）
- ✅ `CLOUDFLARE_PAGES_PROJECT_PREFIX` - Cloudflare Pages 项目前缀（默认 `deploy-your-app`）

### 5. 部署流程

```
用户输入 → 创建项目 → 触发部署 → 下载源码 → 安装依赖 → 构建项目 → 应用修复 → 部署到目标平台 → 返回访问链接
```

---

## 未实现功能（规划中）

### 1. AI 代码分析
- ❌ **真实 AI 分析**: 当前 `/api/v1/analyze` 只是 stub，未真正调用 AI
- ❌ **代码改写**: 未实现通过 AI 改写代码以避免暴露 API Key
- ❌ **安全代理**: 未实现安全代理服务

### 2. 高级功能
- ❌ **部署历史**: 不支持查看历史部署记录
- ❌ **回滚功能**: 不支持回滚到之前的版本
- ❌ **环境变量管理**: 不支持为项目配置环境变量
- ❌ **自定义域名**: 不支持绑定自定义域名

### 3. 多框架支持
- ❌ **框架探测**: 未实现自动识别框架类型（当前固定为 React）
- ❌ **Next.js 支持**: 不支持 Next.js 静态导出
- ❌ **其他框架**: 不支持 Vue、SvelteKit 等

### 4. 部署目标扩展
- ❌ **GitHub Pages**: 不支持部署到 GitHub Pages
- ❌ **Vercel**: 不支持部署到 Vercel
- ❌ **其他平台**: 不支持其他静态托管平台

---

## 技术架构

### 前端
- **框架**: React + TypeScript + Vite
- **状态管理**: Zustand
- **UI 组件**: 自定义组件（Tailwind CSS）
- **实时通信**: Server-Sent Events (SSE)

### 后端
- **框架**: Node.js + Express
- **构建工具**: npm
- **部署**: Docker + 阿里云服务器
- **CI/CD**: GitHub Actions

### 数据存储
- **项目数据**: JSON 文件（`data/projects.json`）
- **构建缓存**: 文件系统（`data/builds/`）
- **静态资源**: 文件系统（`data/apps/`）

---

## 部署方式

### 生产环境
- ✅ **Docker 容器化**: 应用运行在 Docker 容器中
- ✅ **自动化部署**: 通过 GitHub Actions 自动部署到阿里云服务器
- ✅ **环境变量管理**: 通过 GitHub Secrets 和 Variables 管理配置

### 本地开发
- ✅ **开发模式**: 支持本地开发调试
- ✅ **热重载**: 前端支持 HMR
- ✅ **本地数据**: 开发环境使用本地文件系统存储

---

## 限制与约束

1. **仅支持静态前端项目**: 不支持后端服务、数据库、长连接等
2. **构建工具限制**: 当前仅支持 npm（不支持 yarn、pnpm 等）
3. **框架限制**: 主要针对 Vite/React 项目优化
4. **单服务器部署**: 当前为单服务器架构，不支持分布式部署

---

## 数据说明

- **项目数据**: 存储在 `data/projects.json`，包含项目基本信息
- **构建产物**: 存储在 `data/builds/<deployment-id>/`，每次部署生成新的构建目录
- **静态应用**: 本地部署的应用存储在 `data/apps/<project-slug>/`
- **数据持久化**: 通过 Docker volume 挂载，确保数据不丢失

---

*最后更新: 2024年*
