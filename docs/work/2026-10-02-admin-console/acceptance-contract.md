# 后台管理交付合同

- contract-id: admin-console-2026-10-02
- parent-goal: 独立后台管理网站，能查看大盘、进行业务管理，以初始账号登录并修改密码。
- scope-revision: 3；来源与授权见 ../../designs/2026-10-02-admin-console.design.md 与项目 AGENTS.md。
- flow: standard；delivery-mode: major；单阶段；retrospective_state: pending。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| ADM-01 | true | 独立登录、初始凭据可用、主站会话无管理权限 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-02 | true | 真实业务经营大盘，明确范围，刷新/空/错误完整 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-03 | true | 用户搜索分页与撤销会话；应用搜索分页与公开展示管理；部署记录诊断 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-04 | true | 网页改密码持久生效，旧密码/会话失效，校验与并发完整 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-05 | true | 写入同源认证、敏感字段隔离、操作记录及旧分析能力保持 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-06 | true | 桌面/手机真实页面可用且信息层次清楚 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-09 | true | 独立增长大盘：真人PV/观测UV每日曲线、日表、7/30日等周期比较、注册激活部署及获客来源，口径/缺失/错误明确 | pending | 补充设计已通过 Review，待实现与生产验证 |
| ADM-08 | true | 反馈列表搜索分类状态分页、完整讨论、团队回复及状态管理/删除，主站作者同步且私密权限保持 | pending | 补充设计已通过 Review，待实现与验证 |
| ADM-07 | true | 任务文件精确提交推送，迁移部署及线上验收，交付入口与凭据位置 | pending | 生产版本 9b259616；线上完整操作、测试资源清理、私有初始凭据、普通提交推送，见交付日志 |

阶段门：设计已冻结且 Review passed → 实现 → 验证及实现 Review → 授权部署与线上验收 → 复盘与整体完成判断。当前无用户待决提案；不将完整运营后台缩为只有只读事件分析。噪声标准删除：多管理员角色、计费、生产封禁与删除并无当前用户要求或必要使用场景，不创建通用扩展体系。

当前阶段：Design Ready，反馈补充设计 Review passed，进入 Implementation；open-required: ADM-09、ADM-08、ADM-07。用户后要求直接交付可修改的固定临时凭据，已设置并网页验证登录→账号安全；不再自动轮换。此前用户要求旧账号恢复：已从本机私有备份恢复 admin 的旧密码，生产登录及 session 验证通过；私有凭据文件同步。其余已通过证据复用，影响部分待重验。

证据：[交付记录](../../logs/2026-10-02-admin-console/README.md)。未移出或降低 Required；用户未回复不算用户验收通过。
