# 开始接入

## 加载 SDK

HTML 中使用固定版本的实际构建产物：

```html
<script src="https://docs.gemigo.io/sdk/0.3.0/gemigo-app-sdk.umd.js"></script>
<button id="login">登录</button>
<script>
document.querySelector('#login').onclick = async () => {
  await gemigo.auth.login({scopes: ['identity:basic', 'points:use']});
  console.log(await gemigo.points.items());
};
</script>
```

SDK 的全局变量是 `gemigo`。浏览器登录需要直接从点击事件触发，允许平台弹窗。点数功能要求已部署在当前应用的 `*.gemigo.app` 地址；自定义 appId 不能绕过项目身份校验。

已有项目的免费功能不需要点数授权。旧登录仅有 identity/storage 时，重新登录申请 `points:use`。

## 发布你的应用

打开 [GemiGo](https://gemigo.io/deploy)，粘贴 HTML 或上传 ZIP。应用成功部署后，从项目设置进入“点数与收益”，创建收费项，将生成的 itemId 放到 SDK 调用中，再更新部署。

使用命令行：按 [CLI Skill](/skills/gemigo-cli/SKILL.md) 安装并登录现有 GemiGo CLI；不要在 HTML 内保存平台账号、Cookie 或部署令牌。

## 完成第一次接入

先在[钱包](https://gemigo.io/wallet)领取体验点，从应用按钮发起购买并在平台确认。刷新应用读取 grants，核对解锁仍然有效；在项目设置检查消费记录。

[下一步：登录与存储](/auth-cloud) · [点数 API](/points)
