# 嵌入预览摄像头权限修复

2026-10-03，bugfix / L2，retrospective_state=pending。用户截图“纸境 · 体感素描游戏”开启摄像头后显示未授权；目标是在 GemiGo 网页嵌入打开时能正常向浏览器申请摄像头。

## 事实与范围

线上应用 https://paper-quest-motion.gemigo.app/，首页浮动预览由 `AppPreviewContent` 承载，探索视频流由 `ExploreFeed` 承载。两者跨域 iframe 都没有 media `allow` 声明。首页完整 UI → 测试跨源应用 → 实际 getUserMedia 修前复现：预先授予浏览器 camera/microphone 仍然 policy=false，返回 NotAllowedError。平台和应用线上 HTTP 响应未设置 Permissions-Policy 禁令。截图本身不能判定用户操作系统/浏览器的真实设备授权状态。

仅修复网站两个嵌入入口，不修改上传应用、浏览器扩展或原生宿主权限。手机原有新标签打开路径继续使用。依据 MDN getUserMedia 与 Permissions Policy：HTTPS 跨源 iframe 需要上层显式委派，用户拒绝仍然必须生效。

## 方案与验收

用户从 https://gemigo.io/ 卡片打开纸境 → 点击“开启摄像头” → 浏览器允许 → 应用进入摄像头识别；用户拒绝时继续按应用原有提示处理，可从既有新标签入口排查独立页面权限。探索列表预览共用首页组件；探索视频流进入应用后遵循同一授权规则。

在两个现有 iframe 添加 `allow="camera; microphone"`；默认委派范围是 iframe src origin，不使用通配符，不预先调用媒体接口，不绕过用户授权。保留 iframe 身份、sandbox、导航、加载反馈和新标签行为，不引入共享 wrapper/权限状态/错误代理。麦克风与摄像头同属 getUserMedia，覆盖同 owner 的同类缺口；其使用依然须浏览器授权。

验收：

- 真实 Chrome 完整首页预览、探索视频流，跨源测试应用获得合成摄像头及麦克风各1轨；保留修前同链路失败证据。
- 浏览器拒绝时 getUserMedia 返回 NotAllowedError；iframe 内部导航到另一个域名不能继承 src origin 的权限委派。
- frontend 类型检查、定向 ESLint、production build、diff Review。生产默认站点使用新产物；真实纸境入口点击摄像头后核验媒体流（合成设备，仅验证接口及应用链路，不代表用户物理硬件）。
- 精确提交、普通推送、主工作区 master 与实际远端 SHA 对齐，前端发布及线上验收完成。

design-document=required（权限边界合同）；plan=not-required（单批闭环）。项目无 planned-path preflight 或 diff-only maintainability 自动入口；路径沿既有 docs/designs 与 scripts 回归命名。

## 实现前方案 Review

mode=design：从截图目标核对真实预览路径，根因由实际浏览器复现锁定。src 范围委派保持用户授权与跨域导航边界；未扩展设备权限清单或修改应用错误文案。测试使用实际 getUserMedia，不以属性断言代替结果；生产使用真实纸境补充应用验证。无状态 owner 变化或新抽象。no findings，design-review=passed。

## 开发验证与实现 Review

修前同一测试首页/视频流 policy camera=false、microphone=false，getUserMedia=NotAllowedError；修后两入口 policy=true，真实媒体接口返回 video=1、audio=1（Chrome 合成设备）。拒绝授权=NotAllowedError；iframe 内导航到其它域名 camera/microphone policy=false。测试 `scripts/test-preview-media-permissions.mjs` 使用完整 UI 点击卡片/进入视频流，HTTP 应用与 API 为 fixture；没有注入产品 store 或伪造 getUserMedia。测试授权必须覆盖顶层及应用 origin，清除旧授权后才能模拟拒绝；这些是测试条件，不属于产品权限放宽。

frontend tsc、2组件及脚本定向 ESLint、production build、diff-check 通过；构建 index-VcCXKRxZ.js / index-B0quAaXB.css。既有 Browserslist 过期及大 bundle 警告仍在，无本次新增构建错误。

mode=implementation：no findings。项目无 diff-only maintainability 自动入口，人工审查本次 diff 与两个 iframe 的 src/sandbox/导航合同：产品仅新增2行 src 范围媒体委派，无通配符、权限状态、预执行调用或生命周期变化；不替用户自动授权。测试覆盖实际媒体结果与拒绝/导航边界。生产交付仍待完成；用户物理设备与操作系统授权不在 AI 合成设备证据内。
