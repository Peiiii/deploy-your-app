# 环境变量配置总览

这份文档整理了本项目在「开发环境」和「生产部署」中会用到的所有环境变量，按使用场景和位置分类列出，并说明作用、是否必填以及推荐放在哪里配置。

---

## 一、本地开发环境

### 1.1 后端（Node / Express）

后端默认从 `server/.env` 加载配置（通过 `loadBackendEnv`），环境变量也可以直接从 shell 注入。

| 变量名 | 作用 | 是否必填 | 默认值 / 说明 |
|--------|------|----------|---------------|
| `SERVER_PORT` | 本地开发时后端监听端口。代码顺序是 `PORT > SERVER_PORT > 4173`，这里主要用于你自己起本地 server。 | 否 | `4173` |
| `PORT` | 通用端口变量，优先级高于 `SERVER_PORT`。通常在云环境（Render 等）注入；本地一般不需要设置。 | 否 | 无（回退到 `SERVER_PORT` 或 4173） |
| `PLATFORM_AI_PROVIDER` | 平台侧 AI 提供方，用于后端各种 AI 功能（分类、代码重写等）。当前只实现 `dashscope`。 | 否 | `dashscope` |
| `PLATFORM_AI_MODEL` | 平台侧 AI 模型名称，比如 `qwen3-max`。被 `AIService` 用作分类/重写模型。 | 否 | `qwen3-max` |
| `PLATFORM_AI_BASE_URL` | 平台 AI 的兼容接口地址。默认指向 DashScope 的兼容模式。 | 否 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_API_KEY` | 平台后台使用的 DashScope API key（**不是用户自己的 key**），用于：项目分类 + 代码安全重写等。 | 推荐（若为空则 AI 相关功能降级为 no-op） | 无 |
| `DASHSCOPE_APIKEY` | `DASHSCOPE_API_KEY` 的旧名字，保留兼容。只需设置其中一个即可。 | 否 | 无 |
| `DEPLOY_TARGET` | 部署目标：<br/>- `local`：静态资源拷贝到本机 `/apps/<slug>/` 并由 Node 直出<br/>- `cloudflare`：走 Cloudflare Pages 部署<br/>- `r2`：在阿里云构建，静态资源上传到 Cloudflare R2，再由 Worker 网关提供访问 | 否 | `local` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID。<br/>用于：Pages API 部署（`DEPLOY_TARGET=cloudflare`）、R2 账户 ID 的兜底，以及 D1 数据库的账户 ID（当 `STORAGE_TYPE=d1` 时）。 | 当 `DEPLOY_TARGET` 为 `cloudflare` 或 `r2`，或 `STORAGE_TYPE=d1` 时推荐配置 | 空字符串 |
| `CLOUDFLARE_PAGES_API_TOKEN` | Cloudflare Pages API Token，仅在 `DEPLOY_TARGET=cloudflare` 时用于 Pages API（以及 WRANGLER 兼容流程）。需要具备 Pages 权限。 | 同上 | 空字符串 |
| `CLOUDFLARE_PAGES_PROJECT_PREFIX` | Cloudflare Pages 项目名前缀，最终项目名为 `<prefix>-<slug>`。 | 否 | `deploy-your-app` |
| `R2_ACCOUNT_ID` | Cloudflare R2 账户 ID，多数情况下与 `CLOUDFLARE_ACCOUNT_ID` 相同；如果不设，会回退到 `CLOUDFLARE_ACCOUNT_ID`。 | 当 `DEPLOY_TARGET = r2` 时必填 | 若不设，使用 `CLOUDFLARE_ACCOUNT_ID`，否则报错 |
| `R2_ACCESS_KEY_ID` | R2 的 S3 兼容 Access Key ID，用于后端上传构建产物到 R2。 | 当 `DEPLOY_TARGET = r2` 时必填 | 空字符串（会导致运行时报错） |
| `R2_SECRET_ACCESS_KEY` | R2 的 S3 兼容 Secret Access Key。 | 当 `DEPLOY_TARGET = r2` 时必填 | 空字符串（会导致运行时报错） |
| `R2_BUCKET_NAME` | R2 中用于存放所有构建产物的 bucket 名（例如 `gemigo-apps`）。 | 当 `DEPLOY_TARGET = r2` 时必填 | 空字符串（会导致运行时报错） |
| `APPS_ROOT_DOMAIN` | 用户应用暴露的根域名，例如 `gemigo.app`。<br/>- `local`：主要用于生成 URL，方便预览<br/>- `r2`：必须与 Cloudflare Worker / DNS 上的域名一致（`*.APPS_ROOT_DOMAIN` 走 Worker） | 否（本地可用默认值） | `example.com` |
| `DATA_DIR` | 后端数据目录的根路径，内部会自动创建 `builds/`、`apps/`、`projects.json`。用于持久化构建缓存和项目列表。 | 否 | `data`（相对于仓库根目录） |
| `STORAGE_TYPE` | 应用数据存储后端类型（用于项目、用户等数据）：<br/>- `file`：使用本地 JSON 文件存储（`data/projects.json` 等）<br/>- `d1`：使用 Cloudflare D1 数据库存储<br/>如果未设置，默认使用 `d1`。 | 否 | `d1` |
| `CLOUDFLARE_D1_DATABASE_ID` | Cloudflare D1 数据库的数据库 ID，用于应用数据存储（项目、用户等）。当 `STORAGE_TYPE=d1` 时必需。 | 否 | 空 |
| `CLOUDFLARE_D1_API_TOKEN` | Cloudflare D1 API Token，用于访问 D1 数据库。需要具备 D1 数据库的读写权限。当 `STORAGE_TYPE=d1` 时必需。 | 否 | 空 |

> 开发建议：在 `server/.env` 中拷贝一次样例（当前 repo 已有一份），把其中的 DashScope key 和 R2/Cloudflare 部分替换成你自己的即可。

### 1.2 前端（Vite）

前端使用 Vite 的 `loadEnv`，从 `frontend/.env` 等文件中读取环境变量，并通过 `define` 注入到打包结果中。

| 变量名 | 作用 | 是否必填 | 说明 |
|--------|------|----------|------|
| `GEMINI_API_KEY` | 前端 Demo 使用的 Gemini API key，用于调用 Gemini SDK（例如代码重写、安全检查等功能）。通过 Vite 注入到 `process.env.API_KEY` / `process.env.GEMINI_API_KEY`。 | 视你是否开启前端 AI 功能而定 | 本项目是演示性质，生产环境通常不会在浏览器里直接暴露真实 key。建议仅用于本地开发或 Demo。 |

> 位置：`frontend/.env`（或 `.env.local` 等），格式示例：  
> `GEMINI_API_KEY=your_gemini_key_here`

---

## 二、生产部署（GitHub Actions + 阿里云 Docker）

### 2.1 GitHub Actions – 服务器连接（SSH）

workflow 文件：`.github/workflows/deploy.yml`  
在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置。

**Secrets（SSH / 主机信息）：**

| 名称 | 用途 | 示例 |
|------|------|------|
| `ALIYUN_HOST` | 轻量服务器 IP 地址 | `123.45.67.89` |
| `ALIYUN_USER` | SSH 用户名 | `root` / `ubuntu` |
| `ALIYUN_SSH_KEY` | 部署用 SSH 私钥内容（OpenSSH 格式） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `ALIYUN_PORT` | SSH 端口，可选 | `22` |

这些只用于 GitHub Actions 连接、上传镜像及执行 `scripts/deploy.sh`，不会进入容器内。

### 2.2 GitHub Actions – 应用运行所需的配置

在 `deploy.yml` 中，这些变量通过 `envs:` 和 `env:` 被传入远程脚本，再传给 Docker 容器。你需要在 GitHub 仓库中配置：

#### 2.2.1 Secrets（敏感信息）

| 名称 | 对应后端变量 | 用途 |
|------|--------------|------|
| `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID，用于 Pages / R2 / D1 |
| `CLOUDFLARE_PAGES_API_TOKEN` | `CLOUDFLARE_PAGES_API_TOKEN` | Cloudflare Pages API Token（必须具备 Pages 权限） |
| `DASHSCOPE_API_KEY` | `DASHSCOPE_API_KEY` | 平台 DashScope key，后端 AI（分类、代码重写）使用 |
| `R2_ACCOUNT_ID` | `R2_ACCOUNT_ID` | R2 账号 ID（可与 Cloudflare 账号相同） |
| `R2_ACCESS_KEY_ID` | `R2_ACCESS_KEY_ID` | R2 S3 Access Key |
| `R2_SECRET_ACCESS_KEY` | `R2_SECRET_ACCESS_KEY` | R2 S3 Secret Key |
| `R2_BUCKET_NAME` | `R2_BUCKET_NAME` | R2 Bucket 名，需与 Cloudflare 控制台中创建的名字一致 |
| `CLOUDFLARE_D1_DATABASE_ID` | `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID，用于应用数据存储（当 `STORAGE_TYPE=d1` 时） |
| `CLOUDFLARE_D1_API_TOKEN` | `CLOUDFLARE_D1_API_TOKEN` | D1 API Token，需要具备 D1 数据库读写权限（当 `STORAGE_TYPE=d1` 时） |

> 这些值会被 `scripts/deploy.sh` 传给容器，容器内再由 `server/config.ts` 读取。

#### 2.2.2 Variables（非敏感配置）

| 名称 | 对应后端变量 | 用途 / 默认 |
|------|--------------|------------|
| `DEPLOY_TARGET` | `DEPLOY_TARGET` | 部署目标：`local` / `cloudflare` / `r2`。推荐生产用 `r2`。 |
| `STORAGE_TYPE` | `STORAGE_TYPE` | 存储后端类型：`file` / `d1`。如果未设置，系统会自动检测。 |
| `CLOUDFLARE_PAGES_PROJECT_PREFIX` | `CLOUDFLARE_PAGES_PROJECT_PREFIX` | Pages 项目前缀，不使用 Pages 时可以忽略。 |
| `APPS_ROOT_DOMAIN` | `APPS_ROOT_DOMAIN` | 用户访问的根域名，例如 `gemigo.app`，需要与 Cloudflare DNS / Worker 保持一致。 |
| （可选）`PORT` | 宿主机 HTTP 端口 | 在 `scripts/deploy.sh` 中作为 `HOST_PORT` 使用，默认 `80`。改成 `8080` 等可避免端口占用。 |

这些变量在 workflow 里通过：

```yaml
envs: CLOUDFLARE_ACCOUNT_ID, ... , APPS_ROOT_DOMAIN
env:
  DEPLOY_TARGET: ${{ vars.DEPLOY_TARGET }}
  ...
