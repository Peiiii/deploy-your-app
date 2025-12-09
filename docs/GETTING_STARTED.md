# 快速开始指南

本指南将帮助你快速设置和运行 GemiGo 项目。

## 📋 目录

- [前置要求](#前置要求)
- [安装](#安装)
- [配置](#配置)
- [运行项目](#运行项目)
- [下一步](#下一步)

## 前置要求

在开始之前，请确保你的开发环境满足以下要求：

### 必需

- **Node.js** 18.0 或更高版本
- **pnpm** 8.0 或更高版本
- **Git**

### 可选（用于完整功能）

- **Cloudflare 账号** - 用于部署和 Workers
- **DashScope API Key** - 用于 AI 功能（项目分类、代码重写）
- **Google OAuth 凭证** - 用于 Google 登录
- **GitHub OAuth 凭证** - 用于 GitHub 登录

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/Peiiii/deploy-your-app.git
cd deploy-your-app
```

### 2. 安装依赖

```bash
# 安装所有依赖（包括前端、后端、Workers）
pnpm install
```

这会在以下目录安装依赖：
- `frontend/`
- `server/`
- `workers/api/`
- `workers/r2-gateway/`

### 3. 验证安装

```bash
# 检查 Node.js 版本
node --version  # 应该 >= 18.0

# 检查 pnpm 版本
pnpm --version  # 应该 >= 8.0
```

## 配置

### 后端配置

1. 创建后端环境变量文件：

```bash
cp server/.env.example server/.env
```

2. 编辑 `server/.env`，至少配置以下变量：

```env
# 部署目标（本地开发使用 local）
DEPLOY_TARGET=local

# DashScope API Key（可选，用于 AI 功能）
DASHSCOPE_API_KEY=your_dashscope_key_here

# 数据目录（可选，默认使用 data/）
DATA_DIR=data
```

**最小配置示例：**

```env
DEPLOY_TARGET=local
```

### 前端配置

1. 创建前端环境变量文件：

```bash
cp frontend/.env.example frontend/.env
```

2. 编辑 `frontend/.env`：

```env
# API 基础 URL（本地开发）
VITE_API_BASE_URL=http://localhost:8787/api/v1

# （可选）Crisp 客服聊天 ID
VITE_CRISP_WEBSITE_ID=your_crisp_id
```

### Cloudflare Workers 配置（可选）

如果你要测试 API Worker：

1. 安装 Wrangler CLI（如果还没有）：

```bash
pnpm add -g wrangler
```

2. 登录 Cloudflare：

```bash
wrangler login
```

3. 配置 `workers/api/wrangler.toml`：

```toml
name = "gemigo-api"
compatibility_date = "2024-01-01"

# 更新 account_id
account_id = "your-cloudflare-account-id"
```

4. 创建本地开发变量文件：

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
```

5. 编辑 `workers/api/.dev.vars`：

```env
PASSWORD_SALT=your-random-salt-here
AUTH_REDIRECT_BASE=http://localhost:5173
DEPLOY_SERVICE_BASE_URL=http://127.0.0.1:4173/api/v1
```

## 运行项目

### 方式 1: 同时启动所有服务（推荐）

```bash
pnpm dev
```

这会同时启动：
- 前端开发服务器（通常是 `http://localhost:5173`）
- Node 后端服务（通常是 `http://localhost:4173`）
- API Worker（通过 Wrangler，通常是 `http://localhost:8787`）

### 方式 2: 分别启动服务

```bash
# 终端 1: 启动前端
pnpm dev:frontend

# 终端 2: 启动后端
pnpm dev:server

# 终端 3: 启动 API Worker（可选）
cd workers/api
pnpm dev
```

### 验证运行状态

1. **前端**: 打开浏览器访问 `http://localhost:5173`
2. **后端 API**: 访问 `http://localhost:4173/api/v1/projects`
3. **API Worker**: 访问 `http://localhost:8787/api/v1/me`

## 常见问题

### 端口被占用

如果遇到端口占用问题：

```bash
# 查找占用端口的进程
lsof -i :5173  # 前端
lsof -i :4173  # 后端
lsof -i :8787  # Worker

# 终止进程（替换 PID）
kill -9 <PID>
```

或者修改配置文件中的端口号。

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules frontend/node_modules server/node_modules
rm pnpm-lock.yaml
pnpm install
```

### Cloudflare Workers 本地开发问题

确保：

1. Wrangler 已登录：`wrangler login`
2. 本地开发变量文件存在：`workers/api/.dev.vars`
3. D1 数据库已创建（如果使用 D1 存储）

## 下一步

### 了解项目结构

- 查看 [架构文档](./ARCHITECTURE.md) 了解整体架构
- 查看 [API Worker 架构](./API_WORKER_ARCHITECTURE.md) 了解 API 层设计

### 配置生产环境

- 查看 [部署指南](./DEPLOY.md) 了解如何部署到生产环境
- 查看 [环境变量配置](./ENVIRONMENT.md) 了解所有环境变量

### 设置用户认证

- 查看 [认证设置](./AUTH_SETUP.md) 了解如何配置 OAuth

### 开始开发

- 查看 [贡献指南](../CONTRIBUTING.md) 了解如何贡献代码
- 查看现有代码，了解代码风格和架构模式

## 获取帮助

如果遇到问题：

1. 查看 [文档](./) 目录
2. 搜索 [Issues](https://github.com/Peiiii/deploy-your-app/issues)
3. 创建新的 Issue 或 Discussion

---

**祝你开发愉快！🎉**

