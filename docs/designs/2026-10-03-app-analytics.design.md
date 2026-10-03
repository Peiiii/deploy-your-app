# GemiGo 内建应用 PV / UV

## 使用链路
开发者登录 GemiGo → 仪表板选自己的应用 → 应用设置「观测数据」→ 默认近7天看到实际覆盖时间与 PV/UV、每日趋势 → 切近30天 → 相同访客跨天仅计一次 UV → 访问/刷新应用后点击刷新可看到新浏览量。加载态是占位，错误显示重试；成功空记录只在启用覆盖内显示0，历史日期显示未采集。无需开发者接入 SDK 或重新发布作品，网关向已有作品的 HTML 投递轻量脚本。手机同一路径。

## 现状与方案选择
事实及原用户输入见[执行记录](../logs/2026-10-03-app-analytics/README.md)，验收见[AA合同](../work/2026-10-03-app-analytics/acceptance-contract.md)。旧内建链路由于扫描流量事故被禁用。直接恢复服务器 GET 会继续将扫描/HEAD/SPA片段请求错计、遗漏客户端路由，旧日期IP指纹无法周期UV。选浏览器确认后的同源 beacon，复用内建持久化与展示。Cloudflare Web Analytics 的 Visits 无法作为UV，不作为产品owner。

## 口径与数据
- PV：每次可见文档访问/刷新、BFCache返回、不同 pathname/hash 的客户端导航；同一路径仅查询串变化、重复 replaceState 不新增。预渲染/隐藏文档在可见后首次计数，静态脚本/样式/HEAD/扫描 GET 不产生事件。已知机器人、webdriver 不计（启发式过滤，不宣称反作弊）。
- UV：本应用 origin 的随机匿名 localStorage UUID，由 gateway 用 slug+UUID+secret HMAC 后落库；不采IP/完整UA/完整URL，不发送路径/查询值。标识不按天改变；近7/30 UTC自然日含今天，COUNT DISTINCT hash。禁存储仍计PV但缺身份请求数明确披露，UV为已识别浏览器数；清缓存/不同设备是新访客。hash记录保留35天，历史每日汇总保留。
- event UUID 经 slug 作用域哈希成为幂等键；API使用服务端接收时间。新增事件表在现有 repository 内，单次 INSERT OR IGNORE + SQLite trigger 原子更新原 daily/hourly/dimensions/uniques 投影；避免旧先预留后写入失败导致丢数和跨应用去重冲突。重试复用同一eventID，最多一次。
- API只接收新 browser 协议且 secret鉴权；gateway在固定同源POST端点验证 Origin、Sec-Fetch-Site、JSON、小载荷、UUID，slug取host，客户端不能指定其它应用。不承诺阻止伪造浏览器的恶意客户端。内部secret不入HTML/脚本。
- 独立 collection 起始记录由发布步骤在 gateway 上线后设置，不能从首访推断（否则空应用永远未知）。从覆盖开始的当天为partial，之前为missing；所选周期汇总标记partial而非完整近7/30；未启用返回unavailable/null。不混入旧口径或回填历史。清理有索引并复用API定时/既有cleanup。

## 入口和状态
现有ProjectStats类型改为range/from/to/pageViews/uniqueVisitors/unidentifiedViews/coverage/points，不再展示伪总数；每日点含PV、日UV和coverage。Stats controller验证会话与owner，响应private,no-store。前端manager拥有range与加载、请求序号防旧响应覆盖，store保存选择；切周期/刷新走同一manager。加载移到观测页挂载，删除设置页原无条件7d加载以避免覆盖当前周期。中英文在已有i18n owner添加。

## 投递与边界
同源版本化外链脚本使用绝对origin，适配base标签；HTMLRewriter只改delivery不改R2对象。body注入保持作者CSP（脚本可被CSP阻止），不弱化安全策略；ETag加入collector版本避免旧304永久保留无采集脚本。静态脚本可缓存，文档cached/304仍执行collector。禁JS、广告拦截、离线、旧service worker HTML或CSP阻断会低估，界面说明。应用所有者本人和真实预览iframe访问也计数；缩略图自动化不计。

## 验证与门
AA1/2：真实Miniflare R2→gateway→API→D1和Chromium导航/刷新/304/SPA/hash/iframe/两origin、隐藏预取、bot/HEAD/assets、重试并发/跨日去重/禁存储。AA3/4：真实React页面近7/30、加载/错误、缺历史及覆盖内零、请求竞态、手机；生产所有者既有设置入口实际使用。AA5：匿名/其它owner/session过期、直接ping/伪Origin/超大载荷。AA6：TS/ESLint/build/定向回归、dry-run、实际production静态产物与D1上报证据、Git同步。

## 方案 Review（实现前）
mode=design：从原始要求独立反查内建链路与入口，补充隐私/存储不可用、跨应用幂等、半天覆盖、旧响应覆盖、CSP和缓存；上述方案满足AA1–6，不让测试通过但开发者只能看后台接口。新名字仅为现有gateway collector及repository事件记录，没有新provider/service/state owner。投影由trigger更新而非双写业务路径，collection开始不与首访混淆。项目无planned-path或maintainability脚本；新增文件沿gateway/scripts/docs既有目录。design-review=passed，no open findings。plan=not-required，同一批实现+验证闭环，以active合同和日志恢复；retrospective pending。

## 实现调查补充
Typecheck 暴露同一stats消费者还包括仪表板卡片/汇总与设置侧栏。它们一并迁移当前协议：侧栏用当前周期PV/UV并披露partial；仪表板只汇总7d当前成功数据，加载/缺数据是—，文案「近7天已采集PV」，避免缺历史伪零/误称总量。不是额外入口，属于AA3/4现有投影合同。方案受影响部分复审通过：不加views7d平行字段或旧伪总数兼容。无新的open finding。

隐私原文核查发现原隐私政策仍描述「每日轮换哈希」，与新浏览器口径不符。AA2 范围内同步既有privacy-policy页面为真实按应用随机标识、35天定期清理、所有者仅汇总权限，并尊重Do Not Track。趋势按最新日期优先，避免30天历史缺口掩盖已采集当天。方案变更复审通过，无新增入口、Secrets或反作弊承诺。

管理员复用补充（2026-10-04）：浏览器只读查询、周期去重及coverage投影收敛到product-analytics公共queryAppTraffic；API service保留owner校验/调用与repository采集schema，管理员详情复用同一报告。ProjectStats协议和浏览器采集不变，管理员不会从每日UV相加生成周期UV。
