# SEO / GEO 交付合同

- contract-id: seo-geo-2026-10-03
- parent-goal: 改善官网SEO与生成式搜索可理解性，并能观察搜索/AI访问到注册的效果。
- scope-revision: 1；用户确认指标重点，追加GEO；实施与生产交付沿AGENTS全托管授权。
- 当前阶段: completed；standard，retrospective_state=completed。
- 设计: ../../designs/2026-10-03-seo-geo.design.md；设计Review passed。

| ID | Required | 约定 | Status | 证据 |
| --- | --- | --- | --- | --- |
| SG-01 | true | 公开入口有真实原始HTML、有效metadata/互链/sitemap，未知与私有页不误索引，旧API/发布入口保持 | passed | ../../logs/2026-10-03-seo-geo/README.md |
| SG-02 | true | GEO产品事实与指南可直接阅读，与人类可见内容一致，不造评分或引用 | passed | ../../logs/2026-10-03-seo-geo/README.md |
| SG-03 | true | 搜索/AI匿名首次来源保存，真实新账号注册含邮箱/OAuth，无重登及加密码误计 | passed | ../../logs/2026-10-03-seo-geo/README.md |
| SG-04 | true | 后台可读搜索/AI访问和同队列有序注册转化、daily/入口/CSV、空错误态及覆盖边界 | passed | ../../logs/2026-10-03-seo-geo/README.md |
| SG-05 | true | 精确提交推送、主workspace与实际远程master同步、受影响目标部署及线上验收 | passed | ../../logs/2026-10-03-seo-geo/README.md |
| SG-06 | false | Search Console 展示、点击、CTR、排名：有可用账号则接入；无连接明确缺失 | unavailable (optional) | 已查账号页面，未取得验证站点/数据；指标明确缺失 |

不把30天滚动留存不完整日写零，不把Google AI来源单独伪造，不把AI引荐当引用。搜索收录/排名提升及AI引用效果需要积累，无承诺即时效果。用户数据与既有后台WIP保护。删除通用lint/安全清单噪声标准，保留实际坏结果可判定的合同。

AI验收结论：acceptance-ready；SG-01—05生产交付通过，SG-06可选外部数据明确未连接。已交付待用户体验验收，不报告用户已确认。复盘更新原分析事实owner，未扩大通用规则。
