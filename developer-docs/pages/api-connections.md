# 应用 Secrets 与 API 连接

GemiGo 的应用仍只部署前端。项目所有者可在「项目设置 → API 连接」保存自己的 Secret，再配置一个受控的服务端中转连接。上游 Key 不进入静态包，保存后只显示名称和版本，不能回读明文。

## 配置与范围

1. 创建 Secret，例如 `MODEL_KEY`，填写上游服务的 Key。
2. 新建连接，选择协议、公共 HTTPS/WSS Base URL、引用的 Secret、鉴权 Header 和前缀。`Bearer ` 的末尾空格需要保留；服务也可以使用 `x-api-key` 等自定义 Header。
3. 选择登录访问或公开访问，配置模型白名单及次数、并发、最长时长。默认要求登录，用户每日20次、应用每日200次、应用并发4、用户并发1。
4. 点击测试，再复制调用地址接入已发布应用。测试也计入额度。停用连接、替换或删除 Secret 会撤销未使用票据并中断引用它的活动请求。

| 协议 | 已支持的行为 |
| --- | --- |
| `openai-chat` | POST Chat Completions，JSON 或 SSE，白名单模型，强制单候选与最大输出 Token；Base URL 常用 `https://api.example.com/v1` |
| `qwen-realtime` | 千问原生实时 WebSocket，PCM16输入、PCM24输出、转写、VAD、回复与打断；使用白名单第一项模型 |
| `http` | 作者声明一个固定 GET/POST 方法和路径，JSON请求体，JSON/文本/SSE响应；访问者不能替换目标URL或请求鉴权Header |

这是声明式中转，没有用户后端代码执行，也没有任意 URL 转发。仅接受公网域名、443端口，不跟随重定向。当前不支持 OpenAI Responses/OpenAI Realtime、任意二进制接口、动态路径/查询参数、第三方签名脚本。Secret 名称和内容可自定义，只有连接引用的值会在服务端用于鉴权。

## 前端接入

请求必须从该应用当前发布的 Origin 发出。开发 localhost 不能冒用线上应用入口。`projectId` 是项目不可变 ID；SDK登录的 `appId` 是当前发布 slug。Origin 只是来源校验，公开模式仍可被外部脚本模拟；需要可靠的每用户限额时使用登录模式。

登录按钮中同步调用现有 SDK 登录方法，取得应用身份：

```js
// gemigo 来自 @gemigo/app-sdk 的浏览器构建。
await gemigo.auth.handleRedirectCallback(); // 应用启动时
// 登录按钮中调用：
await gemigo.auth.login({ appId: 'your-app-slug', scopes: ['identity:basic'], persist: 'session', display: 'redirect' });
```

获取60秒内有效、只能使用一次的票据，然后调用连接。**浏览器只持有应用登录 Token 和短时票据，没有上游 Key。**

```js
const abortController = new AbortController();
const projectId = 'your-project-id';
const connection = 'text';
const accessToken = gemigo.auth.getAccessToken();
const response = await fetch(
  `https://gemigo.io/api/v1/apps/${projectId}/connections/${connection}/tickets`,
  { method: 'POST', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }
);
const ticket = await response.json();
if (!response.ok) throw new Error(ticket.error);
const result = await fetch(ticket.httpUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Gemigo-Ticket': ticket.ticket },
  body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }], stream: true }),
  signal: abortController.signal,
});
if (!result.ok) throw new Error((await result.json()).error);
// 按 OpenAI SSE 消费 result.body；取消 reader 或 abort 会中止上游。
```

语音连接用同一票据申请路径，改为连接名 `voice`。浏览器 WebSocket 无法自定义鉴权 Header，因此短时票据放在查询参数中；不要记录或分享带票据的 URL。

```js
const socket = new WebSocket(`${ticket.websocketUrl}?ticket=${encodeURIComponent(ticket.ticket)}`);
socket.onmessage = ({ data }) => {
  const event = JSON.parse(data);
  if (event.type === 'session.created') socket.send(JSON.stringify({
    type: 'session.update', session: { voice: 'Cherry', instructions: '简短地用中文回应。' }
  }));
  // session.updated 后发送 input_audio_buffer.append；收到 response.audio.delta 后按24kHz PCM播放。
};
// 挂断 socket.close()；打断发送 {type:'response.cancel'}，并清除本地播放器队列。
```

每个连接决定阈值，计数和并发由整个应用的连接共享。失败、测试和未消费票据都计入当日请求次数；未消费票据60秒后释放并发。公开访客按平台提供的地址派生匿名标识，无法当作可靠用户。上游费用由 Key 账户承担，当前没有平台付费结算，也没有假定的精确费用统计。

常见错误：401需要登录或票据过期/已使用；403应用身份或来源不匹配/连接停用；429额度或并发已满；502上游地址、Key、模型权限或网络失败。Key被撤销时，应重新配置Secret，不在前端补Key。


平台运维与恢复步骤见[技术说明](https://github.com/Peiiii/deploy-your-app/blob/master/docs/tech/APP_API_CONNECTIONS.md)。
