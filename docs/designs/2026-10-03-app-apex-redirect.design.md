# gemigo.app 根域名跳转

## 目标与来源

2026-10-03：用户询问是否将无内容的 `gemigo.app` 跳转至 `gemigo.io`，接受根域名精确匹配、301、保留查询参数的建议后要求“那你来搞”。AGENTS.md 授权实现、验证、Review、生产部署、精确提交与普通推送及主工作区 master 同步。

访客打开 `http://gemigo.app/` 或 `https://gemigo.app/`，自动进入 `https://gemigo.io/`，看到当前官网；带推广查询参数时参数保留。原应用子域名链接继续打开应用。

## 事实与方案

- 当前根域名无 A/AAAA 记录，HTTPS 无法连接；Cloudflare zone active。
- `workers/r2-gateway/worker.ts` 是应用域名访问 owner，根域名现返回 404，`www` 为保留子域返回 404。
- 复用现有 gateway，在存储、缓存和 analytics 前精确判断 `url.hostname === APPS_ROOT_DOMAIN`，返回空 body 的 301，固定目标 `https://gemigo.io/`，复制 `url.search`。无已存在的根域名页面，任意路径统一进入官网首页。
- 301 的缓存时间显式设为 300 秒，便于未来变更和回退。没有动态目标、通用配置或新增服务。
- Wrangler 保留 `*.gemigo.app/*` 路由，增加 `gemigo.app` Custom Domain；Cloudflare 管理根域名 DNS 和证书。官方依据：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ 。部署前核对现有域名与路由，遇到冲突不得覆盖其它 owner。
- 不选择 Dashboard Redirect Rule：当前 OAuth 无 DNS/rules 写入 scope，且新增第二配置 owner；Custom Domain 与逻辑可随现有 Worker 一同维护、验证和回退。
- 风险 L4（生产路由变更），flow=standard，task-type=small-change；design-document=required，plan=not-required（单批可闭环），retrospective_state=completed。

## 验证与恢复

本地在真实 Miniflare runtime 验证 HTTP/HTTPS、GET/HEAD、带查询/非首页路径、固定目标、空 body，以及原应用和 `www` 分支。定向 strict TypeScript、ESLint、域名登记检查、Wrangler dry-run；项目无自动 diff-only maintainability 入口，按 diff 人工 Review。

生产先确认当前 Worker deployment 与绑定，部署时保留 Secrets。验证实际 DNS、证书与 HTTP/HTTPS 301/Location，跟随到官网 200；代表应用、静态镜像及 `www` 保持原行为。若失败，恢复原 Worker 版本和原路由/域名设置，不触碰客户 R2 对象或其它域名。

## Active acceptance ledger

- contract-id: APP-APEX-20261003
- parent-goal: 访客打开 gemigo.app 自动进入可用官网，应用托管无退化。
- scope-revision: 1；scope-confirmation: user-confirmed。

| ID | Required | 合同 | Status | 当前证据 |
|---|---|---|---|---|
| AR-01 | true | 根域名 DNS、HTTPS 可用，HTTP/HTTPS 请求进入官网 | passed | 实际 DNS 与正常连接、跟随 301 到官网 200，TLS 校验 0 |
| AR-02 | true | 301 固定官网首页，查询参数保留，GET/HEAD 正确 | passed | 本地 runtime 和线上精确 Location、空 body 验证 |
| AR-03 | true | 应用子域名、assets 与 www 行为保持，Secrets/R2 内容不变 | passed | 本地回归、线上两个应用/镜像 200、www 404、部署后绑定核对 |
| AR-04 | true | 验证、实现 Review、部署和 Git 两端 master 同步完成 | passed | 生产验收通过；实现提交 2f5a87a 已推送，fetch 后两端 0 0，actual remote SHA 与本地一致；本文收尾提交再复核同一门 |

契约 Review：覆盖真实入口到官网页面，未把 dry-run 或固定 IP 成功当作普通访问成功；没有额外 UI 或用户操作，未加入无关性能、增长或品牌定位要求。

