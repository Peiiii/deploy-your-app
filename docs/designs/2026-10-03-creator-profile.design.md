# 创作者主页重设计

用户要求重新设计而非微调，并与项目主题保持统一。flow=standard，产品风险 L2；授权沿 AGENTS.md 全托管交付。plan=not-required，单批可闭环。

## 现状与取舍

公开 `/u/:identifier` 使用没有封面的文字卡、独立简介与统计框；`/me` 是编辑表单。数据由 profile API、public-author、profile manager/store 和 reaction store 负责；封面 URL 与加载恢复已有 getProjectThumbnailUrl/useProjectThumbnail。

选择名片＋作品画廊；视频流不适合横向应用封面与连续浏览，侧栏作品集在窄屏难保持身份和作品一致。参考 TikTok 的身份/简介聚合和 Behance 的作品展示（官方 https://support.tiktok.com/en/getting-started/setting-up-your-profile/editing-your-profile 、https://help.behance.net/hc/en-us/articles/360034538213-Guide-Fill-Out-Your-Profile），不照搬其配色或社交能力。

## 冻结方案

公开与自己的主页共用创作者头部和作品封面卡。沿项目 brand、slate、rounded、明暗主题：轻品牌渐变封面、重叠头像、突出姓名、handle、简介、社交链接，公开作品/点赞/收藏作为横向统计。作品区先置顶后其余，3/2/1 列响应式大封面与独立标题简介。只有置顶时不显示错误的“无公开作品”。卡片封面/名称链接真实应用，点赞收藏继续走原 manager，不让它们触发跳转。缺图使用品牌字母封面；复用已有缩略图恢复，不新增服务。

自己的主页使用同一名片，提供查看公开页/复制链接，资料编辑为可展开区域。保留名称/handle 校验、简介、链接增删及排序、置顶取消、拖拽排序与保存；置顶额外提供键盘/手机可用的上移下移按钮。草稿头部反馈不等于已保存，保存操作明确。作品来源改用已加载的 profileData.projects，防止项目 store 未加载时个人主页错误为空；不新增项目/数据 owner。profile 加载失败可重试且禁止保存空草稿。

新增共享 UI 位于 features/profile/components；样式限定 creator-profile 范围。删除被替代的旧头部/重复 stats 显示；不引入关注、上传背景图、虚构认证或修改后台字段。

## 黄金验收

1. 探索页点创作者 → /u/:identifier → 看到身份统计与封面 → 打开作品，再返回 → 点赞收藏登录保护与状态正确；复制主页 URL 指向当前创作者。
2. 登录用户从“我的主页” → 看到同样名片与公开作品 → 展开编辑、修改草稿和置顶顺序 → 保存成功反馈 → 公开页/刷新结果一致。生产不写用户资料，持久化回归复用现有 test:profile-name，UI草稿/控件用本地真实页面验证。
3. 明/暗、桌面/手机：无横向溢出，长姓名/URL能换行；无作品、全置顶、缺简介链接、失败、加载均有准确反馈。图标操作复用 IconButton。最终线上资源身份与发布 build 相符。

主观审美由用户查看线上入口判断；AI 验证布局和行为。后台 API 与权限不变。

## 方案 Review

mode=design：从用户原始大幅重设计要求核对首屏、画廊、自己与公开页统一；复用身份/封面/反应 owner，资料 API 不迁移；空草稿保存保护与全置顶反例已覆盖。共享头部/卡片只服务当前两个消费者，无新 manager/通用框架。design-review: passed，无开放 finding。

## 实现与验证记录

- 共享 CreatorHeader/CreatorProjectCard 收敛公开与自己的主页；编辑组件改名 ProfileEditor，旧 ProfileHeader 删除。profileData 为个人公开作品唯一来源；失败加载和跨账号旧回复保护留在 MyProfileManager/store。
- `pnpm typecheck`、定向 ESLint（零 warning）、`pnpm test:profile-name` 与生产 build 通过。首次直接 frontend tsc 缺上游 package declarations，按项目 `tsc -b` 构建依赖后通过。
- 本地 `/u/46035b90-fa37-4185-857f-05dff77b0168` 使用真实公开 API：封面、复制成功 toast、未登录点赞弹登录框通过。390px 明/暗、320px 窄屏 DOM/截图：viewport 与 scrollWidth 相等，无横向溢出。
- 隔离测试 API/账号 `/me`：展开编辑、简介即时预览、作品下移、保存成功、刷新保留、公开页全置顶顺序一致通过。该证据为隔离回放，不冒充生产写入；生产资料没有被修改。
- diff-only 手工可维护性/实现 Review（项目无专用脚本）：两个当前消费者共享骨架；没有第二份身份、封面、反应或持久化 owner；卡片链接和独立动作不嵌套交互，图标复用 IconButton；失败保护、账号隔离、全置顶反例覆盖，无开放 finding。已去掉无用户价值的 Unknown framework 展示。
- 复盘判断：no-increment；本次是既有 UI 和 profile owner 的收敛，方法已覆盖，无需新增全局规则。用户审美验收待上线入口交付。
