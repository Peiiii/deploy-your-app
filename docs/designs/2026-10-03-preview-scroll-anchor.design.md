# 应用预览切换时保留浏览位置

用户在首页滚动后点击应用，宽屏打开右侧预览，左侧仍应看得见刚才的应用并能继续浏览。任务为 bugfix，实现风险 L2、上线 L4；单批完成，不另建 plan。AGENTS.md 授权精确提交、普通推送 master。2026-10-03 用户纠正交付边界：“为什么没部署上线？咱们目前不是全托管的模式吗”。最终结果须在线上 gemigo.io 生效；此前 AI 自行将交付停在本地预览的判断撤回。

## 现状和复现

首页 HomeExploreSection 在预览打开后从三列改为两列，上方发布/搜索区同时收紧；MainContent 保留 scrollTop，无法保留应用在屏幕上的位置。真实 localhost:5174 首页使用生产 API 的36项，1440×900，点击第16张「隔空投送」：卡片顶部由219.875移到410.875，漂移191px，scrollTop保持1847.5。预览焦点已有 preventScroll，路由才会主动滚到顶部。

## 使用链路与方案

1. 用户滚动首页，点击缩略图或标题，右侧加载应用；左侧按被点击卡片的原屏幕纵坐标校正滚动，标记正在预览的卡片。用户可继续滚动、打开另一应用。
2. 用户继续浏览左侧后关闭预览，按此刻可见卡片保留位置，不能跳回首次点击点。进入/退出全屏采用同一布局锚点；保留现有路由行为。
3. 手机仍在新标签打开应用，不添加双栏或滚动校正。卡片被筛选移除时不追踪旧节点；滚动范围不足时遵守原生边界。

仅保存 scrollTop 会继续漂移；关闭后回到初始 scrollTop 会丢失预览期间的新浏览位置。选择保留卡片身份和屏幕纵坐标，必要时受原生滚动边界限制。无需持久化浏览历史或引入列表虚拟化。

既有 UI store 仍是右侧预览的状态 owner，附带可选应用 ID 供卡片选中展示。MainContent 的局部 DOM hook 在 store 布局改变前同步取锚点，在 React layout effect 中校正同一滚动容器；新开预览优先对应可见应用，收起/全屏优先当前首个可见应用。两处真实列表共用卡片和同一滚动壳，无额外业务状态副本。关闭清除应用 ID，订阅卸载清理，普通 store 更新不校正滚动。

## 验收与方案 Review

同一真实入口、视口和卡片复验：非边界位置开/关漂移不超过2px；滚动后关闭保留当前可见卡片；替换应用更新选中状态；全屏往返、缩略图/标题打开、手机无横向溢出保持可用。定向 frontend tsc、触达文件 ESLint、production build、diff检查和实现 Review。

方案 Review（实现前）：原目标覆盖；scrollTop对照已证明不可行；使用同一UI owner和滚动容器，不复制请求/筛选状态；边界夹限与移除节点分支明确。设计通过，无开放 finding。目录遵循既有 kebab-case hooks / docs/designs；不存在 planned-path preflight 或 diff-only maintainability 脚本，使用定向静态检查及 findings-first diff Review。

## 最新主线整合

实现期间 fetch 确认 origin/master 更新至 f65befa，恢复了原 UI 和 floating dock；本任务精确保存自己的 patch、撤出已追踪文件草稿后 fast-forward，保留其它工作区 WIP。重新按最新实现应用本方案，不恢复被撤销的界面改版。

补充设计 Review：最新打开预览包含 openRightPanel 和自动折叠 sidebar 两次同步 store 更新，同一 React batch 只保留第一个 DOM snapshot，防止第二次覆盖点击卡片锚点。MainContent 原来的 margin transition 和 Home 的布局 transition 会在多帧连续改变几何位置，删除这两处布局过渡以确保在绘制前一次稳定校正；保留卡片、dock和原样式。全屏退出只选当前可见卡片，不误用首次点击卡片。最新版本卡片根为点击入口，选中使用 aria-current 与品牌色 ring；不引入额外键盘或路由行为变更。补充方案无开放 finding，通过。

相邻 Explore 真实鼠标点击发现 PageLayout 的 header 高度、标题字号、内容 padding 也在300ms持续过渡，导致首次校正后还有9px漂移。同一根因的相邻消费者纳入修复：移除这些布局过渡，保留原紧凑状态、尺寸和样式。补充方案 Review 通过，需重验首页与 Explore 实际点击及最终静态检查。

真实鼠标在卡片上停留会触发原有4px hover lift；重排后鼠标可能离开卡片。锚点只测卡片的布局坐标，扣除自身 CSS transform 的垂直位移，避免把临时 hover 偏移当成永久滚动偏移。保留原有 hover 动效。补充方案 Review 通过。

## 验证、Review 与交付记录

