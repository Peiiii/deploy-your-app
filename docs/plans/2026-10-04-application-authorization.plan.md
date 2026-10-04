# 授权优化执行计划

设计：../designs/2026-10-04-application-authorization.design.md。
1. 发行来源失败基线；统一后端校验、source_origin迁移、短期request与公开context/一次性授权。AUTH-01/03。
2. SDK popup/redirect返回与错误生命周期，小伴redirect接入和公开文档；保持旧入口。AUTH-04/05/06。
3. 统一授权页与可信应用信息、权限解释、账号/取消/错误/主题/手机布局。AUTH-02。
4. 定向验证与Review，精确commit/push/master同步，部署API/Pages/docs/SDK/小伴，实际页面返回验收。AUTH-07。
只重验受影响证据，物理声音及真实手机保持未验证直到用户确认；无多代理授权，不委派。
