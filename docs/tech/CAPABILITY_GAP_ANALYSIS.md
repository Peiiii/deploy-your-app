# GemiGo 能力差距分析报告

> 对比 Raycast、Electron、微信小程序、Chrome 扩展

---

## 1. 竞品能力矩阵对比

| 能力领域 | 具体功能 | GemiGo (当前) | Raycast (效率) | Electron (桌面) | 微信小程序 (生态) | Chrome 扩展 (浏览) | 差距分析 |
|---------|---------|:-----------:|:-------------:|:-------------:|:--------------:|:----------------:|:--------|
| **系统交互** | 打开文件/链接 | ❌ | ✅ | ✅ | ❌ | ⚠️(仅链接) | **缺失高频能力** (Shell) |
| | 文件选择 | ✅ | N/A | ✅ | ❌ | ❌ | - |
| | 系统托盘 | ❌ | ✅ | ✅ | ❌ | ❌ | 缺失后台常驻能力 |
| | 全局快捷键 | ❌ | ✅ | ✅ | ❌ | ✅ | 缺失快速唤醒能力 |
| **文件系统** | 读写任意文件 | ✅(桌面) | ⚠️(受限) | ✅ | ✅(沙箱) | ❌ | 桌面端已对其 Electron |
| | 文件夹监控 | ✅(桌面) | ❌ | ✅ | ❌ | ❌ | **独特优势** |
| **网络能力** | 任意 HTTP 请求 | ❌(受 CORS 限) | ✅(Node) | ✅(Node) | ✅(wx.request) | ✅(bg script) | **致命缺陷** (CORS) |
| **UI/窗口** | 多窗口 | ❌ | ❌ | ✅ | ❌ | ✅(Popup/Side) | 暂时够用 |
| | 离线运行 | ✅(PWA) | ✅ | ✅ | ✅ | ⚠️ | - |
| **互操作性** | 调起其他应用 | ❌ | ✅(DeepLink) | ✅(Shell) | ✅(跳转) | ❌ | 生态联动缺失 |
| **AI 能力** | LLM 调用 | ✅(内置免费) | ✅(付费 Pro) | ❌(需自接) | ❌ | ❌ | **核心竞争力** |

---

## 2. 关键差距详解

### 🚨 差距一：网络请求 (Network)
**现状**：
GemiGo 应用运行在 iframe 中，受浏览器同源策略限制。
用户无法直接请求 `google.com` 或下载无 CORS 头部的图片。

**竞品做法**：
- **微信小程序**：`wx.request` 由客户端转发，无视 CORS。
- **Raycast**：Node.js 环境，无 CORS。
- **Chrome 扩展**：Background Script 拥有跨域权限。

**建议补充**：
```typescript
// 代理请求，绕过 CORS
gemigo.network.request(url, options)
```

---

### 🚨 差距二：系统 Shell 集成 (Shell)
**现状**：
无法打开外部链接（只能在 iframe 内跳转），无法在 Finder 中定位文件。
创作者"管理素材"场景中，整理完文件后，需要直接打开文件夹查看。

**竞品做法**：
- **Electron**：`shell.openPath`, `shell.showItemInFolder`, `shell.openExternal`。
- **Raycast**：核心就是 Shell 集成，快速打开各类文件/应用。

**建议补充**：
```typescript
gemigo.shell.openExternal('https://google.com') // 默认浏览器打开
gemigo.shell.showItemInFolder('/path/to/file') // 打开文件夹并选中
```

---

### ⚠️ 差距三：后台常驻与快速唤醒
**现状**：
虽然有 `scheduler`，但没有系统托盘图标，用户不仅不知道后台在运行，也无法快速控制（如暂停提醒）。
没有全局快捷键，无法随时呼出（如"一键截图"、"一键翻译"）。

**建议补充（P1）**：
- 系统托盘 API
- 全局快捷键注册

---

## 3. 建议演进路线

### Phase 1: 补齐基础短板 (当前必须)
解决"能不能用"的问题。
1. **Network API**：解决抓取和下载问题。
2. **Shell API**：解决打开文件/链接体验问题。
3. **Clipborad API**（已规划）：增强剪贴板读写（支持图片/HTML）。

### Phase 2: 增强桌面体验 (Q1)
解决"好不好用"的问题。
1. **Tray API**：系统托盘支持。
2. **GlobalShortcut**：全局快捷键。
3. **Dialog API**：原生系统弹窗（Alert, Confirm）。

### Phase 3: 生态互联 (Q2)
解决"应用孤岛"问题。
1. **Router/DeepLink**：支持 `gemigo://app/id?action=xxx` 唤起应用。
2. **Inter-App API**：允许应用间相互调用。

---

## 4. 结论

GemiGo 目前的 AI 能力和跨平台架构通过了 MVP 验证，但在作为**生产力工具**（特别是文件/网络处理）上，**Network** 和 **Shell** 能力的缺失是阻碍创作者使用的主要瓶颈。建议立即补齐。
