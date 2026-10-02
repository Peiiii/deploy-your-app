# 学习与教育分类

## 目标与取舍

来源：用户于 2026-10-02 指出当前缺少学习/教育类别，认为这是必要类别，并计划将它作为主打方向。

采用一个 `Education` 类别，中文「学习与教育」，英文「Education」。学习者与教学者使用的工具、练习和教学小游戏高度重叠；拆成 Learning/Education 会产生选类歧义。仅用标签无法提供用户要求的一级分类入口。将该类放在「全部应用」后第一位，为主打方向提供可见入口，默认仍显示全部应用。

流程：standard，feature，风险 L2，retrospective_state=pending。本次单批完成，plan: not-required；跨前端、Worker 和 Node 分类声明，design-document: required。

## 用户链路与验收

1. 访客打开首页或探索应用页，在全部应用后的第一项看到「学习与教育」；点击后通过原探索请求发送 `category=Education`，只展示该类别的公开项目。切回全部应用后恢复全量浏览；空结果复用已有空态。英文界面显示 Education，移动端复用现有横向滚动分类栏。
2. 创作者通过现有 HTML/ZIP/GitHub 发布链路提供学习或教学应用内容，已有 AI 元数据服务能返回 Education，并通过原项目保存链路写入分类；数学练习、识字、课程测验等具有明确学习目的的游戏优先选 Education，普通娱乐游戏仍用 Fun。项目设置原有文本字段可手动填写 Education，保存后可被筛选。

AI 验证：受影响 TypeScript 类型检查、定向 lint、前端构建；组装真实 AI 服务并替换外部模型请求，断言两种运行时的提示词/响应接受 Education，Node 单独分类路径也覆盖；浏览器核对两个入口的顺序、文案和点击后的请求与空态。外部模型真实分类质量不由模拟响应证明，分类依赖内容质量与模型判断。

## 传播与 owner

| 边界 | 现状与本次处理 |
| --- | --- |
| 首页/探索分类 | 现有两份列表、联合类型和文案映射均补 Education，顺序一致 |
| 本地化 | en、zh-cn 资源增加 explore.education |
| AI 生产者 | Node 与 Worker 的已有 MARKETPLACE_CATEGORIES 均补 Education；元数据提示词增加教育场景及与 Fun 的分界；Node 独立分类 schema 改为使用自己的列表，去掉手写枚举描述 |
| parser | Node 现有列表匹配可接受新增值；Worker 现有字符串解析可接受新增值 |
| 项目存储/更新/API/CLI | category 已是自由字符串，D1 TEXT 与文件存储无迁移、无需改变接口 |
| 查询 consumer | Worker queryProjects 使用 category = ?，现有前端 feed/manager 传入选中值，复用原查询路径 |
| 部署/升级 | 按既有授权精确提交并推送 origin/master；Node 自动部署由现有 CI 触发；前端与 API 的线上生效只在实际发布和验收后声明 |

保留已有运行时 owner 和项目 category 状态，不新增共享包、服务或第二套项目。各运行时当前有独立构建和部署路径，本次为已有闭集添加一项；跨运行时目录收敛会引入额外 package 与构建合同，延后到专门治理分类目录时处理。本次不新增平行配置。保留旧数据；不按名字批量重分类、不引入学科/年级新字段、不改变默认页或实现完整教育平台。

## 方案 Review

mode=design：从用户原意核对两个探索入口、双语、AI 分类生产者、字符串存储和精确查询链路。教育游戏与 Fun 的重叠通过提示词边界处理；旧项目不会因新增类别被自动迁移。原发布和空态路径保持有效，无新权限或恢复机制。抽象审计通过：字段和规则均有当前消费者，未新增包或状态 owner。design-review: passed，findings: none。

## 真实链路发现的筛选竞态

浏览器实际点击 Education 后，观察到新类别 page=2 先于 page=1 发出，随后界面混有旧的 Productivity/Fun 项目；公开 API 的同一 Education 查询只返回一份 Education 项目，故数据库筛选有效，问题在前端请求提交状态。ExploreManager 当前无请求新旧判定，切类只重置 page，保留旧 apps/hasMore；首页已有请求编号保护。

补充方案：Explore store 切类时同时清空 apps/hasMore；ExploreManager 用请求编号和请求时的 category/tag/search 快照守卫响应、错误与 finally，仅当前请求能更新状态。复用现有 owner，不新增服务；旧类别响应在切换后的 debounce 窗口也不能提交。验证通过可控延迟让旧请求晚于新请求返回，检查 apps/page/hasMore/loading 仍对应新类别，并重新验证浏览器快速切类与回到全部应用。补充 design-review: passed，findings: none。

## 验证与实现 Review

- `pnpm typecheck`、受影响源码及回归脚本的定向 ESLint、`pnpm build:frontend`、`git diff --check` 全部通过。构建只存在原有 Browserslist 和 bundle 大小提示。
- `node scripts/test-explore-category.mjs` 组装真实 store/manager/HTTP adapter，通过旧类别晚到、切回全部、同类刷新乱序、重复点击当前类别的回归；卡片映射和无关浏览器服务为测试替身。
- 临时边界验证运行真实 Node 单类分类、Node 元数据和 Worker 元数据入口：请求 schema/提示词含 Education 与教学游戏优先规则，模拟模型返回可被接受。未调用真实外部模型，不以此证明模型准确率。
- 本地前端使用生产公开 API，实际点击首页与探索网格分类、切换中英文，观察 `category=Education` 请求与唯一 Education 作品「滕王阁序互动教学」。修前真实界面混入旧分类，修后已恢复只显示对应类别。
- mode=implementation：按本次 diff 和相邻查询/存储合同审查，无独立 diff-only maintainability 脚本；发现重复点击当前类别清空列表的风险后已修复并重验。最终 findings: none，acceptance-ready。

## 复盘

retrospective_decision=no-increment：分类含义与边界已保存在本设计，实际发现的请求竞态由产品修复和回归脚本承接；没有需要新增全局规则的经验。部署状态以实际交付结果为准，不能由本地验证推断线上生效。
