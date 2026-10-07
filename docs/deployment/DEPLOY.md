# 生产发布与静态产物部署

GemiGo 生产发布由 Cloudflare API Worker、AppGateway Durable Object、D1 和 R2 完成。HTML、静态 ZIP、公开静态 GitHub 仓库仍使用原入口与 API，访问地址仍是 `https://<slug>.gemigo.app/`。不运行仓库的依赖安装或源码构建；已有 `dist/`、`build/`、`out/` 直接发布。只有没有现成产物、必须编译的输入才提示在本地构建后上传。

实现与本次生产切换证据：[设计](../designs/2026-10-07-static-publication.design.md)、[当前交付状态](../work/2026-10-07-static-publication/status.md)。历史 Node 构建合同保存在 Git 与[旧可靠性设计](../designs/2026-10-02-deployment-reliability.design.md)，不能按旧指南恢复专用闲鱼机器上的 builder。

## 正常交付

```sh
pnpm check
pnpm test:static-publication
pnpm --filter deploy-your-app-api-worker deploy
pnpm deploy:pages
```

前端仍沿 `gh-pages` 触发 Cloudflare Pages 的 `gemigo` 生产分支；不能用 master Preview 证明线上生效。只部署受影响的 Worker，现有 D1/R2/APP_GATEWAY bindings 与生产 Secrets 保持；不需要 VPS、S3 上传密钥或 DEPLOY_SERVICE_BASE_URL。

生产验收从原 API/CLI 发起 HTML、ZIP、静态 GitHub 发布及更新，读取 SSE/reconcile/最近结果、访问实际应用，再删除私有 QA 应用。停止 builder 后重复关键链路，核对既有网站和应用 API；检查当前 Worker 版本、前端实际资源 hash 与 Git 主线。不要制造闲鱼付款或收入。

## 发布与故障恢复

1. 二进制 ZIP 上传到原 `/projects/:id/deployment-source`，保持 75 MiB 输入、500 MiB 展开和 10,000 条目上限。归档范围读取和逐条流式写入，验证 CRC、路径和源 ETag；敏感文件不发布。
2. `/deploy` 鉴权、flow 去重并登记 D1 attempt 后，由同一 AppGateway 保存队列。alarm 分批执行准备、上传、切换与收尾；关页不取消任务。对象重启从持久游标继续；原两分钟 cron 在有待办但没有 alarm 时补醒，不访问 builder。
3. 全部资源写到 `apps/<slug>/releases/<deploymentId>/` 后才更新 `deployment.json`。失败保留旧网站；指针写入响应不确定或收尾失败时幂等重试，已上线 release 不按失败删除。保留当前与上一版本，缩略图和其它项目资产不受清理影响。
4. D1 `deployment_attempts` 是可见结果 owner。原 SSE、reconcile 与项目设置结果查询不变，发布成功先持久化结果；旧终态直接读取。
5. 删除在同项目串行门内取消待办、清理本项目 R2 前缀，再完成数据库删除。存储失败仍返回 STORAGE_DELETE_PENDING，原定时重试保留；临时源过期清理由原 Worker cron 负责。

回退时先核对新静态任务已终态与数据一致，再按交付状态中的上一 Worker 版本受控处理；旧版本依赖builder，必须先安排独立隔离的构建宿主并核验，不能只回退Worker就宣称服务恢复。旧 Node 镜像、容器和 `/opt/deploy-your-app` 数据留作恢复资料，默认保持停止且 restart=no。闲鱼迁移后的 Docker-fupf 不得自动恢复 builder；CI 不再 SSH 部署或清理该机器。

## 可选本地构建工具

`server/` 的 Node 服务、Dockerfile 和 `scripts/deploy.sh` 仍保留用于独立开发环境，隔离构建合同仍由 `scripts/test-deployment-sandbox.mjs` 验证。生产 API 不再连接它；这不是重新开启云端源码构建的入口。默认的原 VPS 路径有退役标记时 deploy.sh 拒绝覆盖。需要本地源码构建时可自行在开发环境构建，再沿原 HTML/ZIP/静态 GitHub 发布。

## 当前宿主退役事实（2026-10-07）

原Docker-fupf（47.236.251.192）现为闲鱼专用机，旧builder容器停止/restart=no，业务上线与QA证据见上述交付状态。原NextClaw机不再运行闲鱼app/tunnel，但其它NextClaw/代理服务保持。不得按旧SSH CI或历史构建设计恢复专用机上的builder；后续GemiGo生产使用本页Cloudflare发布路径。
