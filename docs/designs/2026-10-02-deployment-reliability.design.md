# 发布可靠性设计

来源：[用户原话和失败证据](../logs/2026-10-02-deployment-reliability/README.md)。flow=bugfix，risk=L3/L4，delivery-mode=major。采用既有 Worker/D1、Node、R2 和发布界面。design-document=required；plan=required（跨宿主按依赖发布）。

## 用户结果与黄金链路
1. 用户从现有发布/项目设置入口选择 ZIP，上传一个超过原上限的静态网站（例如 12 MiB），看到上传进度与部署日志，最终点开网站，实际内容正确；不能仅出现 Live。超过产品上限时在上传前清晰拒绝，不能误报成功。
2. 用户填写 GitHub 仓库（HTTPS、SSH 或 github.com/owner/repo），发布公开仓库。系统解析默认分支，下载、安装、构建、验证入口、发布；无效或私有仓库明确说明原因。失败可重试，已有可用站点不被失败尝试清空。
3. 用户发布后断线或关页，服务器继续工作；回来时项目状态可由后台恢复。服务器重启时未完成作业明确失败、可重试，已经完成的结果和诊断仍可重放。日志连接中断本身不能被统计为构建失败。

## 上传
比较提升 JSON 上限与流式临时存储：前者仍有 Base64 33% 膨胀和 Worker 内存风险。选择现有 R2 的临时源文件。
- 新 PUT /projects/:id/deployment-source：登录及项目归属检查，二进制流写 R2，75 MiB 上限（覆盖已观察的 70.6 MB 文件，低于 Cloudflare 请求上限），服务端核对实际字节。
- key 使用 deployment-sources/日期/项目/随机.zip，返回 zipSourceKey；POST /deploy 只传引用。Worker head 验证归属、大小与存在；Node 用既有 R2 凭据读取并清理源文件；需要发布前分析时复用已有 analysisSessions 的准备目录，认领时删除 session，结束清理目录，未认领目录 15 分钟后清理，避免重复下载或丢失临时源。后台清除一天前的孤立源文件。
- 已发布 CLI 等仍用 zipData；小型旧请求保留兼容且同样进入 R2，不再通过 Node 大 JSON。超出旧 JSON 安全范围明确要求升级或网页上传。新 CLI 改二进制请求，保留对外 zipDirectoryToBase64 工具以免破坏包 API。

## 状态与诊断
D1 attempt 是产品状态 owner；Node 是作业结果 producer。删除前端对真实部署的 Building/Live/Failed PATCH 及客户端成功记账权。失败请求必须 reject；成功必须有服务端确认 URL。旧 flow 的终态 PATCH 只能与已持久化、当前 attempt 一致，不能制造成功或覆盖新尝试。
Node 在 DATA_DIR 保存 bounded receipt（status、stage、buildMode、errorCode、errorMessage、metadata、最后日志、时间），不保存 ZIP、HTML 或整个项目/凭据。起始及阶段/终态原子落盘；重启后非终态记录成为 server_restarted。保留 30 天，日志有界。GET /deployments/:id 返回快照；SSE 重放完整终态，未知 ID 明确 404。
Worker POST /deployments/:id/reconcile 为显式恢复操作：认证及归属、读取 Node 快照、复用已有 statusHandler 持久化、返回快照。cron 使用同一路径，覆盖所有待定 attempt，旧于 24h 明确结果不可恢复而非永久 Building。SSE/status 日志在 Worker 入口要求所属用户登录。Node 的直接 API 要求独立 DEPLOY_SERVICE_TOKEN，复用现有 GitHub Secrets→Docker 和 Worker Secrets 配置路径；Worker 不再转发用户 Cookie/Authorization 到 Node，服务端连接使用 HTTPS。生产无 token 时拒绝启动，避免绕过产品权限。D1 增加 stage、build_mode、error_message；只有 builder 错误分类或平台传输错误进入 error_code。
前端先 SSE，断线自动切每 3 秒恢复查询；暂时离线继续显示等待并提示状态查询恢复，10 分钟仍未确认则明确“结果尚未确认”，不写 Failed。成功只由已确认终态触发。

