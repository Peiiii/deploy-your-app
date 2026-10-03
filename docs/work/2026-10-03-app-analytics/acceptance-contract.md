# 内建应用 PV / UV 交付合同

- contract-id: app-analytics-2026-10-03
- parent-goal: 应用开发者在 GemiGo 内查看自己应用可靠采集的 PV、周期 UV 和趋势，知道历史覆盖边界。
- scope-revision: 1；来源与授权：[执行记录](../../logs/2026-10-03-app-analytics/README.md)。单阶段完整上线；实现选择为授权内 AI 决定。

| ID | Required | 当前合同 | Status | 证据 |
| --- | --- | --- | --- | --- |
| AA1 | true | 浏览器实际加载/刷新及 SPA 路由计 PV，重复上报幂等；HEAD、静态资源、无脚本扫描、预取、自动化请求不计 | passed | 本地真实链路与定向证据见执行记录；AA6单独追踪线上 |
| AA2 | true | 同应用同匿名浏览器跨日去重的 7/30 天 UV，隔离应用；匿名信息不存 IP、完整 UA 或访问 URL | passed | 本地真实链路与定向证据见执行记录；AA6单独追踪线上 |
| AA3 | true | 所有者从应用设置观测数据选周期/刷新，看到 PV/UV/每日趋势；加载/失败不会冒充0 | passed | 本地真实链路与定向证据见执行记录；AA6单独追踪线上 |
| AA4 | true | 未采集历史标注缺口，已启用无访问显示0；不捏造历史/相加日UV为周期UV | passed | 本地真实链路与定向证据见执行记录；AA6单独追踪线上 |
| AA5 | true | stats 仅所有者可读，公开上报不泄漏内部 secret，非法来源或载荷不能写入 | passed | 本地真实链路与定向证据见执行记录；AA6单独追踪线上 |
| AA6 | true | 适用检查、diff review、精确提交/普通推送、主区master同步0 0及实际远端SHA、API/gateway/前端上线与真实链路验收 | not-run | |

架构不变量：复用 analytics repository/service/controller、现有 manager/store、现有观测页；浏览器 beacon 取代 server GET 计数；历史留存不当新协议的连续数据。匿名浏览器标识仅本应用 origin；清缓存/换设备算新访客，UV 不等于实名人数。CSP/广告拦截/禁JS/离线阻断上报会低估，界面披露。
合同 review：以上覆盖实际采集→持久化→开发者观测→线上可用；未列无关转化漏斗、Cloudflare后台整合等泛化要求。所有 Required 保持未完成直至当前证据通过。
