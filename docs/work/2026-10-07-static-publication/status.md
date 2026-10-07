# 当前状态

flow=standard；risk=L4；phase=delivery；retrospective_state=pending；active-contract=GEMIGO-STATIC-20261007。

用户已授权落地，后续约束为只移除云端源码构建，其余入口/输入输出/体验保持。设计与方案 Review 通过；实现 Review 通过，无未关闭 finding。复核覆盖同项目串行/去重/删除、流式归档和 CRC/ETag、原指针保留、激活后收尾恢复、旧 API 可用性、共享 GenAI 改写及 CI/部署脚本关联依赖。

已通过 pnpm check、test:static-publication（真实 workerd/DO 重启/自动 alarm 恢复；74MiB 输入与160MiB展开 SHA；上限拒绝）、project-creation-limit、deployment-client/completion、metadata、CLI 7项、application-auth、app-api-gateway 17项、app-storage、thumbnail-performance、frontend build。源代码验证只作为 SP-01～06 的前置证据，生产停 builder 与真实迁移仍待执行。

worktree=/Users/peiwang/.codex/worktrees/static-deployment/deploy-your-app；主区4项无关 WIP 保护，不提交。原生产 builder 仍运行；原闲鱼 owner 仍8.219.57.52，不启动双活或Mac。新目标47.236.251.192已确认 GemiGo 唯一业务；两机2核2GB。SP-01～09仍待最终线上验收，不宣布完成。

2026-10-07生产验证发现GitHub默认分支经未认证REST查询失败；改为codeload/zip/HEAD，指定分支仍refs/heads，移除非必要REST配额依赖。真实HTML/更新/ZIP/SSE/源码失败保留已通过；补测check与完整workerd验证通过，修订Review无finding；生产GitHub待重新验收。可选Node最终镜像隔离/重启/脚本升级回退测试通过。