```

传入远程脚本，最终进入 Docker 容器的环境。

### 2.3 阿里云服务器上的环境变量

大部分配置已通过 GitHub Actions → `deploy.sh` 注入容器，一般不需要再在服务器上单独写 `.env`。  
仅在以下情况下可能需要本地设置环境变量：

- 想临时修改对外端口，而不改 GitHub Variables 时，可以在执行 `deploy.sh` 前设置 `PORT`：

```bash
export PORT=8080
/tmp/deploy-your-app/scripts/deploy.sh /tmp/deploy-your-app/deploy-image.tar.gz
```

---

## 三、Cloudflare 配置

### 3.1 R2 Bucket + Worker 网关

目录：`workers/r2-gateway`

#### 3.1.1 Worker 环境（`wrangler.toml`）

```toml
[vars]
APPS_ROOT_DOMAIN = "gemigo.app"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "gemigo-apps"
```

| 字段 | 位置 | 说明 |
|------|------|------|
| `APPS_ROOT_DOMAIN` | Worker 环境变量 | 必须与后端的 `APPS_ROOT_DOMAIN` 一致，例如 `gemigo.app`。Worker 根据这个域名解析 `<slug>.gemigo.app`。 |
| `ASSETS`（binding） | R2 绑定名称 | 在 wrangler / Cloudflare Dashboard 里把 R2 bucket 绑定到这个名称。`bucket_name` 要与 `R2_BUCKET_NAME` 相同（例如 `gemigo-apps`）。 |

> 后端在 `DEPLOY_TARGET = r2` 时，会把构建产物上传到 R2 的 `apps/<slug>/current/...` 路径；Worker 则根据子域名读取对应前缀并回源。

#### 3.1.2 Cloudflare 账号 / R2 凭证

这些不是 Worker 本身的变量，而是后端部署时用到的，已经在上一节 **GitHub Secrets** 中列出：

- `CLOUDFLARE_ACCOUNT_ID`（用于 Pages / R2 / D1）
- `CLOUDFLARE_PAGES_API_TOKEN`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `CLOUDFLARE_D1_DATABASE_ID`（当使用 D1 存储时）
- `CLOUDFLARE_D1_API_TOKEN`（当使用 D1 存储时）

### 3.2 Cloudflare Pages（可选）

如果你选择 `DEPLOY_TARGET=cloudflare` 跑旧的 Pages 流程，还需要：

| 变量 | 作用 |
|------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Pages 所在账号 ID |
| `CLOUDFLARE_PAGES_API_TOKEN` | 具备 Pages 权限、供部署脚本调用 Cloudflare Pages API 的 Token |
| `CLOUDFLARE_PAGES_PROJECT_PREFIX` | Pages 项目前缀。服务端会生成 `<prefix>-<slug>` 的项目名并通过 API 创建 / 部署。 |

目前推荐的新路径是 `DEPLOY_TARGET=r2` + Worker 网关，上述 Pages 变量主要用于兼容旧流程。

### 3.3 API Worker（/api/v1/*）

目录：`workers/api`

该 Worker 负责：

- 直接读写 D1（`/api/v1/projects` CRUD）
- 代理部署相关接口（`/api/v1/deploy`、`/api/v1/deployments/:id/stream`），再由 Node 服务执行真实构建

`wrangler.toml` 里需要注意的字段：

| 字段 | 说明 |
|------|------|
| `PROJECTS_DB`（D1 binding） | 绑定到 D1 中的 `projects` 数据库，供 Worker 直接 CRUD。`database_id` / `preview_database_id` 指向对应实例。 |
| `APPS_ROOT_DOMAIN`、`DEPLOY_TARGET`、`PLATFORM_AI_*`、`AUTH_REDIRECT_BASE` | 与后端保持一致，用于 Worker 自身返回 URL、构造 OAuth 回调地址以及调用 DashScope。`AUTH_REDIRECT_BASE` 通常为 `https://gemigo.io`。 |
| `DEPLOY_SERVICE_BASE_URL` | Worker 内部访问 Node 部署服务的地址，形如 `https://<你的服务器>/api/v1`。本地 `wrangler dev` 会回退到 `http://127.0.0.1:4173/api/v1`。**线上必须在 `workers/api/wrangler.toml` 的 `[vars]` 或 Cloudflare Dashboard → Worker → Settings → Variables/Secrets 中设置为真实 Node API**（例如 `https://backend.gemigo.io/api/v1`），否则部署相关接口会找不到目标。 |
| `PASSWORD_SALT`、`GOOGLE_CLIENT_ID/SECRET`、`GITHUB_CLIENT_ID/SECRET` | 供 API Worker 的用户体系使用：邮箱密码哈希与 Google / GitHub OAuth。**建议在 Cloudflare Dashboard 中作为 Secrets 配置**，本地开发时则放在 `workers/api/.dev.vars`。详细步骤见 `docs/AUTH_SETUP.md`。 |
| `ADMIN_EMAILS`（可选） | 管理员邮箱白名单（逗号分隔，不区分大小写）。用于访问 `/api/v1/admin/*` 相关接口与后台页面。示例：`admin@example.com,ops@example.com`。 |
| `ADMIN_USER_IDS`（可选） | 管理员 user id 白名单（逗号分隔）。示例：`uuid-1,uuid-2`。 |

