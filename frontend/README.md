# 前端交互规范

## 操作图标

只有没有可见操作名称的图标入口（包括图标加计数、窄屏隐藏名称、折叠导航）在悬停和键盘聚焦时显示 Tooltip。带可见文字的按钮、展开导航、文字菜单触发器不显示重复提示；装饰图标不显示 Tooltip。纯图标操作必须使用 `src/components/icon-button.tsx` 的 `IconButton`；必填 `label` 提供可访问名称，使用现有 i18n 文案。禁止只补原生 `title` 或手写提示浮层。

ESLint `gemigo-ui/icon-actions` 拦截直接使用 Lucide 图标的裸按钮、链接或可点击 div，以及有文字名称但未控制 Tooltip 的 `IconButton`；条件图标与图标加计数同样检查。动态组件、响应式隐藏文本等语义仍须按本规范 Review。TypeScript 强制 `IconButton.label`，禁止通过 `title` 绕过。

`showTooltip` 默认 true，只适用于无可见名称的图标入口。混合入口必须显式控制：静态文字用 `showTooltip={false}`；导航用 `showTooltip={collapsed}`；`hidden sm:inline` 名称用已有 `useBreakpoint().isBelow('sm')`，与文字断点一致。文字重新出现时立即关闭已打开提示，保留按钮 DOM、焦点与 ref。数字计数、头像缩写和「+」等图形标识不属于操作名称。普通文字按钮继续使用普通按钮；文字 Popover 统一关闭 Tooltip。

```tsx
<IconButton label={t('common.close')} size="sm" onClick={onClose}>
  <X className="h-4 w-4" aria-hidden="true" />
</IconButton>
```

尺寸 `xs/sm/md/lg` 对应 24/32/36/44px 高度和最小宽度，默认 md，横向内边距为4/8/10/12px。计数与图标一起放入组件，按钮自然增宽，不挤压图标或文字。卡片点赞使用 sm，整个圆角矩形（包括内边距）都属于按钮热区；保留 stopPropagation，边缘命中也不会打开卡片。

默认 `variant="ghost"` 提供统一圆角矩形、hover/active 底色反馈及过渡。`plain` 用于已有整张应用交互遮罩等由业务提供反馈的入口。`auto` 用于既有响应式或混合文本布局，由调用方 className 管理尺寸；新图标操作优先标准尺寸。颜色、状态和业务动作由调用方提供。`tooltip` 可增加计数等补充信息，组件始终保留操作名称；`tooltipSide` 可调整首选方向，组件自动避让视口边缘。

链接或已有语义组件使用 `asChild`，保持真实元素和事件，不嵌套按钮：

```tsx
<IconButton asChild label={t('common.openInNewTab')}>
  <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
</IconButton>
```

应用根部统一 `TooltipProvider`；Popover 触发器复用 `IconButton`。有可见名称的普通文字按钮和装饰性图标无需图标按钮组件。禁用、pressed、expanded、控件 ref、analytics 事件继续保留在原调用方，Tooltip 不代替权限或焦点管理。

## 侧栏导航

导航容器统一负责纵向排列，展开、收起及宽度动画期间始终一项一行，不依赖按钮是 `flex` 还是 `inline-flex`。展开时图标和文字左对齐；折叠时图标居中，图标保持20px、按钮40px。展开/收起控件保持圆形。

替换交互组件须保留这些布局约束；导航仅折叠时显示 Tooltip，展开时关闭。验证必须覆盖动画中间帧、多次往返切换，不能只核对两个最终状态。
