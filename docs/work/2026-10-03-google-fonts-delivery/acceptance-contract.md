# Google Fonts 交付合同

contract-id: google-fonts-delivery-20261003
parent-goal: 平台通用消除Google字体对大陆访客首屏的慢/不可达依赖，继续调查并如实报告应用接入网络及其他外部资源边界。
scope-revision: 1；用户原话与直连证据见日志；全托管交付授权AGENTS.md；未将后续字体确认视为排除原访问目标。

| ID | Required | 判定 | Status | 当前证据 |
|---|---|---|---|---|
| GF-01 | true | 已有HTML link/内联import、平台CSS及nested import、gstatic字体统一交付，源对象不变 | not-run | |
| GF-02 | true | 超时/失败不拖住首屏，CSP/SRI、相对路径、query、HEAD/304隔离 | not-run | |
| GF-03 | true | 固定可达入口三冷FCP<5s、DCL<6s，无浏览器直连Google；冷/热各三次，成本边界真实 | not-run | |
| GF-04 | true | 限域、redirect/类型/大小/超时/Cookie保护，类型/lint/回归及Review通过 | not-run | |
| GF-05 | true | 精确提交推送/实际远端SHA/主区0 0/生产部署/入口验收/回退记录 | not-run | |
| GF-06 | true | 默认DNS应用连通性和图片依赖继续实测，开放缺口不冒称已解决；有可执行通用修复则继续 | not-run | |

retrospective_state: pending；当前设计与方案Review已通过。大陆三运营商数据未取得；本机实测不升级全局SLO。外部服务采购/网络备案依赖如确需，准备可评审结果再交回。