## GitHub、构建和静态产物
在 Worker 部署边界规范化输入并校验 GitHub 域名/仓库格式；拒绝文件名误当仓库，删除仅 non-empty 的弱校验。Node 同一源码 materialization 路径查询 GitHub repository API 的 default_branch；显式 tree 分支使用原路径，404/403/429 有可操作错误，私有仓库不假称支持。
ZIP 解压前校验路径、大小/文件数；忽略 __MACOSX/.DS_Store 后提升单根目录，避免根目录误判。不自动上传 node_modules/.git；提示用户排除。源码按现有 package.json 构建脚本决定 build 或 static；无 build 脚本且已有 index.html 直接托管，缺入口明确报错。保留现有 npm/pnpm/yarn/bun 检测，不新增框架 resolver。命令和下载有超时，构建服务有界队列，防止无限并发耗尽资源。build_mode 和 stage 写入 receipt/D1，为后续是否保留构建功能提供事实。

## 保护已上线网站
现有 R2 先删除 current 再上传会让失败损坏旧版本。新发布写 apps/slug/releases/deploymentId，全部上传完成后最后原子更新 apps/slug/deployment.json 指针。Gateway 解析指针，没有指针的旧站点继续 current；上一版资产在新版本缺失时可读取。只清理不再被 active/previous 引用的旧版本；上传失败清理本次未激活目录。部署前要求 index.html。先配置两侧新 token 并发布兼容 gateway；确认无待定作业后发布 Node，并立即发布持有 token 的 Worker，最后 frontend。Node/Worker 间切换窗口如有请求失败必须保留 Failed/可重试，不能伪造成功。已有 URL 不变。

## 抽象审计与兼容
最小路径：文件/仓库→现有部署服务→持久 receipt→D1→现有 UI 与 app gateway。只新增临时上传 owner 和 Node receipt owner；不引入 Queue、Workflow、通用 job 框架。保留旧静态 current 和旧小 zipData，分别服务已发布网站和现存客户端；新链路不继续产生旧布局。删除客户端状态权和长期 SSE-only reconciliation。

## 验收与交付
契约 DR-01..DR-07 在关联 ledger。验证包含真实 Express/Worker 边界、前端 Provider+Executor、下载/解压、重启 receipt、D1 的终态及旧 flow、R2 失败保护+gateway 新旧路由；适用 tsc/lint/构建，diff-only review。线上使用当前登录用户创建明确命名的私有 QA 项目，验证大 ZIP、GitHub、错误提示、真实站点与数据库，然后清理测试项目/源文件，不触碰客户项目。已记录的历史原因无法恢复，不能填造日志或修写历史统计。

## 方案 Review
2026-10-02：no findings，design-review: passed。有效范围为本文与合同 v1；若新增真实模型缺口先更新设计并审查。

方案补审：已确认 Node 直接 API 可绕过 Worker 日志权限，因此将内部 token 纳入 DR-06；现有部署工作流支持同名新 Secret，无需访问或修改既有 Secrets。补审 no findings，design-review: passed。

方案补审：原 contextSessions 没有实际部署消费者，造成重复 GitHub 下载与准备目录泄漏；收敛到既有 analysisSessions，上传引用贯通 context/prepare/deploy。补审 no findings。

## 构建隔离与服务发布补审
已确认 runCommand 会将平台 R2/API/AI 环境变量交给用户脚本，单纯过滤 env 仍不能防止共享进程和文件系统读取。生产 install/build 必须进入独立临时 Docker 容器：仅绑定本作业目录、非 root、只读根目录、独立 PID、无 Docker socket/平台凭据、512 MiB/1 CPU/128 PID、5 分钟超时和强制回收。可信 Node 服务使用宿主 Docker socket，只允许由配置的 buildsRoot 推导宿主目录，镜像使用本次已构建镜像的不可变 ID。npm/pnpm/yarn 复用镜像既有工具；缺少工具明确报错。静态产物不启动构建容器。Node 启动验证配置与 socket；实际镜像验证隔离后方可发布。
服务脚本先加载新镜像，再停止并保留旧容器；健康检查成功才删除旧容器，失败恢复旧容器。R2 指针响应不确定时查询确认，无法确认则保留完整新版本，绝不删除可能已激活版本。D1 保存终态 URL，Node receipt 过期不能把已确认成功改为失败。
补审核对：以上均位于现有 build/deploy/status owner，未增加作业平台；新增 socket 权限仅可信控制器获得，来访 API 受内部 token 保护。验证增加实际隔离容器、失败回滚和指针写入后断线。design-review: passed（受影响范围）。
