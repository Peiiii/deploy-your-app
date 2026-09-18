# GemiGo 反馈社区设计

日期：2026-09-18

## 产品目标

为 GemiGo 提供一个站内、可检索、可追踪的用户反馈社区，把零散意见变成“发布 → 共识投票 → 官方处理 → 状态回传”的闭环。首版成功标准是用户能够在一个页面完成反馈发布、投票和讨论，管理员能够公开更新处理状态。

## 产品决策

采用站内反馈社区，而不是把微信群、Discord 或 GitHub Issues 作为唯一入口。外部群适合即时交流，但不适合作为长期反馈数据库。

V1 支持：

- 所有人公开浏览反馈；登录用户发布反馈、投票和评论。
- 反馈类型：建议、问题、疑问。
- 处理状态：待评估、已规划、进行中、已完成。
- 排序：热门、最新；筛选：类型与状态。
- 管理员更新反馈状态；作者或管理员软删除反馈和评论。

V1 不支持：

- 附件、富文本、通知、私信、外部社群同步、反馈合并。
- 多级评论树；评论保持单层时间流，降低阅读和治理成本。

## 架构设计

反馈是独立业务域，不复用 `project_comments`。后端在 Cloudflare Worker + D1 中新增 `community_feedback_posts`、`community_feedback_votes` 和 `community_feedback_comments` 三张表，通过 Repository / Service / Controller 分层承载持久化、业务规则和 HTTP 协议。表由 Repository 幂等初始化，沿用项目现有部署方式。

前端新增 `/community` 页面和侧边栏入口。网络访问集中在 `community-api.ts`，业务副作用由 `CommunityManager` 负责，页面只消费 Zustand store 并渲染状态。登录态继续复用现有 `AuthManager`；未登录写操作打开登录弹窗。

## 数据流与错误处理

页面首次进入时匿名拉取反馈列表；API 根据可选 session 返回 `votedByCurrentUser` 与权限字段。创建、投票、评论使用 cookie session 鉴权。Service 统一完成长度、枚举、频率和权限校验；用户输入错误返回 400，未登录返回 401，资源不存在返回 404，频率限制返回 429。

前端对投票采用服务端结果回写，避免乐观更新在失败时产生计数漂移。发布和评论成功后刷新对应列表；错误通过页面内提示或现有 toast 呈现。列表、空状态、加载态和错误态都必须可见。

## 验证策略

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build:frontend`
- 本地启动后验证匿名浏览、登录提示、筛选排序、响应式布局及深色模式。
