# 错误与恢复

| 反馈 | 操作 |
| --- | --- |
| POINTS_SCOPE_REQUIRED | 点击重新登录，申请 identity:basic 和 points:use |
| SOURCE_MISMATCH | 确认在当前部署的 gemigo.app 地址打开；项目 appId 与 origin 必须一致 |
| ACCOUNT_MISMATCH | 平台与应用登录账号不同，回应用退出再登录同一账号 |
| INSUFFICIENT_POINTS | 打开钱包领取或充值，回消费页刷新并再次确认 |
| TRIAL_UNAVAILABLE | 体验补贴预算用完，不能反复换请求领取 |
| REQUEST_MISMATCH | 同一 requestId 被用于不同收费项；恢复原消费，新消费生成新 ID |
| RETRY_REQUIRED | 钱包正在并发消费；复用原 requestId 重试 |
| INTENT_EXPIRED | 意图十分钟过期；先查询旧收据，未成交再新建购买意图 |
| ITEM_UNAVAILABLE | 收费项停用或属于其它应用，联系该应用作者 |
| unknown | 服务执行结果待核查；查询原收据，不新建扣费任务 |
| PAYMENTS_UNAVAILABLE | 真钱渠道尚未开通，体验点不能证明现金闭环 |
| GRANT_UNAVAILABLE | 额度已用完或属于其它应用；读取 grants，不盲目重复核销 |

弹窗被阻止时，purchase 返回 pending 和 confirmationUrl，显示用户可点击链接。付款后回应用通过原 requestId 查询。手机上也可独立打开同一确认页，平台提供返回应用入口。

请向应用作者提供请求 ID 和收据 ID，勿发送访问令牌、Cookie 或支付密钥。

## 平台运营核查

管理员在[点数钱包](https://gemigo.io/wallet)的“平台点数管理”调整每账号体验点、累计预算与 AI 每日调用上限；配置不改变已领取点数。预算不可低于已发放量。

待核查服务显示原请求与收据 ID。`unknown` 不会自动重新调用上游，必须核实未交付后释放回原点数来源；`running` 不允许释放。作者在应用设置可退未使用权益，按期退款同时停止对应自动续费。应用停用、删除或作者变更时，新的消费与续费停止。
