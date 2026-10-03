# 账号与云端存储

## 应用登录

```js
await gemigo.auth.login({
  scopes: ['identity:basic', 'storage:rw', 'points:use'],
  persist: 'local',
});
```

平台账号在每个应用映射为独立 appUserId。应用可获得本应用令牌，不能获得平台 Session Cookie。`local` 使登录跨刷新恢复；`session` 限本页会话；`memory` 不落盘。

```js
const loggedIn = !!gemigo.auth.getAccessToken();
gemigo.auth.logout();
```

令牌过期或缺少授权时，让用户重新点击登录，不能在背景循环弹窗。

## 保存练习进度

```js
await gemigo.cloud.kv.set('progress', {lesson: 3});
const saved = await gemigo.cloud.kv.get('progress');
```

Cloud 数据在应用与账号范围内隔离。付费权益由 `gemigo.points.grants()` 查询，不能通过 Cloud 写入或本地变量自行授予。

需要更多 Cloud API 时参考[完整 API Markdown](/reference/APP_SDK_API.md)。部分文件、Shell 或扩展接口需要对应宿主；网页能力以实际支持为准。默认 `gemigo.ai` 不等于已配置模型服务；当前点数 AI 使用登记的受控服务，见[点数接口](/points)。
