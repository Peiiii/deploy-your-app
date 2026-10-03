# 侧栏对齐回归调查

用户截图指出展开侧栏原本左对齐的导航变成居中，并要求修复和追查引入会话。flow=bugfix，局部视觉 L1；skip-design：根因、单 owner 与恢复标准明确，不改变交互或数据合同。

## 引入来源与根因

- 提交 `f0cd5daef96b734e970adf852e47304ee878b6f6`，2026-10-03 11:40:29 +0800，`feat(ui): add adjacent comments panel and shared icon tooltips`。
- Codex 会话「扩展内容操作入口」，ID `01a0fda2-5c1a-7182-b898-377c2f977434`。会话交付记录明确列出 f0cd5da；用户追加要求统一操作图标 Tooltip 和可复用组件，并未要求导航改为居中。
- 该提交将 SidebarNavigation 与 SidebarUserProfile 的原生 button 替换成 IconButton。共享组件自带 `justify-center`，展开侧栏没有覆盖它，产生视觉回归；其后的合并和上线保留了这个变化。
- 线上修前复现：六项导航 computed justifyContent 全部 center，图标相对按钮左边距分别 85.5/71.5/71.5/78.5/71.5/85.5px，文字宽度影响图标位置。

## 修复与证据

- 仅在两个侧栏调用方的展开分支增加 `!justify-start`，明确覆盖共享组件默认值；折叠分支继续 center，保留统一 Tooltip、点击、权限与 analytics。
- 本地实际渲染：展开四项游客导航全部 flex-start，图标左边距统一 16px；账户入口 flex-start。折叠按钮 40px、图标 20px、左右边距 10px；键盘聚焦出现 Tooltip，导航至探索后 aria-current 正确。
- frontend 类型检查通过，先构建 public-author/product-analytics 类型声明以满足隔离 worktree 的依赖；定向 ESLint、diff check、生产构建通过。
- 项目未提供独立 diff-only maintainability 脚本；人工审查两个调用方的 diff 与共享组件，no findings。无新增公共 API 或全局样式变化。
## 上线与收尾

- 修复 `82ef640` 已普通推送 master，主工作区安全快进，原有并行 WIP 未暂存、未覆盖；本任务两个源码文件无遗留草稿。
- 标准 `pnpm deploy:pages` Published，Pages commit `b9f850300baf2bd6d8278f740e294f08711d1db7`，回退发布 `5d5083363b7bc74b79e4e141ab20dd2039f6ec88`。
- 线上浏览器实际消费 `index-C_aJZNDd.js` / `index-CEqJScMf.css`；登录用户六项导航全部 flex-start、图标左边距 16px，账户入口 flex-start。收起后六项均 center、40px宽/20px图标/10px边距，再展开恢复左对齐；截图 `/tmp/gemigo-sidebar-alignment-fixed.png`。
- 用户可刷新 https://gemigo.io/ 查看侧栏，切换展开/折叠核对对齐。未改变数据操作，原 tooltip/点击代码保留；主观体验仍由用户确认。
- retrospective_state=completed，retrospective_decision=no-increment：单次组件迁移漏验已修复并用真实渲染证明，无需增加共享流程或全局规则。本记录只保留用户要求的归因证据。

## 追加：展开/收起按钮形状

- 用户补充截图要求核对原来的圆形按钮。`git show f0cd5da -- frontend/src/components/sidebar/sidebar-header.tsx` 证明同一会话/提交把原生 button 改为 IconButton，调用方的 `rounded-full` 未删除；共享组件的 `rounded-md` 因 CSS 生成顺序覆盖它。线上修前 24×24px，computed borderRadius=6px。
- 局部恢复圆形：该调用方使用 `!rounded-full`，不依赖 className 字符串顺序。按钮尺寸、箭头、阴影、事件和 Tooltip 不变。
- frontend 类型检查、header 定向 ESLint、diff check、生产构建通过；人工 diff Review no findings。独立本地地址实际渲染：展开/折叠均 24×24px、borderRadius=9999px，切换正常、键盘 Tooltip 正确，截图确认圆形；L1 bugfix，skip-design 依据同上。
- 追加形状修复待上线，retrospective_state=pending。