前端在 `.env` 里配置 `VITE_API_BASE_URL=https://<worker-domain>/api/v1` 后，即可完全通过 Worker 访问后端，Node 服务只作为内部部署引擎。

---

## 四、小结 / 快速检查清单

**本地开发最少需要：**

- `server/.env` 中：`DASHSCOPE_API_KEY`（如果你要用后端 AI 能力），`DEPLOY_TARGET` 一般为 `local`。
- `frontend/.env` 中：`GEMINI_API_KEY`（如果你要演示前端直接调用 Gemini）。

**生产部署（R2 模式）推荐配置：**

- GitHub Secrets：`ALIYUN_*` 系列、`DASHSCOPE_API_KEY`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_PAGES_API_TOKEN`、`R2_*` 全套。如果使用 D1 存储，还需添加 `CLOUDFLARE_D1_DATABASE_ID` 和 `CLOUDFLARE_D1_API_TOKEN`。
- GitHub Variables：`DEPLOY_TARGET=r2`、`STORAGE_TYPE`（如 `d1` 或 `file`，可选）、`APPS_ROOT_DOMAIN`（如 `gemigo.app`）、`CLOUDFLARE_PAGES_PROJECT_PREFIX`（可保留默认）。
- Cloudflare：创建名为 `R2_BUCKET_NAME` 的 R2 bucket；在 Worker `wrangler.toml` 中配置相同的 `bucket_name` 和匹配的 `APPS_ROOT_DOMAIN`；DNS 中为 `*.APPS_ROOT_DOMAIN` 配置到该 Worker。如果使用 D1 存储，需要在 Cloudflare 控制台创建 D1 数据库。
- API Worker（部署 & 项目）：在 Cloudflare Worker（`gemigo-api`）中配置：
  - `DEPLOY_SERVICE_BASE_URL`：指向阿里云 Node API（例如 `https://<你的服务器>/api/v1`），可在 `workers/api/wrangler.toml` 的 `[vars]` 中设置，或在 Dashboard → Workers → Variables/Secrets 中配置同名变量。
  - `APPS_ROOT_DOMAIN`、`DEPLOY_TARGET`、`PLATFORM_AI_*`、`AUTH_REDIRECT_BASE`：与后端保持一致，一般通过 `wrangler.toml` 的 `[vars]` 配置。
- API Worker（用户体系）：在 `gemigo-api` Worker 的 Variables/Secrets 中配置 `PASSWORD_SALT`、`GOOGLE_CLIENT_ID/SECRET`、`GITHUB_CLIENT_ID/SECRET` 等敏感字段，具体见 `docs/AUTH_SETUP.md`。没有这些变量，邮箱/Google/GitHub 登录会拒绝或降级。

这样，你在本地和生产环境就都可以用同一份环境变量说明来对照和排查了。  
