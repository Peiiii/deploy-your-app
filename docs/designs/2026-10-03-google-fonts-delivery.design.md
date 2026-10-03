# Google Fonts 通用交付优化

2026-10-03；standard，L3（全应用网关），发布L4；design-document required，plan not-required（同一gateway单批闭环）。

用户要求：以 app-n4p3 为问题入口，统一提高中国大陆访问速度，不逐应用特判；后续确认指 fonts.googleapis.com/css2?family=DM+。本机绕过系统代理可验证当前大陆线路，不能代表全国。原始证据：应用直连200约1.26s、字体15s连接超时，Chrome默认DNS还出现应用本身连接超时；已有Tailwind镜像与R2缓存不能覆盖字体。

访客打开原应用链接即可看到内容，不需部署者重传。Google CSS及其gstatic文件改由平台assets域交付；重复访问使用浏览器与边缘缓存。Google CSS冷回源超过2.5s或失败返回空CSS/no-store，原font-family的系统字体继续显示；恢复后下次导航重试。失败可由x-gemigo-font-cache识别。保持源R2对象、作者字体选择、已有发布/rollback合同与CSP/SRI。这里的失败回退只针对可选字体，不泛化AI API。

候选：删除字体改变外观；公共镜像引入第三方可用性；选现有gateway固定Google两域镜像，零新增固定服务费、无需秘密或客户迁移。Cache API不能免除Worker请求费；冷请求有上游子请求和有限内存，热请求无需R2或Google。Google CSS使用固定现代Chrome UA取woff2，保留family/weight/text/display查询（若无display或block/auto改swap）；过时浏览器保留系统字体。

主链路：gateway HTML → 预检CSP（1MiB以内，过大保留原流）→ HTMLRewriter改link、内联style/font url；本地外部stylesheet添加专用query标记 → 该CSS交付时仅改Google引用和同源CSS import标记 → assets域两个固定路由 → GET限定上游/短超时/类型和大小检查/Cache API。CSS URL位置采用有限token扫描，跳过注释/普通字符串/转义复杂token；不重写任意JS、任意外站、SVG或业务API。带CSP的HTML、SRI/use-credentials资源保留原引用；完整HTML预检避免后置CSP漏检。CSS自身CSP头亦跳过。绝对assets URL避免base标签影响字体引用；本地CSS marker保留原目录，因此相对图片/字体不受影响。

安全：端点只允许fonts.googleapis.com/css或css2和fonts.gstatic.com/s/；不接受任意目标URL，拒绝凭据、端口、路径穿越、超长查询及redirect；不传访客Cookie/Authorization/Referer/UA；内容上限CSS512KiB/字体5MiB；读取与连接共享超时。CSS query含text时不进入持久R2、不日志打印内容；缓存请求key含完整查询且不混用。字体失败503/no-store；CSS失败200空CSS/no-store；不使用负缓存。HEAD不回body，ETag/304稳定；CSS TTL一天，gstatic版本文件一年。更新hosting ETag版本隔离旧304。

验收GF-01..06见active contract。黄金链路：原链接无VPN加载→文本首屏出现→滚动图片/阅读→刷新字体复用；Google禁用模拟下页面仍<=4s首屏且无直接Google请求；Google恢复后字体正常。另对普通/CSP/完整性约束应用确认原入口内容、相对资源及发布回滚仍工作。实测固定可达104.21.14.73分离CF地址不可达与字体依赖故障，默认DNS单列；记录冷/热各3次FCP、DCL、fonts ready、失败请求，不把图片加载时间当字体收益。

实现前目标：固定可达入口三次冷浏览器FCP均<5s、DCL<6s，字体直连依赖归零；上游失败请求在2.5s+本地传输容差内回退；缓存分支行为精确证明。原入口未固定DNS连通性是独立开放边界，不能由字体收益宣称“全国顶级”；需后续实测并判断是否需要不同接入网络。

抽象审计：仅font delivery模块承担固定上游与CSS引用转换，复用gateway缓存/发布owner，无第二构建状态、不修改部署流水线、不建通用开放代理。

mode=design review：独立核对用户来源、晚置CSP、query隔离、错误回退、CSS相对路径、UA、资源限额与真实入口。无findings；上述有限规则不外推任意Google API。design-review passed。
