# 产品目标：deploy-your-app

## 1. 产品定位
- 面向对象：前端应用（以 Vite/React 为主），输出为静态构建产物（例如 `npm run build` → `dist/`）。
- 核心价值：用户给出代码仓库（GitHub）或打包好的 ZIP，即可一键完成：
  - 安全检查与 AI 相关代码改写（通过 Gemini），避免在前端直接暴露真实 API Key。
  - 自动构建与部署到静态托管平台。
  - 得到一个可以直接访问的线上 URL。

## 2. 技术约束与方向
- 仅支持静态前端项目（不支持后端服务/长连接等复杂部署）。
- 部署目标平台：Cloudflare Pages 或类似静态托管平台（GitHub Pages 等），当前产品路线倾向 Cloudflare Pages。
- 产品整体架构：
  - 前端：React + Vite，一个可视化控制台（Dashboard + 新建部署向导）。
  - 后端：Node/Express 服务，负责：
    - 拉取代码仓库、安装依赖、构建。
    - 调用 Gemini 做安全分析和代码改写。
    - 调用目标托管平台（后续的 Cloudflare Pages）完成静态资源部署。
    - 向前端通过 SSE 推送实时构建日志与部署状态。

## 3. MVP 阶段目标

### MVP1（当前实现的版本）
- 范围：
  - 只支持 GitHub 仓库作为代码来源。
  - 后端在本机：
    - `git clone` 仓库。
    - `npm install`。
    - `npm run build`。
    - 自动识别构建目录（`dist/`、`build/` 或 `out/`），将其复制到本地 `apps/<project-slug>/` 目录。
  - 后端以静态资源形式在 `/apps/<project-slug>/` 路径下对外提供应用。
- 前端能力：
  - Dashboard 展示项目列表（名称、来源、状态、访问链接）。
  - 新建部署向导（选择 GitHub 仓库、设置项目名、填写/粘贴代码片段、触发部署）。
  - 通过 SSE 实时显示部署日志（clone、install、build 等步骤）。
  - 部署完成后，提供「Open App」按钮，打开 `/apps/<project-slug>/`。
- 安全分析：
  - 暂时使用后端 stub：`/api/v1/analyze` 回传带有提示注释的代码，先保证产品流程跑通。

### MVP2（下一步要实现的目标）
- 将安全分析逻辑迁移到后端，真正调用 Gemini：
  - 后端根据用户提供的 API Key 调用 Gemini，对代码中的 GenAI 调用进行重写。
  - 输出安全代理入口（如 `baseUrl` 指向后端或代理服务），避免在前端暴露真实 API Key。
- 引入部署 Provider 抽象，支持 Cloudflare Pages 部署：
  - 在后端封装本地静态部署与 Cloudflare Pages Direct Upload 的实现。
  - 配置化选择部署目标（例如通过环境变量 `DEPLOY_TARGET=local|cloudflare`）。
  - 当使用 Cloudflare Pages 时，在构建完项目后将静态资源上传到 Cloudflare，并使用 Cloudflare 提供的 URL 作为最终访问地址。
- 前端保持不变（仍然通过统一的 HTTP 接口与 SSE 获取状态），只需展示由后端返回的最终 URL。

## 4. 长期演进方向（非 MVP 必须）
- 支持更多前端框架的探测与优化（Next.js、SvelteKit 等静态导出模式）。
- 为部署历史、回滚、环境变量管理等高级功能预留接口。
- 将安全代理从“简单代理”升级为可配置的 AI 网关（限流、审计、策略等）。
- 提供“AI 适配层”：允许平台自己的 AI（默认 DashScope + Qwen3-Max）根据用户意图，动态重写用户代码，使其可以无缝切换/适配不同的推理提供方（Gemini / OpenAI / Moonshot / 其他兼容 OpenAI 的厂商），并将这套重写策略以产品功能的形式暴露给用户进行定制。
