# 点数与应用自定义消费

## 登记收费项

在 GemiGo 项目设置 → 点数与收益中填写名称、用户可见说明、点数、类型与权益键。重复消费可授予额度，或选择平台知识 AI 解说；一次解锁授予永久权益；按期权益保存期限，用户可以另行授权自动续费。

价格创建后固定，调价须新建收费项并停用旧项。测试功能也调用真实接口，体验点不产生现金收入。

## 接口

```js
const items = await gemigo.points.items();
// item: id/name/description/type/price/entitlement/units/period_seconds/delivery
```

应用自行选定触发按钮或任务节点。一次消费的 requestId 在双击、断网与刷新恢复期间保持不变，新一笔消费才创建新 ID。

```js
const requestId = localStorage.getItem('pending-purchase') || crypto.randomUUID();
localStorage.setItem('pending-purchase', requestId);
const result = await gemigo.points.purchase({itemId: '收费项ID', requestId});
if (result.status === 'granted') {
  localStorage.removeItem('pending-purchase');
  await restore();
} else if (result.status === 'pending' && result.confirmationUrl) {
  // 显示用户可点击的链接。弹窗被阻止时仍可去平台确认。
  showConfirmationLink(result.confirmationUrl);
}
```

平台窗口以后台价格为准，并核对应用和用户。充值不自动提交待确认的消费。窗口关闭也不能撤销已确认交易，回到应用查同一收据。

```js
const receipt = await gemigo.points.receipt({requestId});
// 或 gemigo.points.receipt({id: receiptId})
```

`granted` 为已交付；`reserved/running` 为服务待完成；`unknown` 为结果待核查，不可再用新请求购买同一任务；`released/refunded` 表示恢复原点数；`cancelled` 仅表示未查到交易的窗口退出。遇到 RETRY_REQUIRED 使用原 requestId 重试。

## 权益与额度

```js
const grants = await gemigo.points.grants();
const unlocked = grants.durable.some(g => g.entitlement === 'advanced');
const member = grants.terms.some(g => g.entitlement === 'member' && g.expires_at > Date.now());
const hint = grants.quotas.find(g => g.entitlement === 'hint' && g.remaining > 0);
if (hint) {
  await gemigo.points.consume({grantId: hint.receipt_id, requestId: crypto.randomUUID()});
  // 核销成功后展示本次提示。恢复时同次核销也复用 requestId。
}
```

核销使用已经购买的本应用额度，不再扣全局点数。按期重复购买从当前到期时间或当前时间中的较晚者延长。续费勾选在平台确认页，钱包可取消；余额不足停止，不追扣错过周期。

客户端可修改公开 HTML。权益记录可信，但真正需保护的数据、资源或计算仍需可信后台检查，不能将隐藏按钮当作绝对保护。

## 受控 AI

先创建 delivery=ai 的按次收费项，然后传入不超过 160 字的知识主题：

```js
const result = await gemigo.points.purchase({itemId, requestId, topic: '为什么天空是蓝色的？'});
// reserved/running: 稍后查询同一收据
const receipt = await gemigo.points.receipt({requestId});
if (receipt?.status === 'granted') showText(receipt.result.text);
```

模型由平台指定，最多输出 256 tokens，有全局日预算。结果持久化后结算；明确无结果释放点数，调用不确定时等待平台核查。应用不能传入任意模型、上游 URL 或密钥。
