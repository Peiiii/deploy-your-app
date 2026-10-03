# 后台管理交付合同

- contract-id: admin-console-2026-10-02
- parent-goal: 独立后台管理网站、大盘与实际业务管理、初始管理员账号及网页改密；追加私密反馈管理、日度增长运营大盘、CLI渠道使用与整合应用存量统计。
- scope-revision: 11；原始要求、修订与授权见 [设计](../../designs/2026-10-02-admin-console.design.md)、[交付记录](../../logs/2026-10-02-admin-console/README.md) 与项目 AGENTS.md。
- flow: standard；delivery-mode: major；retrospective_state: completed。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| ADM-01 | true | 独立登录、初始凭据可登录且交付、主站会话无管理权限；用户改密后以新密码为准 | passed | Worker+D1 隔离测试、生产初始登录与安全页、用户网页改密版本6；当前密码保持，见记录 |
| ADM-02 | true | 真实业务经营大盘，明确范围，刷新/空/错误完整 | passed | 实际 D1、原生产完整链路、最新生产总览7/30日及手机宽度复验 |
| ADM-03 | true | 用户搜索分页/撤销会话、应用搜索分页/公开性管理、部署诊断 | passed | `scripts/test-admin-console.ts`、专用生产业务资源完整操作及清理，原分析回归 |
| ADM-04 | true | 改密持久生效、旧密码/会话失效、校验与并发完整 | passed | CAS/晚到登录 D1 测试、生产网页改密/重新登录、用户自己改密后临时密码401 |
| ADM-05 | true | 同源认证、敏感字段隔离、审计与原分析保持 | passed | 定向集成/静态/真实页面、反馈与增长认证边界，来源IP匿名化，无个人数据增长接口 |
| ADM-06 | true | 桌面/手机信息清楚、真实完整交互可用 | passed | scope11真实本地/生产1440×1050 / 390×844 / 320×844，响应全期图表/紧凑浮层/原管理能力、无根溢出或JS错误；主观偏好待用户反馈 |
| ADM-07 | true | 精确提交推送、迁移部署/线上验收、入口/初始账号交付、master同步 | passed | 功能 `f936201`、修复 `2008ff6`，后台 `f59b057a`，生产全链路与本记录收尾的Git检查；最终同步以工具SHA证据为准 |
| ADM-08 | true | 反馈筛选/分页、完整讨论、状态/团队回复/删除，作者同步且私密 | passed | D1 106条讨论/并发去重；真实主站作者创建→后台处理→作者API读取，跨用户403/匿名401→确认删除/审计→专用数据清理 |
| ADM-09 | true | PV/观测UV曲线、7/30等周期日表、注册激活部署及来源，缺失/错误明确 | passed | `scripts/test-admin-growth.ts`、真实CF+业务7/30日、UV去重/留存、CSV、来源合并、手机日期及日表滚动、缓存刷新均通过 |
| ADM-10 | true | CLI统一含Skill，7/30使用量/占比/用户/成功率与日曲线，应用首次/最近渠道及部署渠道筛选 | passed | 实际Worker+D1跨日去重/边界/分页；生产7/30与canonical渠道一致、CSV11列、应用与部署CLI筛选、桌面/手机及QA清理通过；c87f4da / Worker 6270fc65 |
| ADM-11 | true | 应用管理整合类别/实际UI语言/公开性存量统计与列表筛选，缺失明确、不无限扩展模块 | passed | Worker+D1真实库存/缺失/多语去重/组合筛选/空态；生产752聚合对账、桌面手机完整6类/语言及筛选、QA清理通过；0cdc93f / Worker21987f53 |
| ADM-12 | true | 经营首页数字/图表优先，突出真实发布创作者与待关注应用/反馈，明确历史/时间口径，问题可直达处理入口 | passed | [整体方案](../../designs/2026-10-03-admin-operations.design.md)，Worker+D1/实际UI通过；生产7/30与canonical对账47/33/14和89/89/0；待关注23/反馈空态0；19cce8f / Worker a2fd065d |
| ADM-13 | true | 应用详情完整追溯、作者反馈精确定位、返回保留上下文、导航整合且旧能力保持，生产生效 | passed | 同方案三条黄金链路；Worker/UI、生产桌面/手机/作者筛选/导航/后退刷新与empty/401/404；账号version6与QA清理401 |
| ADM-14 | true | 首页完整7/30日周期比较、新注册同批激活摘要、每日成功发布人数和应用真人访问趋势、首次/再次及CLI贡献，零/缺失/失败恢复明确；今日独立，队列与原能力保持，生产生效 | passed | scope8 Worker+D1/真实Chrome及生产canonical对账，7/30/CF/异常恢复/零样本/手机/原增长CSV与详情；ce85852 / Worker ceea3dd5 |
| ADM-15 | true | 首页/增长大盘/部署诊断/使用趋势统一日期命中、日期数值单位与多指标提示、零/缺失明确；hover可停留、Escape、键盘与触摸/滚动完整，交互遵循金融图表参考，紧凑提示自然跟随并避开当前点/日期标签，无常驻占位栏且绘图区不跳动，生产生效 | passed | scope11本地/生产原生ECharts全部曲线与双柱、1440/390/320、crosshair与紧凑提示避当前点/日期轴/边界且无位移、数值/单位/null/0/键盘/切换/触屏与纵滚；96338b7 / Worker5ad843aa |