- 最终 frontend tsc、8个触达文件定向 ESLint、production build 和 git diff --check passed。构建有已有的 Browserslist 数据陈旧和大 bundle 警告，不影响构建；未扩展为性能改版。
- 最新主线真实首页（生产 API、1440×900）实际鼠标点击「隔空投送」布局漂移0px；进入/退出全屏连续6帧各0px；左侧继续滚动650px后关闭连续6帧各0.125px，选中状态清除。标题/缩略图打开、切换应用只保留一个选中卡片通过。按布局坐标量测，原有4px装饰性 hover lift 保留。
- 最终生产构建运行于 http://localhost:5175/，使用既有 Vite preview 代理生产 API；首页标题打开连续6帧漂移0px，应用 iframe实际显示。http://localhost:5175/explore 实际鼠标点击「申安云」漂移0px，选中与右侧 iframe名称一致。开发实例的 API请求曾悬挂，最终交付改用已验生产构建实例，不以旧开发页面代替验证。
- 390×844：document/main宽度与scrollWidth均390，无水平溢出；点击应用未开双栏、无选中，实际新标签已出现。手机仍沿原有 window.open。
- diff-only实现 Review：核对 store 元数据清理/替换、同批sidebar更新、开关/全屏锚点、节点移除guard、DOM订阅卸载、hover transform和共享PageLayout尺寸变化；无开放 findings。没有新增持久化或业务请求路径。边界位置受原生scrollTop夹限，不能保证所有卡片在列表首尾也保持任意屏幕坐标。
- 第一轮仅交付本地生产构建预览，精确提交5a34c8b并普通推送master，两端同步。用户指出未上线，第一轮交付并未完整满足其目标，继续完成发布和线上验证。
- 第一轮复盘no-increment只覆盖实现取证；漏掉上线的完成判断撤回。当前retrospective_state=pending，线上交付后重新判断。体验是否符合用户偏好仍待反馈，不冒称用户验收通过。

## 上线有效验收合同

contract-id=preview-scroll-anchor-release；parent-goal=正常访问gemigo.io时应用预览开关及全屏往返保留左侧浏览位置；scope-revision=1（用户澄清，恢复完整交付范围）。源码验证与实现Review复用上一轮有效证据；部署采用既有pnpm deploy:pages，保留原gh-pages发布资产作为回退依据。只发布frontend，不部署无关后台或修改Secrets。契约Review：所有条目通过可覆盖原问题和生产交付，无待决选择。

| ID | Required | 合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| PSA01 | true | gemigo.io消费包含本次修复的前端生产资产 | passed | 默认首页与实际浏览器均加载index-BynEWPeW.js，线上/本地产物SHA256一致 |
| PSA02 | true | 真实线上中部卡片打开、滚动后关闭、全屏往返布局漂移不超过2px；选中随应用切换/关闭更新 | passed | 1440×900实际点击隔空投送=0px，全屏往返6帧=0px，滚动650px后关闭6帧=0.125px，替换应用更新选中 |
| PSA03 | true | 390px手机维持原行为，无横向溢出 | passed | 默认线上首页document/main宽度与scrollWidth均390，实际点击无双栏、无选中，原window.open链路未改变 |
| PSA04 | true | 本任务及上线记录已入主线，本地master与远端实际master同步，保护无关WIP | passed | 本记录随提交交付；交付检查执行fetch、rev-list及ls-remote，保留analytics脚本及原未跟踪文件 |

### 发布与最终复盘

2026-10-03按仓库pnpm deploy:pages发布成功。源码dcaccca（包含修复5a34c8b）、gh-pages d920b76a952316a05e3562dc9599a4817b03761d、Cloudflare Production 870a3e5e-166b-41d6-9d3a-2e41a65ef27f。上一版gh-pages 10b9c0601386fd482877ddf0350d31f667963a8f、Production 78218fe0-5a83-4b5c-a371-05409610e58f保留为回退依据。只发布前端，无Secrets或后台修改。

发布后默认https://gemigo.io/已经返回本次JS/CSS路径，浏览器默认地址同样消费index-BynEWPeW.js，线上资产SHA256=b0f7eb8cd8f7c08fbefbfa4824875a4fdc92803f1dc6e88567157d61bcad97a4，与本地构建完全一致。早期域名曾读到上一版缓存，切换后已在默认地址复核；没有把带查询参数的新页面作为唯一上线证据。

线上真实鼠标与连续帧测量覆盖开预览、全屏往返、切换应用、滚动后关闭；关闭选中数归零，iframe名称随应用替换。390px手机默认首页实际点击后无双栏、无选中和水平溢出。单独手机新标签的出现未由即时工具列表确认；保留原有window.open，第一轮本地已验证该链路，没有冒称本轮观测新标签成功。

retrospective_decision=no-increment：这次是已有全托管授权和完整交付要求被错误缩减，已修正当前交付并更新原任务owner记录；现有流程明确禁止自行缩减用户结果，无需新增平行流程或通用规则。全部Required验证有效，交付入口为https://gemigo.io/；体验偏好待用户反馈，不声称用户验收通过。retrospective_state=completed。
