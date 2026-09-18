# Customer Analytics Foundation Implementation Plan

**Goal:** 建立可重复触发的客户分析 Skill，并补齐来源、部署、归因、真人流量和数据保留链路后发布生产。

### Step 1: Versioned analysis skill

- Output: `skills/gemigo-customer-analytics/`，包含运行脚本、口径说明和显式触发入口。
- Test: Skill validator、脚本 `--help`、7 天只读分析运行。

### Step 2: Project and deployment facts

- Output: 项目独立时间戳、不可变部署尝试表、来源持久化、统一 `flow_id`、状态收尾。
- Test: repository/service 单元测试，API typecheck。

### Step 3: Privacy-safe app traffic diagnostics

- Output: 网关机器人分类、匿名哈希、来源/UTM、10 秒去重、小时/日聚合、共享 Secret 鉴权。
- Test: 网关分类与签名测试，API analytics repository 测试。

### Step 4: Attribution and retention

- Output: 产品事件渠道/UTM 字段、90 天日级聚合、30 天明细清理、24 小时 Building 清理。
- Test: Miniflare D1 retention/rollup tests and analytics contract tests.

### Step 5: Quality and production release

- Output: lint、typecheck、相关测试、生产构建全部通过；任务文件提交并推送；远端 SHA 校验；D1 → API → gateway/admin → frontend 发布。
- Test: 生产 API、主站、管理站、真实应用子域 HTTP 冒烟与关键路径验收。

