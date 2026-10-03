# 视频流语言浮层修复

2026-10-03 用户截图指出视频流进入具体应用后，左上角每页都显示“想看哪些语言的应用？”，要求立即修复。bugfix，UI L2；按 AGENTS.md 全托管授权精确提交、普通推送、master 同步、前端上线；retrospective_state=pending。

## 证据与设计

生产 https://gemigo.io/explore 实际进入视频流、滚到 qingshui 并点击进入应用，固定语言按钮仍存在。按钮来自 ExploreFeed 内的独立 fixed top-20 left-4 z-[120] 容器，无条件渲染，与 showHeader/isAnyAppEntered 无关，覆盖应用内容。它不是 Tooltip，也不是被嵌入应用的内容。

用户链路：探索列表按内容语言筛选 → 视频流浏览 → 进入应用交互 → 连续切换应用 → 退出回列表。视频流中不再出现这块固定语言按钮；列表保留现有内容语言筛选，所选语言继续过滤视频流，空结果仍能“浏览全部”。

选择删除视频流重复的悬浮筛选入口及其 languageOpen 状态/import。仅在进入应用时隐藏仍会在每页预览覆盖内容，挪到另一位置继续保留额外浮层，不符合用户要求。语言状态继续归 useAppLanguageStore，列表 AppLanguageFilter 是已有可用入口；不改变存储、过滤请求、iframe、滚动或互动状态。抽象审计：单个无收益展示路径，直接删除，无新抽象/依赖。plan=not-required，单批闭环。

design-review: passed。对照原图核对覆盖源、列表筛选仍可访问、既有语言选择传给视频流、空状态恢复入口保留；无未解决 finding。

## 验收

- 当前源码连接生产公开 API：列表选择语言后进入视频流，首屏和连续切换页无固定语言按钮；进入 qingshui 等真实应用后 iframe 仍可显示，左上角无语言浮层。
- 退出回列表可打开内容语言筛选并改选；再次进视频流无浮层，窄屏同样成立。
- 前端 tsc、文件定向 ESLint、生产构建、diff-only Review；发布后检查生产资源身份及同一用户链路。

本任务不包含并行 Tooltip 修复或其它界面设计。

## 开发验证与 Review

当前源码 localhost:5307 连接生产公开 API，实际浏览 qingshui、进入 iframe、连续滚到 33store 并进入，通过：语言悬浮按钮始终不存在，前一个 iframe 退出，后一个 iframe 正常显示。1512px 桌面和390px窄屏截图直接检查通过。退出应用→滚回顶部→退出视频流→打开列表内容语言→选择英语，持久化为 zh/en→再次进入视频流，仍无浮层且语言选择保留。

前端 tsc 通过（先按项目 tsc -b 构建 public-author/product-analytics 声明，避免把未生成声明造成的 D1 类型缺失误当源码错误）；文件 ESLint 零告警、生产构建、diff-check 通过。只有既有 Browserslist/bundle 提示。项目没有独立 diff-only maintainability 入口；人工 diff-only Review 核对6行删除与相邻页面/语言store/退出和空状态恢复路径：no findings，implementation-review=passed。未新增状态或数据合同。