当前阶段：scope11 Validation/Review/生产Delivery与复盘完成；open-required: 无。功能96338b7已进入远程master与主工作区，本次受影响后台Worker5ad843aa，实际生产入口已验收；最终记录提交后仍须fresh fetch、核对远程实际SHA和本地master差异0 0。其余未变化证据复用，不以写文档替代实际同步。

入口：https://admin.gemigo.io。初始账号 admin 和临时密码已在聊天中直接交付，并实际网页登录验证；用户随后通过账号安全自行改密，旧临时密码失效。当前密码保留，不再自动重置；本机初始凭据文件不会因网页改密自动更新。

黄金链路：登录→经营总览及业务管理；反馈管理→查找/阅读→状态/团队回复→作者看到同一结果；增长大盘→7/30完整UTC日→PV/UV曲线与获客/激活→每日CSV；账号安全→改密退出→新密码登录。CLI使用→7/30占比/用户/成功率及趋势→应用首次/最近渠道→部署CLI筛选。应用管理→全局库存分类/语言/公开设置→列表组合筛选→清空恢复。经营优化→发布创作者/首次/再次→当前问题和反馈→详情追溯/原处理→返回保留筛选，折叠诊断保留旧能力；生产pending0非空处理由本轮本地完整链路及原生产私密处理证据覆盖。没有缩减或移出 Required。采样、观测UV覆盖/留存、查询预算与用户主观体验边界已披露；未回复不视为用户主观验收通过。

retrospective_decision：原事实 owner `docs/tech/PRODUCT_ANALYTICS.md` 已更新账号、反馈、增长数据源/缓存与预算合同；最小增量保留在既有文档与测试，无新的全局规则或框架资产。用户凭据纠偏按最终明确请求执行；保护当前改密结果。整体是否完成由 lifecycle 在 Git 与清理证据核对后判定。

scope7补充当前证据（ADM-06/12/13）：`576ea8b` / Worker `6bcb6b20`，生产数字7卡→图表→待办排序、侧栏统一SVG/选中/键盘/折叠、7/30、日常入口及异常详情，桌面/手机实际渲染通过；本地13项导航验证。当前密码保留，专用QA清理session401，scope6非布局证据复用，原设计已同步用户明确优先级。


scope8证据：真实Worker+D1新增每日/期间发布人数与前期队列边界、CLI成功创作者，原管理/反馈/认证/恢复回归、admin构建/Worker类型/lint；真实本地Chrome429初载与刷新失败重试、零样本、流量缺失、快速切换晚到响应、队列翻页无增长重查；生产桌面/手机7/30与独立D1聚合一致、CF正常、3类流量切换、原增长/CSV/详情及无JS错误。实际截图已查看，数卡→曲线→激活/CLI→存量→待办。保留当前密码版本与原会话；两次专用QA会话均删除后401，归还仅本次成功非缓存报表预留62682+64422，保留共享预留223652及其它用量；无Required缩减。

