# 原始输入与约束

2026-10-03：用户指出 https://app-n4p3.gemigo.app/ 加载慢，怀疑Google API，要求考虑中国大陆访客、用户自行部署，平台只能做通用逻辑，希望可访问性与速度达到顶级；补充明确指 https://fonts.googleapis.com/css2?family=DM+；指出本机不走VPN即可实测。授权沿用AGENTS全托管模式。不能把字体确认解释成排除其它必要访问问题。

本机scutil显示HTTP/HTTPS/SOCKS代理127.0.0.1:7890，环境proxy变量亦set；curl --noproxy '*'与Chrome --no-proxy-server显式绕过。未修改用户系统网络配置。curl应用IPv6直连1.264s200、Google15.003s连接超时；Chrome默认应用DNS发生30s ERR_TIMED_OUT，需要固定可达104.21.14.73单列字体验证。

flow standard；design/review passed；active contract docs/work/2026-10-03-google-fonts-delivery/acceptance-contract.md；retrospective_state pending。实施owner workers/r2-gateway，隔离worktree fonts-delivery；主区analytics脚本与三项untracked为无关改动，保护。

## 发布前验证与Review

strict定向tsc passed（CF CacheStorage.default补充声明为临时类型入口，与既有Worker一致）；targeted ESLint passed；Google Fonts真实Miniflare assembled测试passed，涵盖HTML/CSS/import/晚置CSP/SRI/相对路径/原R2不变、缓存query隔离/CORS/HEAD/304/no-store、固定上游/不转Cookie与Authorization/拒redirect/类型/大小/2.5s超时；原app-delivery-runtime/cache回归passed，发布/rollback/legacy缓存owner未变。wrangler dry-run passed（bindings/routes保持原样，gzip14.17KiB）。

diff-only maintainability：仓库没有独立自动入口，按diff及相邻合同人工审查。mode=implementation无未关闭finding；审查修正外部base污染stylesheet query、普通CSS注释误匹配、错误响应body取消与If-None-Match通配符。修正后定向证据passed。剩余生产边界：实际Google回源/CJK字体分片与assets域网络延迟，发布后真实浏览器验收。生产回退版本606b4d3e-bc97-4c09-9a52-7c325b99dd9d。

## WOFF2与非阻塞返工

完整Chrome UA修正生产协商，TTF改WOFF2；mirror namespace v2隔离旧CSS缓存。v2首轮冷FCP5.228/3.480/3.880s，首条超过GF-03，不降低目标；返回Design增加非阻塞font styles。默认DNS复验本机原入口FCP2.152s、无导航失败，先前30s不可达是本线路波动而非字体机制已可保证全部解决。

v3保留旧namespace路由兼容缓存；HTML/CSS font imports瞬时data stylesheet携带平台引用，async runtime经真实CSSOM含nested imports加载fontfaces。CSP/SRI/条件imports保持原合同。assembled regression与strict tsc/targeted lint通过；真实Chrome组装验证原视觉CSS先显示、nested import可发现、正常woff2加载以及上游2.5s超时，FCP均远小于2s（本地模拟网络，只证明机制，不充当生产成绩）。mode=implementation复审无findings；生产实际字体与FCP仍待最终复验。

## 最终生产实测与边界

最终生产Worker54830cb9-eedf-4900-9f89-5bb820e07ecf；含font v3非阻塞与已合入主线的analytics-v2。并行任务合并冲突仅import/HTML ETag，保留两者且重验strict tsc/lint/assembled/runtime回归；保留生产Secrets。并行analytics发布在读取旧false与字体部署之间发生，字体第一次沿用旧false配置曾短暂关闭观测；核对最新部署即按最新主线true恢复并复验HTML两脚本均存在，最终不回退观测功能。回退整个Worker会影响并行功能，因此优先以保留analytics的源码revert字体变更重新部署；旧606b4d3e仅历史基线，不作为当前可直接回退的建议。

真实Chrome无代理、禁QUIC、固定可达IPv4 104.21.14.73，独立context三次cold，各复用一次warm。cold FCP1.164/1.216/2.520s，平均1.633、中位1.216；warm1.420/1.352/1.288s，平均1.353。cold DCL2.764/2.022/4.301s；全部满足预定<5s/<6s门槛。没有直接Google请求，全部已观测字体响应200；WOFF2和DM Mono/Noto Serif SC/Source Serif 4加载通过。一次cold font ready在10s观测上限仍有7个subset loading，下一warm全部已用字体loaded，不能把首屏时间当所有字体下载时间。未使用的unicode range字体保持unloaded是浏览器正常按需行为。cold浏览器不是全局边缘冷缓存；并发其它测试和实际互联网波动作为环境限制。

默认DNS、同样无代理的原入口也实测FCP1.332s、无导航失败，无需用户改DNS或固定IP；此前30s连接失败说明本机CF路线有波动，本次成功不升级全国可用性保证。镜像跨应用共用assets域，已有应用无需重上传。最终HTML已不含阻塞Google import，font helper与analytics helper并存。

外部图片真实边界：hero Wikimedia原图7,062,648 bytes，首轮约24.67s，warm的一张WordPress外部图片出现connection reset；不伪称全页load/所有图片已加速。原cdn-cgi/image/width=640公开探测返回Cloudflare404，当前没有验证可用的图片transformation能力；接入需明确启用与额度/来源策略，不把不可用服务URL写入客户页面。官方[Images优化开关](https://developers.cloudflare.com/images/optimization/transformations/overview/)、[额度与价格](https://developers.cloudflare.com/images/pricing/)为调研来源，不是已开通事实。要全国覆盖仍需运营商多点证据与接入网络选择；[China Network上线条件](https://developers.cloudflare.com/china-network/get-started/)含Enterprise独立套餐、ICP备案及内容审核，现有项目未提供这些外部前提。本次无法凭一个本机线路或源码改写闭合“全国所有任意应用顶级”，交付的是已生效且可验证的通用字体改进，剩余平台接入与图片能力依赖明确披露。

成本：没有新增固定月费或R2写入。每访问额外一个1591 bytes font helper请求（浏览器可长期缓存）；各CSS与实际使用的字体subset经Worker请求，热缓存不回源Google，冷请求有上游子请求与有限CPU/内存开销。不声称账单零增或Cache API绕过Worker计费；未做全账户账单归因。

AI validation与implementation Review当前有效、no findings；源提交df093b8/eeb770a/fc2ae44及合并74e901e包含已发布字体实现。黄金验收入口https://app-n4p3.gemigo.app/：默认网络直接打开→内容先显示→字体随后加载→刷新复用，原应用阅读/滚动保留。

retrospective_decision: updated-existing-owner。回写原architecture网关字体owner和兼容/性能边界；已验证机制保留在模块/回归测试，不新增Skill或指令规则。retrospective_state: completed；parent_status ready-for-completion-check（仅字体改进已交付、整体全国顶级目标仍有上述外部条件）。

生产HTTP复验：v3 CSS MISS→HIT、准确ETag304/0bytes、HEAD200/0bytes，runtime1591bytes/immutable/CORS，analytics script200；证据evidence/http-final.json。冷CSS自身TTFB4.57s、热0.99s（新连接），仍是非阻塞加载，不能称字体下载本身恒定亚秒。当前主线合并与源区无关草稿受保护，最后Git 0 0/actual SHA在交付末尾复查。
