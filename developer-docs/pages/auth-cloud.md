# 账号与云端存储

## 应用登录

SDK 0.3.1 的统一授权页为 `https://gemigo.io/auth/authorize?request=<短期请求编号>`。从应用按钮调用 SDK 创建请求，不要手工拼接授权链接。旧 `/sdk/broker` 弹窗入口仍兼容，应用身份以平台登记的已发布地址为准（也支持登记的自定义域名）。

手机或弹窗受限环境推荐整页登录，在应用启动时处理回调：

```js
try {
  const result = await gemigo.auth.handleRedirectCallback();
  if (result) console.log('已登录');
} catch (error) {
  // 展示取消、过期或失败，允许用户重新点击登录。
}
document.querySelector('#login').onclick = () => gemigo.auth.login({
  display: 'redirect', persist: 'session', scopes: ['identity:basic'],
});
```

`display: 'popup'` 为兼容默认；`auto` 在手机和弹窗被阻止时使用整页返回。注册返回地址默认是应用根 URL，也可传 `redirectUri`，它必须与平台保存的应用发布 URL 完全一致。SDK 在 sessionStorage 中保存十分钟的 state 和 PKCE verifier，回到应用后验证、清除回调参数并恢复原页面地址。URL 只含一次性 code/state，不包含访问令牌或密钥。整页跳转后原登录 Promise 不再返回结果，结果由启动回调取得。

升级后未绑定来源的旧凭证需重新登录；应用数据和账号映射保留。仅申请应用实际需要的权限。身份权限只返回该应用专属 ID，不返回平台密码、邮箱、昵称或头像。


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