scope8 retrospective_decision：事实owner PRODUCT_ANALYTICS 已替换旧首页包含今日核心指标描述，完整周期与今日/诊断分开，复用唯一growth合同/Chart；前期队列与CLI成功去重有真实边界测试。方案owner已标明scope8替代scope7指标布局，保留侧栏与原处理路径。校验脚本CLI --file仅返回导入摘要的发现留在现有交付日志，未新增全局规则/框架。主观体验待用户反馈，不冒充用户验收通过；Lifecycle在最终Git工具证据与资源清理核对后判定完成。

scope9当前阶段：Validation/Review/生产Delivery与复盘完成；open-required: 无。ADM06/14布局与范围切换已复验，ADM15共享交互及生产已通过；其余已验证能力继续有效，scope8数据口径保持。实际部署4e6e63d / Worker8e225b64；收尾记录提交后仍须fresh fetch核对远程实际SHA与master差异0 0。


scope9 retrospective_decision：已修复SVG小点title命中与重复柱渲染，最近日期交互、tooltip边界/键盘/触摸由TimeSeriesChart唯一owner承担；原PRODUCT_ANALYTICS事实及专题方案更新。真实浏览器验收脚本保存异步response读取等待与范围完成条件，避免把工具竞态当产品缺陷。QA确切session删除后401、账号版本6保持、临时凭据与预算JSON清理、隔离服务停止；只归还已确证非缓存报表预留536120，保留共享并发用量。没有全局框架/规则增量，用户主观偏好仍待反馈。


scope10当前阶段：Validation/Review/生产Delivery与复盘完成；open-required: 无。ADM06/15按用户截图返工后已本地/线上复验passed；scope9数值及原能力证据保持，无Required缩减。最终记录提交后继续fresh fetch核对远程实际SHA和master差异0 0。


scope10 retrospective_decision：原PRODUCT_ANALYTICS与专题方案已替换浮层位置描述，明确固定文档流数值栏/闲置保留行/不遮挡和不位移；原真实浏览器脚本新增相应几何断言与320px双指标。实际截图与原用户输入对照通过，不为此次视觉偏好增添全局规则/框架；QA清理401、账号version6保持、成功生成预留155248精确归还，其余共享用量保留，私有JSON删除/隔离服务停止。


scope11当前阶段：Design Review/Implementation/本地Validation与实现Review通过，正在Delivery；open-required ADM06/15，scope10位置与体验方案按用户最新反馈失效，数据与认证等未变证据保持；完整的原hover/keyboard/touch/零/缺失能力不缩减。


scope11本地证据：真实Chrome全脚本PASS，ECharts native crosshair/紧凑浮层/换侧与当前点日期轴避让、7/30完整响应时间窗、原键盘与null/0/多指标、390/320点选/滑动/页面纵滚及画布稳定，正式截图已核对；admin tsc/build/lint/diff Review通过，生产待验，ADM06/15保持stale。


scope11最终状态：ADM06/15 current passed，Required无缩减、无开放项。完整金融参考交互已在正式入口上线和实际浏览器验证，三资源hash匹配；QA确切会话删除→401、version6保持、3份成功报表预留156208精确归还、私有文件清理/隔离服务停止。retrospective_decision：原PRODUCT_ANALYTICS、方案与真实验证脚本已更新，永久栏/自绘owner退场，金融参考和native输入经验集中原owner，无全局规则增量；retrospective_state=completed。用户可用现有账号登录admin.gemigo.io，经营首页/增长鼠标横移查看十字准线与同日读数、边缘换侧/移开或Esc关闭，手机点选和页面纵滑及键盘左右/Home/End同样可用。AI验收已通过，主观体验待用户确认；收尾记录提交后fresh Git核对为完成门最后证据。上述scope11早期stale/待生产记录保留为历史，不是当前状态。
