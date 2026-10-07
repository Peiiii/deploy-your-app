# 交付合同

contract-id=GEMIGO-STATIC-20261007；scope-revision=1；scope-confirmation=user-confirmed；parent-goal=GemiGo移除VPS源码构建依赖、保留其余输入输出与体验，Docker-fupf成为闲鱼专用机。

来源：2026-10-07用户“那你来落地”及随后最小变动约束。授权含本项目开发/普通推送/主区同步/线上验收及本次指定机器迁移；不包含释放实例、购买或续费。

| ID | Required | 标准 | Status | 证据 |
|---|---|---|---|---|
| SP-01 | true | 原HTML入口/API发布及更新成功，同地址、元数据/资源保留，不调用VPS | passed | 真实公网HTML与更新、同URL；原API/元数据测试；停builder复验通过 |
| SP-02 | true | 原ZIP入口/API/CLI可发布静态产物、目录包装/已有dist；75MiB输入/500MiB展开/10,000文件上限无无故缩减 | passed | 原CLI二进制ZIP/SSE公网通过；workerd包装/现成dist/Base64、74MiB输入/160MiB展开SHA及500MiB/10000上限通过 |
| SP-03 | true | 原GitHub静态仓库与分支原样输入可发布，源码无产物只限制云构建、提示明确 | passed | 真实公开mdn静态仓库默认HEAD通过；指定含斜线分支workerd验证；无产物源码明确失败 |
| SP-04 | true | 同项目排队、去重、关页/对象重启恢复、SSE/reconcile/结果查询、删除保持可用 | passed | 同对象串行排队/去重/取消删除；真实workerd重启游标+alarm自动恢复；公网SSE/reconcile/result |
| SP-05 | true | 失败不破坏原站、指针不确定/已激活重试正确，归档路径/CRC/秘密文件校验有效 | passed | 真实更新失败仍旧站Live；CRC/路径/ETag拒绝；指针丢响应和D1收尾故障恢复通过 |
| SP-06 | true | 账号/项目/SDK云存储/AI/统计/缩略图/已有网站保持；修改范围Review无finding | passed | 账号/配额/CLI/鉴权/云存储/AppGateway17项/缩略图/元数据检查；3既有公网网站SHA一致；Review无finding |
| SP-07 | true | 生产停止builder后上述真实链路通过，自动部署不重启旧builder，源码推送且主master与实际origin一致 | passed | 生产builder exited/restart=no，health521；停机期间三入口与失败保留复验；CI取消SSH/脚本退役门；5a106e8推送与主区0 0 |
| SP-08 | true | Docker-fupf专用闲鱼；迁移单活，旧链接/权益/产物保留，目标真实AI/预览/下载/重启恢复通过 | passed | 47.236.251.192源/目标32文件SHA、23任务/35文件一致；新机Linux23项；真实AI生成86.379秒及独立会话修改74.227秒；公网实际下载674485字节/SHA一致；实际Node SIGKILL后RestartCount1/healthy，原ZIP与权益保持 |
| SP-09 | true | 原NextClaw服务与Mac停用保持，SOP/运行事实/跟进更新，不输出私有数据、不伪造实付 | passed | 原机本项目app/tunnel停，NextClaw/CLIProxy/nginx仍运行；Mac两作业停；相关SOP及heartbeat更新xianyu-vps；Agiso当前identity/准确日期本商品零单成功，不伪造实付 |

合同Review：全部通过仍不能遗漏静态GitHub、旧CLI、删除或双连接器；已纳入。性能沿原75MiB/500MiB/10,000限制，验证代表普通小包和大单文件包；等待不得超过现有客户端10分钟窗口，分批后台恢复不依赖浏览器。去掉通用视觉改版、购买/释放、无关功能与新产品定位，不制造新审批门。

open-required=none。真实AD-10付款/退款/到账沿原合同待真实买家，不属于本次制造验收数据的授权；旧Agiso登录阻塞已通过已有Chrome会话恢复。
