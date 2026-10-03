# 前端交互规范

## 操作图标

所有以图标表达的操作（包括图标加计数、窄屏隐藏名称、折叠导航）必须使用 `src/components/icon-button.tsx` 的 `IconButton`。悬停和键盘聚焦显示统一 Tooltip；必填 `label` 同时作为可访问名称，使用现有 i18n 文案。禁止只补原生 `title` 或手写提示浮层。

ESLint `gemigo-ui/icon-actions` 拦截直接使用 Lucide 图标的裸按钮、链接或可点击 div；条件图标与图标加计数同样检查。动态组件、响应式隐藏文本等语义仍须按本规范 Review。TypeScript 强制 `IconButton.label`，组件自动生成 Tooltip，禁止通过 `title` 绕过。

```tsx
<IconButton label={t('common.close')} size="sm" onClick={onClose}>
  <X className="h-4 w-4" aria-hidden="true" />
</IconButton>
```

尺寸 `xs/sm/md/lg` 对应 24/32/36/44px，默认 md。`auto` 用于既有响应式、计数或混合文本布局，由调用方 className 管理尺寸。颜色、状态和业务动作由调用方提供。`tooltip` 可增加计数等补充信息，组件始终保留操作名称；`tooltipSide` 可调整首选方向，组件自动避让视口边缘。

链接或已有语义组件使用 `asChild`，保持真实元素和事件，不嵌套按钮：

```tsx
<IconButton asChild label={t('common.openInNewTab')}>
  <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
</IconButton>
```

应用根部统一 `TooltipProvider`；Popover 触发器复用 `IconButton`。有可见名称的普通文字按钮和装饰性图标无需图标按钮组件。禁用、pressed、expanded、控件 ref、analytics 事件继续保留在原调用方，Tooltip 不代替权限或焦点管理。
