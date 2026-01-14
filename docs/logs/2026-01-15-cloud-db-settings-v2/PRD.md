# Cloud DB Settings v2 (Collections-first) PRD

## 背景 / 问题

当前 Cloud DB 设置页以“手动输入 collection + 点击 Load”的方式进入配置。该交互存在明显问题：

- 用户首先需要知道 collection 名称，但系统未提供集合列表，学习成本高。
- 大多数项目并未使用 Cloud DB，页面默认/暗示存在某个集合会造成误解。
- “Load”语义不清晰：用户以为是“加载数据”，但实际上是“加载配置”。

## 目标

1. **集合优先（Collections-first）**：进入 Cloud DB 页面先看到集合列表，再进入某个集合的配置页。
2. **配置即配置**：清晰表达“这里是配置权限/规则”，不涉及数据浏览。
3. **低误导**：对未使用 Cloud DB 的项目显示为空状态，并引导新增集合配置。
4. **可维护性**：前后端以“集合列表 API + 单集合配置 API”组成稳定能力层，方便后续扩展（检测集合、权限模板等）。

## 非目标（本次不做）

- 浏览/编辑集合内数据记录（docs CRUD / query UI）。
- 自动“检测所有集合”并展示（可作为 v2.1 选配）。

## 关键定义

- **App**：一个项目的 Cloud DB 逻辑空间，使用 `project.slug` 作为 `appId`。
- **Collection**：一个集合（类比表），同一 `appId` 下可有多个 collection（字符串）。
- **Legacy Permission**：简化权限模式（预设档位）。
- **Security Rules**：更推荐的细粒度规则（JSON），存在时优先于 Legacy Permission。

## 用户故事

### 作为项目拥有者

1. 我进入 Cloud DB 设置页，能看到我项目**已经配置过**的集合列表。
2. 我点击某个集合，能看到该集合当前的 Legacy 权限与 Security Rules 配置，并能修改保存。
3. 如果集合列表为空，我能一键新增一个集合（输入名称），并进入该集合配置。
4. 我可以对某个集合执行：
   - 保存/重置 Legacy 权限（回到默认值）
   - 保存/移除 Security Rules

## 页面交互 / 信息架构

### Cloud DB 页面结构

- 顶部信息：Project / appId（只读）
- 左侧：**Collections 列表**
  - 展示字段：
    - collection 名称
    - Rules 状态（已启用/未设置）
    - Legacy 是否有覆盖（optional）
    - 最近更新时间（permission/rules 的 max(updatedAt)）
  - 操作：
    - “Add collection”输入框 + 添加按钮
    - “Refresh”刷新列表
- 右侧：**Collection 配置详情**
  - 仅在选中 collection 后展示
  - Legacy Permission（select + Save + Reset）
  - Security Rules（编辑器 + Template + Format + Save + Remove）

### 空状态

当 collections 列表为空：

- 左侧显示空状态提示：“No collections configured yet”
- 提示用户通过 Add collection 新增

## API 设计

### 1) 列出集合（新增）

`GET /api/v1/projects/:id/cloud/db/collections`

返回当前项目（appId）下**已配置过**的集合列表（来源：permission overrides + rules rows）。

响应：

```json
{
  "projectId": "…",
  "appId": "…",
  "items": [
    {
      "collection": "comments",
      "permission": { "mode": "creator_read_write", "updatedAt": 1700000000000, "isOverridden": true },
      "rules": { "hasRules": true, "updatedAt": 1700000001234 }
    }
  ]
}
```

### 2) 单集合配置（已存在）

- `GET/PUT/DELETE /api/v1/projects/:id/cloud/db/collections/:collection/permission`
- `GET/PUT/DELETE /api/v1/projects/:id/cloud/db/collections/:collection/security-rules`

## 权限与安全

- 列表与配置均要求登录且为项目 owner。
- `project.slug` 必须存在（作为 appId），否则返回 400 并在前端提示设置 slug。

## 验收标准

1. Cloud DB 页面不再出现“默认 posts”或强制输入 collection 才能开始。
2. 进入页面默认展示集合列表；无集合时展示空状态。
3. 选择集合自动加载该集合配置（无额外 “Load”）。
4. 新增集合后能进入配置页并保存配置；保存后刷新列表可看到该集合。

