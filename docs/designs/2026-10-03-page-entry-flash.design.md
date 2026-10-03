# 页面进入闪跳修复

用户在视频流浮层修复后报告“这个页面一进来之后会突然闪一个东西”。当前按同一探索页入口调查，已向用户询问更具体的触发；直接复现到生产首屏静态介绍整块被应用替换。bugfix / L2，授权沿AGENTS.md全托管交付。retrospective_state=pending，plan=not-required。

## 根因与冻结方案

生产探索页HTML的 #root 首先展示 renderSeoContent 的标题、段落与链接，React createRoot随后完全替换为应用。延迟主JS即可稳定截图“发现社区创作的应用”文字页，然后变为“探索应用”页面；并非语言按钮残留。iframe进入有独立白色初始背景，但本轮没有证据确认用户指向该分支，不借此扩展交互模型。

入口→结果：打开探索页/首页→主JS仍在下载时，只看到稳定的灰色加载占位→React首个提交前清理启动状态→正常应用页和已有数据加载骨架→进入视频流/应用，不再展示启动文字页。无JS访问仍读到同一SEO内容；主JS加载失败恢复该可读页面及链接。首屏正常快速加载也不能先绘制介绍文字。

选择在现有 index.html 以小型内联启动标记建立JS增强态，用内联关键CSS展示启动占位并隐藏初始SEO内容；App首次layout effect退出该状态，与首个commit同帧，无最低停留时间。占位放在root之外，Pages HTMLRewriter只替换root故无需修改SEO文本生成/Worker响应。主入口script有明确加载失败回退，禁用JS默认无增强态。使用既有中性灰卡片形态、响应式布局和减少动画偏好，不新增spinner、第三方依赖、状态store或SSR体系。侧栏预留宽度读取同一既有偏好键，与已保存折叠状态一致。

直接删SEO正文会破坏已交付无JS阅读合同；单独缩短JS下载不能保证不闪；延时隐藏在脚本下载之后已太晚。只在冷启动阶段隐藏，运行后现有PublicInfo继续显示相同正文，所有UA得到同一内容。抽象审计：启动边界归HTML和App首commit；不把加载状态分发到路由/组件，不新增通用管理器。CSS占位只服务模块尚未执行阶段，React内数据等待仍归已有Skeleton。

design-review: passed。核对首个paint前标记、首commit清理、SEO正文无JS及失败可读、无新持久化状态、快速/慢速/窄屏/折叠侧栏/存储不可用/脚本失败与JS禁用路径；无未解决finding。

## 验证与交付合同

- 原触发：生产真实响应延迟主JS，修前可见介绍页；当前构建延迟主JS后介绍正文不可见而占位可见，释放JS后正常页且占位消失，无文本闪跳。
- 浏览器验证首commit正常、慢JS、失败回退、无JS内容、中英文、窄屏、已保存侧栏折叠和存储不可用，逐帧观察初始文字可见性；已进入应用的加载逻辑保持。
- 前端类型、定向lint、HTML/Pages SEO组装回归、build和diff-only Review；精确提交推送、主区master同步、既有deploy:pages发布、生产资源身份与延迟模块入口复验。用户入口 https://gemigo.io/explore 。

## 引入点与开发证据

用户补充“之前没这个问题，刚才某个改动导致”。git历史确认10dbf69（2026-10-03 13:40:56）的SEO改动把 index.html 的空root替换为正文占位，并由构建/Pages插入静态介绍。f8244ad仅删除视频流语言浮层；325af71调整Tooltip可见性；379aae3复用列表加载骨架，这些提交没有引入原始HTML文字页。生产延迟JS的修前截图 /tmp/gemigo-entry-flash-before.png 保存了同一静态介绍→React应用切换。

scripts/test-page-bootstrap.mjs 使用本次production build及真实Chrome逐帧验证慢模块下载：初始正文在全部预commit帧不可见、占位可见，释放模块后React首commit退出增强态；1440px/390px、已保存64px侧栏、reduce motion、视频流切换不会恢复启动占位。模块网络失败和拒绝Storage导致的上游启动异常均恢复可读正文（不把已有其它模块的Storage异常宣称修复）；禁用JS仍看到原正文/链接。桌面/窄屏截图逐张核对，无横向或启动滚动溢出。

前端tsc、app与新增脚本定向ESLint零告警、build、git diff --check均通过；原真实Pages HTMLRewriter回归验证双语原始正文、metadata、canonical/hreflang、private noindex、404/HEAD、资源类型、API流式代理全部通过。构建仅既有Browserslist/bundle提示。

diff-only人工可维护性/implementation Review: no findings。项目无独立自动入口；核对启动标记发生在首paint之前、App layout effect只首commit运行、加载失败事件覆盖Vite生产输出（不依赖被Vite去掉的script id）、noJS默认正文、SEO owner未复制、持久化键只读、占位不干扰业务/认证。implementation-review=passed。
