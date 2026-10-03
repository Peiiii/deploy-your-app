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
