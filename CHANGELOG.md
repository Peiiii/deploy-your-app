# Changelog

本文档记录 GemiGo 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中

- 支持更多前端框架（Next.js, Vue, SvelteKit）
- 部署历史记录
- 回滚功能
- 环境变量管理
- 自定义域名绑定

## [0.1.2] - 2024-01-XX

### 新增

- 用户认证系统（邮箱、Google、GitHub OAuth）
- 项目收藏和点赞功能
- 探索页面和应用分类
- 多语言支持（中文、英文）
- 深色模式
- R2 存储部署支持

### 改进

- 优化 Dashboard 页面加载状态
- 修复侧边栏导航项布局问题
- 改进部署日志实时显示
- 优化前端代码结构

### 修复

- 修复 Dashboard 页面刷新时闪现未登录状态的问题
- 修复侧边栏导航项在刷新时挤在一起的问题

## [0.1.0] - 2024-01-XX

### 新增

- 基础部署功能
  - 支持 GitHub 仓库部署
  - 支持 ZIP 文件上传部署
  - 自动构建和部署
- Dashboard 界面
  - 项目列表展示
  - 项目状态跟踪
  - 快速访问链接
- 部署向导
  - 引导式部署流程
  - 实时日志显示（SSE）
- Cloudflare Pages 部署支持
- 本地部署支持

### 技术栈

- React 19 + TypeScript + Vite
- Cloudflare Workers + D1
- Node.js + Express
- Docker

---

## 版本说明

- **[Unreleased]**: 计划中的功能
- **[版本号]**: 已发布的版本

## 变更类型

- **新增**: 新功能
- **改进**: 现有功能的改进
- **修复**: Bug 修复
- **废弃**: 即将移除的功能
- **安全**: 安全相关的修复

---

**注意**: 详细的变更记录请查看 Git 提交历史。

