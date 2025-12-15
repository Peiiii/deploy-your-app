# Feature-Based 架构规范

## 核心概念

采用**分形结构**组织代码：每个层级都可以包含 `features/` 和技术分类目录（`components/`、`hooks/` 等），且可以无限嵌套。

## 目录模式

每个层级可以包含以下**可选**子目录：

```
[any-level]/
├── features/       # 子功能模块（可嵌套）
├── components/     # UI 组件
├── hooks/          # React Hooks
├── stores/         # 状态管理
├── services/       # API/业务服务
├── managers/       # 管理器类
├── utils/          # 工具函数
└── types/          # TypeScript 类型
```

## 规则

1. **分形嵌套** — `features/xxx/features/yyy` 允许无限嵌套
2. **按需创建** — 子目录不强制，按实际需要添加
3. **同级共存** — `features/` 可与 `components/`、`hooks/` 等平级共存
4. **高内聚** — 相关代码就近放置
5. **绝对路径导入** — 使用 `@/` 前缀导入，不使用 `index.ts` 统一导出

### 路径别名

```typescript
// ✅ 正确：使用 @/ 绝对路径
import { useAuthStore } from '@/stores/authStore';
import { HomeDeploySection } from '@/features/home/components/HomeDeploySection';

// ❌ 错误：使用相对路径
import { useAuthStore } from '../../../stores/authStore';
```

**配置位置：**
- `tsconfig.app.json` — `paths: { "@/*": ["./src/gemini-deploy/*"] }`
- `vite.config.ts` — `alias: { '@': './src/gemini-deploy' }`

## 示例

```
src/
├── features/
│   ├── deployment/
│   │   ├── components/
│   │   │   └── DeploymentCard.tsx
│   │   ├── stores/
│   │   │   └── deploymentStore.ts
│   │   ├── features/              ← 嵌套子功能
│   │   │   └── build-log/
│   │   │       ├── components/
│   │   │       └── hooks/
│   │
│   └── auth/
│       ├── components/
│       └── managers/
│
├── components/                    ← 根级共享组件
├── hooks/                         ← 根级共享 hooks
├── stores/                        ← 根级共享状态
└── services/                      ← 根级共享服务
```

## 命名

- Feature 目录：`kebab-case`（如 `project-settings`）
- 组件文件：`PascalCase.tsx`（如 `DeploymentCard.tsx`）
- 其他文件：`camelCase.ts`（如 `deploymentStore.ts`）
