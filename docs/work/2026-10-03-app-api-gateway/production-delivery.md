# 正式发布与验收（2026-10-04）

实现提交：423c1d2；合入并发主线1fe2d98；删除生命周期与恢复修正12eca5c。最终证据提交另见Git历史；文档提交不改变发布的代码。

## 用户入口

- 小伴：https://xiaoban-voice.gemigo.app
- 管理员设置：https://gemigo.io/projects/942b8507-260c-4b85-a579-177314eafe2c?tab=api-connections
- 开发者文档：https://docs.gemigo.io/api-connections
- 小伴源码与构建说明：/Users/peiwang/Projects/voice-companion/README.md；交付目录 delivery 包含源码和正式静态ZIP，均排除真实Key。

小伴在现有用户账号下，通过真实上传与部署服务发布，非D1伪造Live。项目不进公开发现；接口访问为登录模式，身份是本应用SDK用户。应用的两种连接共用预算：每用户20次/日、应用200次/日、应用并发4、用户并发1；voice最长300秒，text最长60秒、文字输出上限1024。管理员可调整、轮换、删除、停用。请求次数不是账单；未实现支付或自定义后端执行。

## 发布与恢复

生产D1执行0007新增表/索引（5条SQL，NRT成功）；API Worker首次发布eb6e1f73-fc12-46da-a4e2-e1bd578e85b3，添加加密keyring Secret后版本481cce71-b909-4729-ab32-b65d5ebec3a8。12个原Secrets名称均保留，只新增APP_SECRETS_KEYS。keyring仅存服务端及600权限的安全备份 ~/.config/gemigo/app-secrets-keyring.json，未提交明文。

前端通过既有gh-pages/Cloudflare发布；线上index-DCiTeo_V.js与本地包逐字相同。文档Worker版本65d0f69a-8636-4985-93fc-8e6f042437e7，文档页面实际200。小伴部署56744d13-4b65-482f-b2e4-e32c000b5855，reconcile接口确认SUCCESS/static；部署SSE连接未自行关闭，未把客户端超时当作构建失败。ZIP SHA与实际资产哈希见production-app-deployment.json和production-assets.json。

恢复包：~/.config/gemigo/recovery/app-gateway-20261004/wrangler.toml，main指向冻结bundle/recovery.js，no_bundle=true，保留全部生产绑定及AppGateway生命周期。用 `pnpm exec wrangler deploy --config <该绝对路径>` 部署，可让新入口503、保持既有账号入口；已通过真实stage `/me`200/连接入口503及最终bundle dry-run。生产未执行恢复。恢复前停用活动连接；保留密文、D1表和keyring。首次DO迁移后不能直接回滚到迁移前Worker，详见原运维owner docs/tech/APP_API_CONNECTIONS.md。

## 有效验证与边界

核心17项实际SQL/加密/取消/脱敏不变量、worker/frontend类型检查、定向lint、静态构建通过；小伴6项测试和lint通过。真实stage覆盖两个OpenAI上游JSON/SSE、Qwen、owner与app身份隔离、原子额度、旋转/停用/删除、私网DNS及Cloudflare严格公网fetch、重定向、项目删除清理；正式环境验证登录要求、DeepSeek JSON/SSE、公开ticket URL/no-store、Qwen连续5轮2449920音频字节。

线上浏览器实际小伴：10次输入转写、10次语音回复、3290880音频字节；播放样本峰值0.546844、输出48000Hz与输入16000Hz上下文running，挂断后两者closed、WS closed。测试使用录音样本及真实应用SDK临时身份；没有替代真人麦克风或物理扬声器。注入、身份和测试聊天历史均已恢复。原生界面收到真实DeepSeek文字回答；设置页面显示两种登录连接及千问测试成功。截图在artifacts/production-settings.png与production-voice.png。

用户端登录弹窗、实际可听性及真实iOS/Android未验证：IAB未显示弹窗，真实Chrome连接失败且本机锁屏；已请求用户从正式入口确认。GW-10保持unverified，不宣布整体用户验收闭环。

两个实验Workers、独立staging DB、5179/4320测试服务已清理；原本机4318语音服务保留。主工作区四个无关修改逐字指纹保留；最终master一致性在证据提交后复核。临时凭据文件收尾删除，生产安全备份及冻结恢复包保留。

## 复盘判断

retrospective_decision: updated-existing-owner。首次DO迁移的回退限制已修正现有运维文档；分块脱敏停顿、慢上传取消、项目删除生命周期均回到实际owner修复并有回归证据。无需为本次单例新增全局规则或重复Skill。长期方法no-increment，待用户听感反馈更新同一合同。parent_status=awaiting-required-user-acceptance；不把发布成功推断为用户验收完成。
