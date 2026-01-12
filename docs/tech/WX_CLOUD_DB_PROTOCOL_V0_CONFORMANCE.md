# GemiGo wx.cloud DB Protocol v0 符合性矩阵

本文件用于跟踪 `docs/tech/WX_CLOUD_DB_PROTOCOL_V0.md` 的落地情况，避免“协议写了但实现漂移/遗漏”。

说明：

- **协议**：指 `docs/tech/WX_CLOUD_DB_PROTOCOL_V0.md`
- **状态**：
  - ✅ 已实现（可在 demo/测试中验证）
  - ⚠️ 部分实现（明确缺口/限制）
  - ❌ 未实现

---

## 1) SDK API（wx.cloud facade）

| 能力 | 协议要求 | 状态 | 备注 |
|---|---|---:|---|
| `cloud.init()` | 必须存在（可占位） | ✅ | `packages/app-sdk/src/web/cloud.ts` |
| `cloud.database()` | 必须存在 | ✅ | `packages/app-sdk/src/web/cloud.ts` |
| `db.command` | 必须存在 | ⚠️ | where 支持 `eq/neq/gt/gte/lt/lte/in/nin`；update 支持 `inc/set/remove`（暂不支持嵌套字段 patch） |
| `db.serverDate()` | 必须存在 | ✅ | SDK 生成 sentinel；Worker 侧物化为服务端时间 |
| `collection.add({data}) -> {_id}` | 必须 | ✅ | |
| `collection.where(object)` | 必须 | ⚠️ | 已支持任意字段 + command ops；字段路径当前仅允许 `a-zA-Z0-9_` 与 `.`（backend 约束） |
| `orderBy/limit/skip/get` | 必须 | ⚠️ | `skip` 有上限；`limit` 上限 100；`orderBy` 支持任意字段（但缺索引检测未实现） |
| `startAfter(cursor)` | 扩展（cursor-first） | ✅ | `get()` 返回 `_meta.nextCursor` |
| `doc.get/set/update/remove` | 必须 | ⚠️ | `update` 已支持 `inc/set/remove`；整体仍是“单行读改写”（非多文档事务） |
| `collection.count()` | 必须 | ✅ | `where().count()` 已实现 |
| `collection.update/remove`（批量） | 必须 | ⚠️ | `where().update/remove` 已实现；Legacy 下等价隐式 `_openid==auth.openid`；Security Rules 下做规则子集校验 + 逐文档评估（v0 规则能力仍有限） |

---

## 2) 系统字段（`_id`, `_openid`）

| 能力 | 协议要求 | 状态 | 备注 |
|---|---|---:|---|
| `_id` 自动生成/可指定且不冲突 | 必须 | ✅ | facade 支持 `add({data:{_id}})` 映射到 `options.id` |
| `_openid` 自动写入且不可伪造/不可修改 | 必须 | ✅ | facade 返回注入 `_openid=ownerId`；服务端拒绝写入 `_openid`（400） |
| 禁止客户端写入 `_openid` | 必须 | ✅ | facade 会拒绝写入；服务端会明确报错 `cannot_write_system_field:_openid` |

---

## 3) 规则系统（Legacy Permission / Security Rules）

| 能力 | 协议要求 | 状态 | 备注 |
|---|---|---:|---|
| Legacy Permission 四种模式 | 必须 | ✅ | collection 级 `permissionMode`（仅 4 种 legacy），通过 Admin API 配置 |
| Legacy “隐式追加 _openid 条件” | 必须 | ⚠️ | `creator_read_write` 模式下读侧/写侧均会隐式限制为 owner |
| Security Rules（规则子集语义） | 必须 | ⚠️ | 已支持 v0 JSON rules（仅 `anyOf/allOf` + `==` + `auth.openid`）；query/count/update/remove 做子集校验并服务端强制 |

---

## 4) Worker 端点与语义

| 能力 | 协议要求 | 状态 | 备注 |
|---|---|---:|---|
| add/doc/get/set/update/delete/query | 建议映射 | ✅ | 已有 `/api/v1/cloud/db/*` |
| cursor 一致性（nextCursor+startAfter） | cursor-first | ✅ | 已有 `cursor` 字段 |
| count / bulk update / bulk remove | 协议必须 | ✅ | 已新增 `/count`、`/update`、`/remove` |
