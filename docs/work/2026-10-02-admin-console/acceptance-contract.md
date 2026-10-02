# 后台管理交付合同

- contract-id: admin-console-2026-10-02
- parent-goal: 独立后台管理网站，能查看大盘、进行业务管理，以初始账号登录并修改密码。
- scope-revision: 1；来源与授权见 ../../designs/2026-10-02-admin-console.design.md 与项目 AGENTS.md。
- flow: standard；delivery-mode: major；单阶段；retrospective_state: pending。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| ADM-01 | true | 独立登录、初始凭据可用、主站会话无管理权限 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-02 | true | 真实业务经营大盘，明确范围，刷新/空/错误完整 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-03 | true | 用户搜索分页与撤销会话；应用搜索分页与公开展示管理；部署记录诊断 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-04 | true | 网页改密码持久生效，旧密码/会话失效，校验与并发完整 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-05 | true | 写入同源认证、敏感字段隔离、操作记录及旧分析能力保持 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-06 | true | 桌面/手机真实页面可用且信息层次清楚 | passed | `scripts/test-admin-console.ts`、恢复脚本测试、隔离真实 D1 与浏览器完整操作；线上结果待 ADM-07 |
| ADM-07 | true | 任务文件精确提交推送，迁移部署及线上验收，交付入口与凭据位置 | not-run | 待验证 |

阶段门：设计已冻结且 Review passed → 实现 → 验证及实现 Review → 授权部署与线上验收 → 复盘与整体完成判断。当前无用户待决提案；不将完整运营后台缩为只有只读事件分析。噪声标准删除：多管理员角色、计费、生产封禁与删除并无当前用户要求或必要使用场景，不创建通用扩展体系。

当前阶段：Validation acceptance-ready（本地范围），实现 Review passed；进入授权生产部署与真实入口验收。open-required: ADM-07。生产旧初始凭据已无效；按用户要求及 AGENTS 全托管授权生成新的初始账号密码，存本机权限 0600 文件。
