# Desktop Release（下载安装包发布指南）

本文档说明如何发布 `Gemigo Desktop` 的安装包，并重点覆盖 macOS 上“已损坏，无法打开”的根因与解决方案（代码签名 + 公证 notarization）。

---

## 1. Release 触发方式

本仓库桌面端安装包由 GitHub Actions 自动构建并上传到 GitHub Release。

- 一键发布（推荐）：在仓库根目录执行
  - `pnpm release:desktop`
  - 默认行为：对 `desktop/package.json` 版本号做 `patch` 自增 → 提交并 push → push tag `desktop-v<version>` 触发 Release workflow
- 手动触发：push 一个 tag
  - `desktop-v*`（例如 `desktop-v0.1.7`）

对应 workflow：`.github/workflows/desktop-release.yml`

---

## 2. 为什么 macOS 会提示“已损坏，无法打开”

macOS Gatekeeper 对**从互联网下载**的应用会做严格校验：

- 未签名 / 未公证（notarized）的 App，经常会被拦截并显示“已损坏，无法打开”
- 这不是“文件真的坏了”，而是系统策略阻止运行

结论：**对外分发必须做 Developer ID 代码签名 + notarization（并建议 stapling）**。

---

## 3. macOS 正式发布：你需要准备什么

### 3.1 Apple 账号与权限

- 必需：加入 **Apple Developer Program**（公司/个人均可）
- 需要能创建证书（Developer ID Application）并生成 App-Specific Password

### 3.2 需要配置到 GitHub Secrets 的信息

桌面端 Release workflow 支持可选的签名/公证步骤，你需要在 GitHub 仓库里配置以下 Secrets（名称固定）：

- `MACOS_CERTIFICATE_P12_BASE64`：Developer ID Application 证书（包含私钥）的 `.p12` 文件的 base64
- `MACOS_CERTIFICATE_PASSWORD`：导出 `.p12` 时设置的密码
- `APPLE_ID`：你的 Apple ID 邮箱（用于 notarization）
- `APPLE_APP_SPECIFIC_PASSWORD`：App-Specific Password（用于 notarization）
- `APPLE_TEAM_ID`：Team ID（10 位字符串）

> 说明：没有配置这些 Secrets 时，workflow 仍然会构建 dmg/zip，但**不会签名/公证**，下载后大概率会被 macOS 拦截。

---

## 4. 如何获取这些信息（一步步）

### 4.1 获取 Team ID（`APPLE_TEAM_ID`）

常见方式：
- 登录 https://developer.apple.com/account → Membership / Account → 找到 `Team ID`

一般是类似 `ABCDE12345` 的 10 位字符串。

### 4.2 生成 App-Specific Password（`APPLE_APP_SPECIFIC_PASSWORD`）

1. 登录 https://appleid.apple.com/
2. 进入 “Sign-In and Security” → “App-Specific Passwords”
3. 生成一个密码（格式类似 `xxxx-xxxx-xxxx-xxxx`）

把它保存为 GitHub Secret：`APPLE_APP_SPECIFIC_PASSWORD`

### 4.3 创建并导出 Developer ID Application 证书（`.p12`）

你需要得到 **Developer ID Application** 证书，并确保导出时包含私钥（非常关键）。

**方式 A（推荐）：在 Mac 上用 Keychain Access 操作**

1. 在 Apple Developer 网站创建证书：
   - https://developer.apple.com/account → Certificates → 新建 `Developer ID Application`
2. 按页面引导生成 CSR 并下载证书
3. 双击安装证书到 Keychain（登录钥匙串）
4. 打开 “Keychain Access”：
   - 在 “My Certificates” 里找到 `Developer ID Application: ...`
   - 展开后确保下面有对应的私钥（小钥匙图标）
5. 右键该证书 → Export → 导出为 `.p12`
   - 记住导出密码（写入 `MACOS_CERTIFICATE_PASSWORD`）

**将 `.p12` 转成 base64（写入 `MACOS_CERTIFICATE_P12_BASE64`）**

在本地执行（macOS）：

```bash
base64 -i codesign.p12 | pbcopy
```

把剪贴板内容粘贴到 GitHub Secret：`MACOS_CERTIFICATE_P12_BASE64`

> 注意：不要把 `.p12` 提交到仓库；只通过 GitHub Secrets 保存。

---

## 5. 在 GitHub 仓库里怎么配置（Actions Secrets）

路径：
- GitHub Repo → Settings → Secrets and variables → Actions → New repository secret

依次创建：
- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

配置完成后，再发布一次（`pnpm release:desktop`），macOS 产物应当能直接正常打开。

---

## 6. 本地验证（可选）

安装后在 macOS 上验证签名/策略：

```bash
codesign --verify --deep --strict "/Applications/Gemigo Desktop.app"
spctl -a -vv "/Applications/Gemigo Desktop.app"
```

---

## 7. 临时绕过（仅用于自测，不建议对外）

从 dmg/zip 安装到 `/Applications` 后：

```bash
xattr -dr com.apple.quarantine "/Applications/Gemigo Desktop.app"
```

这只是移除下载隔离标记，不等于完成签名/公证。

