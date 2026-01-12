# WX Cloud DB Security Rules DSL v0（JSON）

状态：Draft（实现已落地，DSL 仍可迭代）  
目标：提供一个**业务无关**、可版本化的规则表达方式，用于实现 `docs/tech/WX_CLOUD_DB_PROTOCOL_V0.md` 的 Security Rules 语义。

## 1) 总体语义（对齐微信）

- Rules 以 **collection** 为单位配置。
- 每次请求（read/write）服务端必须基于可信 `auth` 上下文做规则评估：
  - `auth.openid`：当前用户标识（在 GemiGo 上等价 `appUserId`）
- **子集约束**：在 Security Rules 模式下，`query/count/update/remove` 的 where 条件必须是规则的子集；否则返回 `PERMISSION_DENIED`（避免“静默过滤”）。

## 2) JSON 结构

```json
{
  "version": 0,
  "read":  { "anyOf": [ { "allOf": [ /* cond */ ] } ] },
  "write": { "allOf": [ /* cond */ ] }
}
```

### 2.1 `RulesExpr`

RulesExpr 仅支持两种形态：

- `{ "allOf": RulesCond[] }`
- `{ "anyOf": Array<{ "allOf": RulesCond[] }> }`

### 2.2 `RulesCond`

```json
{ "field": "<field>", "op": "==", "value": <RulesValue> }
```

`field` 支持：

- 系统字段：`_openid`, `_id`
- 业务字段：任意字符串（由后端字段路径约束决定）。例如你可以在业务里自定义 `visibility/refType/refId` 等字段，但它们不属于平台系统字段。

### 2.3 `RulesValue`

支持：

- 字面量：`string | number | boolean | null`
- 变量引用：`{ "var": "auth.openid" }`

## 3) 规则模板（解决易用性，不引入平台预设）

### 3.1 仅创建者可读写（等价 legacy `creator_read_write`）

```json
{
  "version": 0,
  "read":  { "allOf": [ { "field": "_openid", "op": "==", "value": { "var": "auth.openid" } } ] },
  "write": { "allOf": [ { "field": "_openid", "op": "==", "value": { "var": "auth.openid" } } ] }
}
```

### 3.2 公开广场：公开可读 + 创建者可写（“知乎 feed”最小闭环）

```json
{
  "version": 0,
  "read": {
    "anyOf": [
      { "allOf": [ { "field": "visibility", "op": "==", "value": "public" } ] },
      { "allOf": [ { "field": "_openid", "op": "==", "value": { "var": "auth.openid" } } ] }
    ]
  },
  "write": {
    "allOf": [
      { "field": "_openid", "op": "==", "value": { "var": "auth.openid" } }
    ]
  }
}
```

> 注意：该模板要求业务方在写入时维护字段 `visibility`（例如 `public/private`），服务端不会做任何“基于 visibility 的预设逻辑”。

## 4) v0 限制（明确）

- 仅支持 `==`（不支持 `!=`, `<`, `in` 等）
- 仅支持 `anyOf/allOf`（不支持嵌套组合）
- 不支持字段级校验（类型/长度/白名单）

这些限制会反映在符合性矩阵中，后续通过 v1 迭代扩展。
