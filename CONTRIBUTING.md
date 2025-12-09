# 贡献指南

感谢你对 GemiGo 项目的兴趣！我们欢迎所有形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)

## 行为准则

请遵循以下原则：

- 尊重所有贡献者
- 接受建设性批评
- 专注于对社区最有利的事情
- 对其他社区成员表示同理心

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请：

1. 检查 [Issues](https://github.com/Peiiii/deploy-your-app/issues) 确认该 Bug 尚未被报告
2. 创建一个新的 Issue，包含：
   - 清晰的标题和描述
   - 复现步骤
   - 预期行为和实际行为
   - 环境信息（浏览器、Node.js 版本等）
   - 相关截图或日志

### 提出功能建议

我们欢迎新功能的建议！请：

1. 检查现有 Issues 和 Discussions
2. 创建 Issue 或 Discussion，详细描述：
   - 功能的使用场景
   - 预期的用户体验
   - 可能的实现方案（可选）

### 改进文档

文档改进同样重要：

- 修复拼写错误
- 澄清模糊的说明
- 添加缺失的示例
- 改进翻译

### 提交代码

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 开发环境设置

### 前置要求

- Node.js 18+
- pnpm 8+
- Git
- Cloudflare 账号（用于测试 Workers）

### 安装步骤

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/Peiiii/deploy-your-app.git
cd deploy-your-app

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp server/.env.example server/.env
cp frontend/.env.example frontend/.env

# 编辑 .env 文件，填入必要的配置
```

### 本地开发

```bash
# 启动所有服务
pnpm dev

# 或分别启动
pnpm dev:frontend  # http://localhost:5173
pnpm dev:server    # http://localhost:4173
```

### 运行测试

```bash
# 类型检查
pnpm --filter deploy-your-app-frontend run type-check
pnpm --filter deploy-your-app-server run type-check

# Lint
pnpm lint
```

## 代码规范

### TypeScript

- 使用 TypeScript 严格模式
- **禁止使用 `any` 类型**
- 优先使用接口而非类型别名（除非需要联合类型）
- 使用有意义的变量和函数名

### React

- 使用函数组件和 Hooks
- 组件文件使用 PascalCase 命名
- Props 接口命名为 `ComponentNameProps`
- 避免不必要的 `useMemo` 和 `useCallback`

### 代码风格

- 使用 2 空格缩进
- 使用单引号（字符串）
- 尾随逗号（对象、数组）
- 最大行长度：100 字符

### 文件组织

```
component/
├── ComponentName.tsx      # 主组件
├── ComponentName.test.tsx # 测试文件
└── types.ts               # 类型定义（如需要）
```

### 注释

- 代码应该自解释，避免不必要的注释
- 复杂逻辑需要注释说明
- 使用 JSDoc 注释公共 API

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更改
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 示例

```bash
# 功能
git commit -m "feat(dashboard): add project search functionality"

# Bug 修复
git commit -m "fix(auth): resolve login redirect issue"

# 文档
git commit -m "docs(readme): update installation instructions"
```

## Pull Request 流程

### 创建 PR 前

1. ✅ 确保代码通过 lint 检查
2. ✅ 确保类型检查通过
3. ✅ 更新相关文档
4. ✅ 添加必要的测试（如适用）

### PR 标题

使用清晰的标题，格式：`<type>: <description>`

示例：
- `feat: Add project search feature`
- `fix: Resolve authentication redirect issue`

### PR 描述

请包含：

1. **变更说明** - 这个 PR 做了什么？
2. **动机** - 为什么需要这个变更？
3. **测试** - 如何测试这些变更？
4. **截图** - 如果是 UI 变更，请附上截图
5. **相关 Issue** - 关联的 Issue 编号

### 审查流程

1. 提交 PR 后，CI 会自动运行检查
2. 维护者会审查代码
3. 根据反馈进行修改
4. 审查通过后，维护者会合并 PR

### PR 检查清单

- [ ] 代码遵循项目规范
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 提交信息符合规范
- [ ] 没有合并冲突
- [ ] 变更经过充分测试

## 项目特定指南

### 前端开发

- 使用 `Presenter` 模式管理业务逻辑
- 通过 `ServiceFactory` 获取服务提供者
- 使用 Zustand 进行状态管理
- 遵循现有的组件结构

### API Worker 开发

- 遵循 Controller → Service → Repository 分层
- 在 `routes.ts` 中注册新路由
- 使用 `AppError` 子类处理错误
- 参考 [API Worker 架构文档](./docs/API_WORKER_ARCHITECTURE.md)

### Node 服务开发

- 遵循模块化结构
- 使用 TypeScript 严格类型
- 参考现有的模块组织方式

## 获取帮助

如果你在贡献过程中遇到问题：

1. 查看 [文档](./docs)
2. 搜索现有 Issues
3. 创建新的 Issue 或 Discussion
4. 联系维护者

## 致谢

感谢所有贡献者！你的贡献让 GemiGo 变得更好。

---

**Happy Contributing! 🎉**

