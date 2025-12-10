# GemiGo

<div align="center">

**一个面向非专业用户的前端应用一键部署平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)

[🌐 在线体验](https://gemigo.io) • [功能特性](#-功能特性) • [快速开始](#-快速开始) • [文档](#-文档) • [贡献](#-贡献)

</div>

---

## 📖 简介

GemiGo 是一个面向非专业用户的前端应用一键部署平台。通过简单的操作，你可以将 GitHub 仓库、ZIP 文件或 HTML 代码快速部署为可访问的 Web 应用。

🌐 **在线体验**: [https://gemigo.io](https://gemigo.io)

### ✨ 为什么选择 GemiGo？

- 🚀 **零配置部署** - 无需了解服务器、域名或 SSL 证书，一键即可上线
- ⚡ **极速上线** - 从代码到线上应用，只需几分钟，无需等待
- 🔒 **安全可靠** - 自动部署到 Cloudflare，享受全球 CDN 加速和 DDoS 防护
- 💰 **完全免费** - 无隐藏费用，适合个人项目和小团队使用
- 🎨 **现代 UI** - 美观的界面设计，支持深色模式，体验流畅
- 📊 **实时监控** - 实时查看部署日志和状态，问题一目了然
- 🌍 **中文支持** - 完整的中文界面和文档，使用更便捷

### 🆚 与其他平台对比

| 特性 | GemiGo | Vercel | Netlify | GitHub Pages |
|------|--------|--------|---------|--------------|
| 零配置部署 | ✅ | ✅ | ✅ | ❌ |
| 支持 ZIP 上传 | ✅ | ❌ | ✅ | ❌ |
| 支持 HTML 粘贴 | ✅ | ❌ | ❌ | ❌ |
| 实时部署日志 | ✅ | ✅ | ✅ | ❌ |
| 中文界面 | ✅ | ❌ | ❌ | ❌ |
| 完全免费 | ✅ | ⚠️ 有限制 | ⚠️ 有限制 | ✅ |
| 探索应用市场 | ✅ | ❌ | ❌ | ❌ |
| 项目收藏点赞 | ✅ | ❌ | ❌ | ❌ |

### 核心能力

- 🚀 **一键部署** - 支持 GitHub 仓库、ZIP 文件和 HTML 代码部署
- 🔒 **安全可靠** - 自动构建和部署到 Cloudflare Pages/R2
- 📊 **实时监控** - 通过 SSE 实时查看部署日志和状态
- 🎨 **现代 UI** - 响应式设计，支持深色模式
- 👥 **用户体系** - 支持邮箱、Google、GitHub 登录
- 🌐 **应用市场** - 探索和分享其他用户部署的应用

## ✨ 功能特性

### 部署能力

- ✅ 从 GitHub 仓库部署（支持 HTTPS 和 SSH 格式）
- ✅ 上传 ZIP 文件部署
- ✅ 粘贴 HTML 代码直接部署
- ✅ 自动识别构建输出目录（`dist/`、`build/`、`out/`）
- ✅ 自动执行依赖安装和项目构建
- ✅ 部署到 Cloudflare Pages 或 R2 存储
- ✅ 自动修复常见构建问题

### 前端界面

- ✅ Dashboard 展示所有项目
- ✅ 实时部署日志流（SSE）
- ✅ 项目状态跟踪（Live / Building / Failed）
- ✅ 深色模式支持
- ✅ 响应式设计

### 用户体系

- ✅ 邮箱注册/登录
- ✅ Google OAuth 登录
- ✅ GitHub OAuth 登录
- ✅ 会话管理

### 应用市场

- ✅ 探索其他用户部署的应用
- ✅ 按分类和标签筛选
- ✅ 点赞和收藏功能
- ✅ 搜索和排序功能

## 🚀 快速开始

### 前置要求

- Node.js 18+ 和 pnpm
- Cloudflare 账号（用于部署）
- （可选）阿里云服务器（用于 Node 部署服务）

### 安装

```bash
# 克隆仓库
git clone https://github.com/Peiiii/deploy-your-app.git
cd deploy-your-app

# 安装依赖
pnpm install
```

### 本地开发

```bash
# 启动所有服务（前端 + API Worker + Node 服务）
pnpm dev

# 或分别启动
pnpm dev:frontend  # 前端开发服务器
pnpm dev:server    # Node 后端服务
```

### 配置环境变量

详细的环境变量配置请参考 [环境变量文档](./docs/ENVIRONMENT.md)。

**最小配置（本地开发）：**

1. 创建 `server/.env`：
```env
DEPLOY_TARGET=local
DASHSCOPE_API_KEY=your_dashscope_key  # 可选，用于 AI 功能
```

2. 创建 `frontend/.env`：
```env
VITE_API_BASE_URL=http://localhost:8787/api/v1
```

## 📚 文档

完整的文档位于 [`docs`](./docs) 目录：

- [快速开始指南](./docs/GETTING_STARTED.md) - 详细的安装和配置步骤
- [架构文档](./docs/ARCHITECTURE.md) - 系统架构和技术栈说明
- [API Worker 架构](./docs/API_WORKER_ARCHITECTURE.md) - API Worker 的详细说明
- [环境变量配置](./docs/ENVIRONMENT.md) - 完整的环境变量说明
- [认证设置](./docs/AUTH_SETUP.md) - 用户体系和 OAuth 配置
- [部署指南](./docs/DEPLOY.md) - 生产环境部署说明
- [功能文档](./docs/FEATURES.md) - 功能详细说明

## 🏗️ 技术栈

### 前端

- **框架**: React 19 + TypeScript
- **构建工具**: Vite (Rolldown)
- **状态管理**: Zustand
- **路由**: React Router
- **UI**: Tailwind CSS + 自定义组件
- **国际化**: i18next

### 后端

- **API Worker**: Cloudflare Workers (TypeScript)
- **部署服务**: Node.js + Express
- **数据库**: Cloudflare D1
- **存储**: Cloudflare R2 / Pages
- **认证**: OAuth 2.0 (Google, GitHub) + Session

### 基础设施

- **前端托管**: Cloudflare Pages
- **API 网关**: Cloudflare Workers
- **部署服务**: Docker + 阿里云服务器
- **CI/CD**: GitHub Actions

## 📁 项目结构

```
deploy-your-app/
├── frontend/          # React 前端应用
│   ├── src/
│   │   └── gemini-deploy/
│   │       ├── components/    # UI 组件
│   │       ├── pages/         # 页面
│   │       ├── managers/      # 业务逻辑管理器
│   │       └── services/      # API 服务
│   └── package.json
│
├── workers/           # Cloudflare Workers
│   ├── api/          # API Worker (用户体系、项目 CRUD)
│   ├── r2-gateway/   # R2 存储网关
│   └── screenshot-service/  # 截图服务
│
├── server/           # Node.js 部署服务
│   ├── src/
│   │   ├── modules/  # 业务模块
│   │   ├── routes/   # 路由
│   │   └── common/   # 通用工具
│   └── package.json
│
├── docs/             # 项目文档
├── scripts/          # 部署和工具脚本
└── package.json      # 根 package.json (monorepo)
```

## 🤝 贡献

我们欢迎所有形式的贡献！请查看 [贡献指南](./CONTRIBUTING.md) 了解详细信息。

### 贡献方式

- 🐛 报告 Bug
- 💡 提出功能建议
- 📝 改进文档
- 🔧 提交代码

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE)。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

## 📮 联系方式

- **官方网站**: [https://gemigo.io](https://gemigo.io)
- **Issues**: [GitHub Issues](https://github.com/Peiiii/deploy-your-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Peiiii/deploy-your-app/discussions)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐ Star！**

Made with ❤️ by the GemiGo team

</div>
