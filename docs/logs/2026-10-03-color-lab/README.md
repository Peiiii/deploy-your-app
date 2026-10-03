# 光与颜色实验室：内容样板交付记录

日期：2026-10-03

当前结果：**技术交付完成，用户体验未通过；按用户要求停止该作品迭代。** 用户实际反馈为“好难用啊，好无聊，别搞了”，随后要求转向搜集网上现成内容、开源项目。此前 11/12 内部自评分已失去作为质量通过依据的效力；技术测试通过不能证明好用或有趣。后续研究见[现成内容研究](../../thoughts/2026-10-03-open-source-content-research.thought.md)。没有执行删除或下线。

原始输入：用户要求先交付一个结果看效果；上位顺序是优质内容、流量、收费。AI 在已选题计划中选择 C1，交付中文静态互动作品并通过现有平台发布，尚未向目标用户发送邀请。

设计：[内容设计](../../designs/2026-10-03-color-lab.design.md)。源码入口：`content/color-lab/`。本记录也是轻量 active acceptance ledger，contract-id `color-lab-2026-10-03`，parent-goal：用户能够在 GemiGo 打开一个完整的光与颜色互动样板，判断效果。

## 入口与身份

- 线上：[光与颜色实验室](https://color-lab.gemigo.app/)，免费、无需登录。
- 探索：[GemiGo](https://gemigo.io/explore?lang=zh-CN)，搜索“光与颜色实验室”，分类“学习与教育”。搜索结果可打开真实 iframe 预览。
- project ID：`979d4562-0979-4cbf-a4ba-63ca9a0e28d5`；deployment ID：`7f69a009-dab3-494f-8d36-a61123d746a5`；状态 `SUCCESS`；2026-10-03 11:11 UTC 完成；发布类型 R2。
- 自有账号 Wang Pei，作品介绍明确 GemiGo 原创，不冒充社区用户自发作品。分类 Education，标签 science/color/interactive/learning，中文 UI。展示名称有中英文翻译，英文介绍明确 Chinese interface，不代表应用双语。
- 通过现有作者 PATCH 接口设置实际作品语言；平台将 zh-CN 正规化为 `zh`，回读 `appLanguage={languages:["zh"],source:"author"}`。
- 当前线上源版本对应本任务源码。静态包只有 index.html、styles.css、app.js、model.js、icon.svg；manifest、tests 与封面不混入应用包。

## 验收账本

| ID    | Required | 必须成立                                                    | 状态   | 当前证据                                                                                                                                                                |
| ----- | -------- | ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CL-01 | true     | 自由混光准确反馈，含预设、重置和知识说明                    | passed | 已知原色/二次色/黑白边界测试通过；浏览器黄色预设 #FFFF00、全零 #000000、重置 #FFFFFF；解释随配方更新                                                                    |
| CL-02 | true     | 挑战具备调色、失败反馈、五关完成、重玩及切换闭环            | passed | 真实 UI 初始失败给红光调高提示；五关逐次提交完成，用 6 次提交展示成果；重玩回到第一关；模式切换保留各自状态                                                             |
| CL-03 | true     | 手机与桌面可操作，分享链接可还原配方                        | passed | 桌面 1280px、手机 390×844 操作及弹窗检查；手机 scrollWidth=innerWidth=390；线上独立新页面还原 100/100/0 为 #FFFF00；线上手机首关通过                                    |
| CL-04 | true     | GemiGo 线上匿名可用、探索可找到、归属与元数据准确、产物匹配 | passed | CLI SUCCESS；匿名页面无登录；探索中文语言筛选下按名称搜索得到作品并打开预览；线上失败/成功反馈及分享；4 资源原始 SHA-256 一致，HTML 去除平台既有运行时注入后逐字一致    |
| CL-05 | true     | 定向检查和 Review 通过，精确提交并同步远程与本地 master     | passed | 模型 3/3、JS node --check、定向 ESLint recommended、Prettier、CLI validate 通过；diff-only Review 无未关闭 findings；Git 精确提交、普通推送与两端 master 同步通过，见下 |

flow=standard；实现局部 L2，发布边界 L4；技术阶段=completed；用户体验结果=rejected，继续迭代=stopped。CL-01～CL-05 是当次技术和发布证据，不等于内容优质或用户认可。

## 技术与发布证据

- `pnpm build:cli` 的适用 TypeScript 构建通过。内容仅原生 JS/CSS，不修改平台 TS 运行链路。
- `node --test content/color-lab/tests/model.test.mjs`：3/3。保护已知科学边界、每通道容差不被高分绕过、合法/非法 URL 配方和新 URL 还原。
- `node --check` 覆盖 app.js/model.js；临时定向 ESLint 配置使用项目已有 @eslint/js recommended 与 browser globals，避免根配置未覆盖 JS 的忽略警告被当作通过。无新增配置或依赖。
- `pnpm exec prettier --check` 覆盖 HTML/CSS/JS/model tests/manifest；CLI validate 确认静态包 5 文件。
- 手工 diff-only 维护性及 implementation Review：核对原始“一个结果”范围、状态单 owner、五关完成/重玩、独立模式状态、原生键盘与弹窗、剪贴板失败 fallback、模型简化、来源、平台原有发布链路。项目没有适用的自动 maintainability 入口；无未关闭 findings，不另建检查器。
- 实际上线 HTTP：5 文件均 200。styles.css `bff1d073d3ca9b6356a53baa55523e5a04108632bac60cf7ce33b1fa589c243b`；app.js `c91fe586546ce2177ce8158fc161fe68b9aa728a57a2041bcfee926e10ad7938`；model.js `29acdcffcfe0b62cb075f55c7a3da879d32e9011f18f9e591db88d98b680a7df`；icon.svg `553222ed626536b5f9e1df03e75e0d901fe90b59edd9237e9315aba20f9e4017`。HTML 源 hash `d8326a135f308822f319a33b7f46a4f0688d9cdfb780f67c175b9b5fd86d8abb`；线上由平台重写 CSS URL 并追加既有 font/favicon/analytics 运行时，精确移除这些已核对注入后与源相同。
- 封面：探索页已有自动生成的真实首屏截图。另保存完整实验台截图 [cover.png](../../../content/color-lab/cover.png)，作者上传接口 200，`/__thumbnail.png` 回读二进制一致。当前中央缩略图优先已有 thumbnail.webp，因此仍显示真实首屏封面；不把 legacy PNG 上传成功说成中央封面已替换。该展示优化未修改平台基础设施。
- 截图：[桌面成品](screenshots/desktop.png)、[线上手机挑战](screenshots/mobile.png)、[探索搜索结果](screenshots/explore.png)，都来自同一线上产物。

## 内容自审与边界

当次硬门槛技术/内容自验通过，曾按六项内部标准暂评 11/12。用户随后明确否定易用性与趣味性，**撤回该评分作为质量通过依据**。可开始、可完成、有反馈等技术证据没有覆盖真实体验质量；本作品不能凭内部评分作为优质供给推广，也不再据此复制其余自制作品。

已有产品方实际体验反馈：难用、无聊，停止此方向；尚无独立目标使用者样本、流量、传播和付款验证。整体三作品原计划未完成，且原执行路径已停止。挑战进度只在当前页保存，刷新重来；分享保存配方，不保存通关凭证。屏幕 RGB 模型不模拟光谱、光功率或颜料，不采用专业感知色差。

最短验收：关掉蓝光看白色变黄 → 切到颜色挑战，调色并提交，看反馈/下一关 → 分享配方，新页面看到相同颜色。

## 更新与恢复

已有项目更新必须复用上面的 project ID：现有 UI“再次部署”上传 site 的 ZIP，或使用现有 CLI 的 GemigoApiClient.uploadDeploymentSource/startDeployment/streamDeployment 与 zipDirectory，沿同一项目发布。不要再次运行 CLI deploy，它会新建项目。恢复旧内容使用 Git 历史中的 site 再次部署，地址保持 color-lab；不删除或覆盖无关作者作品。

本轮经验：内部技术闭环和主观评分不能代替实际易用性、趣味性判断；内容选择先试玩成品再决定引入，见新的研究记录。本次反馈仅改变内容研究路径，不新增全局 AI 规则。技术任务已结束；原优质内容批次没有通过用户体验验收。

## Git 交付

实现交付提交 `181ee8f988048656db684423d3469453ece70212` 已普通推送。主工作区在 master；重新 fetch 后实际 `git ls-remote origin refs/heads/master` 与本地 master 均为该 SHA，`git rev-list --left-right --count master...origin/master` 为 `0 0`。本记录的验收状态补记另行精确提交，并在最终交接前再次核对两端。

原有 analyze.sh、interview-prep.md、education-game-initiative.md 和 gemigo-0.1.0.tgz 的 SHA-256 与任务前一致；其它会话并行交付的主线提交保留，新增验收截图和文件不纳入本任务。无本任务未提交草稿。
