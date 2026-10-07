# 当前状态

flow=standard；risk=L4；phase=completed-delivery；retrospective_state=completed；active-contract=GEMIGO-STATIC-20261007；SP-01～09=current passed。

用户授权落地并限定最小体验变化。GemiGo生产取消VPS依赖，原HTML/ZIP/静态GitHub入口、API/CLI、应用地址和结果查询保持；仅没有产物、需要依赖安装或源码编译的输入拒绝云端构建，并提示本地构建后上传。前端无通用布局改版。必要共享GenAI改写、后台发布队列、CI、部署脚本及域名/运维事实同步更新。

## 代码与生产验证

pnpm check；真实workerd/DO重启及alarm游标恢复、队列/去重/取消删除；74MiB输入与160MiB展开SHA，75MiB/500MiB/10000原上限；路径/CRC/秘密文件/变化ETag拒绝；指针丢响应和D1收尾故障恢复均通过。账号/项目quota、原CLI7项、鉴权/SDK云存储/AppGateway17项/元数据/缩略图、前端构建通过。可选Node最终镜像隔离/nonroot/无凭证/重启/部署脚本升级回退测试通过。diff-only实现Review及线上GitHub修订Review无未关闭finding。

生产Worker=b35fda4b-62c6-477f-ba78-58caef0eff7b；受控回退参考旧版本082ccacf-0376-4120-9440-352a7460e56f，先清空待办并核对数据一致，不能在已作为闲鱼专用机的原VPS上直接重启builder。前端gh-pages=9326b07，Pages Production=70737558-f69e-4ece-be43-b6766ac93865、实际index-BfTuW7SQ.js已确认。只发布受影响Worker与前端，其它Worker及Secrets保持。

原builder exited/restart=no，/opt/deploy-your-app/.retired-static-publication生效，生产旧health521；原镜像/数据可恢复，CI不再SSH部署/清理。停止期间原HTML发布/更新/同URL、CLI二进制ZIP+SSE、源码失败保留旧站Live、真实公开GitHub默认HEAD与指定main发布、结果reconcile和删除均通过，3个已有公网网站内容SHA不变。线上默认分支REST查询曾失败，修正为codeload/zip/HEAD；不依赖未认证REST配额。QA项目已删除，不动用户项目。

## 闲鱼专用机

Docker-fupf=47.236.251.192，SSH alias=xianyu-vps，Singapore ap-southeast-1。旧NextClaw机本项目app/tunnel与Mac服务保持停止，NextClaw/clawdbot-manager/CLIProxy/nginx实测仍运行；杭州ECS未动。单活冻结23任务/35文件与全部业务行及原权益/admin/产物一致，运行源码32文件SHA一致，目标Linux23项检查通过。

新机真实Codex完整生成86.379秒；远程独立Codex登录会话下修改74.227秒、375/1440 passed；实际Node SIGKILL后RestartCount=1/healthy。公网独立Chromium预览及实际点击下载revision1 ZIP674485字节、SHA ee140e21d4d0f998c9a200176c2761d1f1b557ea63ab4c33bb977953bdc8d4db一致；原任务ZIP657531字节SHA不变，未付款403/无管理token401/原token200。原任务链接和域名保持，Mac关机不影响运行。全部新增任务为显式demo，不是实付。

原Agiso403已通过Chrome已有登录恢复并同步新VPS600/10001私有会话，真实identity与2026-10-04～10-07本商品Trade/List成功且0单，付款/同步队列均0。AD-10真实付款/出库/模板替换/退款/到账仍待真实买家，试用至2026-10-11，不自动续费或制造验收。当前事实、私有证据和恢复owner见 /Users/peiwang/Projects/explorations/xianyu-auto-dev/docs/work/vps/status.md。heartbeat已改新机/独立认证/登录已恢复，状态无变化保持安静。

## 交付与复盘

源码82c1ef9及5a106e8已普通推送，主工作区master已安全快进，实际origin/master一致且rev-list为0 0。收尾文档同样精确提交/普通推送并再次核对两端。worktree=/Users/peiwang/.codex/worktrees/static-deployment/deploy-your-app；主区4项无关WIP保护，未提交。未购买、续费或释放实例；本次是取消GemiGo构建依赖并复用现有机器，不宣称已减少当前预付账单。

retrospective_decision=updated-existing-deployment-and-vps-sop：在原部署文档写明Worker队列/原指针保留/停止builder后的验收及CI退役；在闲鱼原SOP沉淀跨VPS单活、allowlist源码和独立OAuth会话，事实归原owner，不新增全局规则。产品、AI验证与授权交付缺口已关闭；真实买家验收按用户接受的AD-10边界继续跟进。