## 方案 Review

mode=design：no findings，design-review=passed。精确 host 判断隔离应用路由；固定目标排除开放跳转；Custom Domain 管理缺失的根域名 DNS/证书，复用单一 gateway owner。所有 Required 可沿实际入口判定。线上既有域名冲突和环境网络仍需部署前后验证。

## 执行记录

- 本地真实 Miniflare：HTTP/HTTPS × GET/HEAD、查询参数与非首页路径、固定目标、空 body、www/相似域名隔离通过；原 HTMLRewriter、R2 原内容、ETag、镜像/缓存/HEAD 回归通过。
- strict 定向 tsc、targeted ESLint、check:domains、diff --check 通过；test-app-delivery-cache 与 test-thumbnail-performance 通过。
- Wrangler dry-run 通过，gzip 6.54 KiB，仍为原 ASSETS 和三个公开 vars。
- 生产基线：现有唯一 route `*.gemigo.app/*` 指向 gateway；无 gemigo.app Custom Domain。当前 deployment version `ef5bc879-5fa9-4bbf-9f07-56ea4e917f65`。原 `ANALYTICS_INGEST_SECRET` 只核对绑定名，不读取值；原绑定均保留。
- DNS records API 受 OAuth scope 限制返回 403；公共 DNS 查询和 account Custom Domains 列表可用，Custom Domain 无既有 owner 冲突；由 Wrangler 执行域名创建并处理 DNS 冲突，不直接覆盖 DNS。
- implementation review / diff-only maintainability：no findings。仅核对本次四文件实现 diff 与本设计；精确 host、固定目标、参数编码、分支顺序、301 缓存、原通配 route/绑定、真实 runtime 和代表应用回归有充分本地证据。原有 host suffix 逻辑未扩改，未新增第二 owner。部署后 DNS/证书/实际 HTTP 与生产绑定待验。
- 生产版本 `57fd03ab-3a17-4a7d-bce5-1d2c0755ef5b`，gateway Custom Domain `gemigo.app` 已 enabled；原通配路由 pattern、script、fail-open=false 保持。绑定列表与发布前一致，Secret 仅保留绑定，未读取或重写；未执行任何客户 R2 写入。
- 正常公共 DNS 与 1.1.1.1 返回 `104.21.14.73` / `172.67.158.44`；无固定 IP 覆盖的 curl 实测 HTTP/HTTPS GET 301、0 bytes、Location=https://gemigo.io/；HTTPS query/path GET、query HEAD 精确保留参数，Cache-Control=public,max-age=300。跟随查询参数请求最终 `https://gemigo.io/?utm_source=apex-qa`，200、一次跳转、TLS verify=0。
- 发布前后同组线上 HEAD：`geeglo`、`peiiii-os-portfolio` 200/r2；`www` 404；Tailwind 镜像 200、JavaScript、原 ETag 保持。验证范围为本任务域名入口和代表应用，不声称覆盖所有地区网络。
- 根域名正常跟随 GET 取得官网 HTML 8411 bytes，title=`GemiGo – Deploy & Share Web Apps in One Click | Free Static Site Hosting`，实际官网内容已到达。
- 源码提交 `2f5a87aab25d389506c787792f798089f0d0fe48` 普通推送；主工作区当前为 master，重新 fetch 后 `master...origin/master` 为 `0 0`，`ls-remote refs/heads/master` 与本地 SHA 相同。暂存区为空，其它任务原有四项改动保留，未提交。

## 复盘与完成

retrospective_decision=no-increment：根域名职责与部署配置已经更新到现有 gateway README/源码，没有额外可复用的方法缺口，不新增全局规则或 Skill。

AR-01..04 passed；retrospective_state=completed；parent_status=ready-for-completion-check。本文收尾 commit/push 后再次核对实际远程 SHA 与主工作区同步，才完成交付。入口 https://gemigo.app/ ，无需登录或额外设置；打开后地址栏进入 gemigo.io，官网正常显示。没有需人工批准的开放项。
