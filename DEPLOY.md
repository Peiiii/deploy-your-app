# 部署指南

本文档说明如何通过 GitHub Actions 自动部署到阿里云轻量应用服务器。

## 前置要求

### 1. 服务器准备

在阿里云轻量应用服务器上安装 Docker：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证安装
docker --version
```

### 2. 创建 SSH 密钥对

在本地生成 SSH 密钥对（如果还没有）：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/aliyun_deploy
```

将公钥添加到服务器的 `~/.ssh/authorized_keys`：

```bash
# 在本地执行
ssh-copy-id -i ~/.ssh/aliyun_deploy.pub user@your-server-ip
```

或者手动添加：

```bash
# 在服务器上执行
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "你的公钥内容" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

1. 进入仓库：`Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret` 添加以下密钥：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `ALIYUN_HOST` | 服务器 IP 地址 | `123.456.789.0` |
| `ALIYUN_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `ALIYUN_SSH_KEY` | SSH 私钥内容 | 复制 `~/.ssh/aliyun_deploy` 的完整内容 |
| `ALIYUN_PORT` | SSH 端口（可选，默认 22） | `22` |

**获取 SSH 私钥内容：**

```bash
cat ~/.ssh/aliyun_deploy
```

复制输出的完整内容（包括 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）到 GitHub Secrets。

## 部署流程

### 自动部署

当代码推送到 `main` 或 `master` 分支时，GitHub Actions 会自动：

1. 构建 Docker 镜像
2. 将镜像和部署脚本上传到服务器
3. 在服务器上执行部署脚本
4. 重启容器

### 手动触发

也可以在 GitHub Actions 页面手动触发部署：

1. 进入 `Actions` 标签页
2. 选择 `Deploy to Aliyun Server` workflow
3. 点击 `Run workflow`

## 确认部署成功

### 方法 1: 查看 GitHub Actions 日志

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 点击最新的工作流运行
3. 查看 "Execute deployment script" 步骤的日志
4. 如果看到 `✅ Deployment completed successfully!` 表示部署成功

### 方法 2: 在服务器上运行检查脚本

```bash
# 上传检查脚本到服务器（如果还没有）
# 或者直接在服务器上运行检查命令

# 检查容器状态
docker ps --filter "name=deploy-your-app"

# 查看日志
docker logs --tail 50 deploy-your-app

# 测试 API
curl http://localhost/api/v1/projects
```

### 方法 3: 从外部测试 API

```bash
# 替换为你的服务器 IP
curl http://<你的服务器IP>/api/v1/projects

# 应该返回项目列表的 JSON 数据
```

### 方法 4: 使用检查脚本（推荐）

如果检查脚本已上传到服务器：

```bash
chmod +x /tmp/deploy-your-app/scripts/check-deployment.sh
/tmp/deploy-your-app/scripts/check-deployment.sh
```

## 服务器端管理

### 查看容器状态

```bash
docker ps --filter "name=deploy-your-app"
```

### 查看日志

```bash
docker logs -f deploy-your-app
```

### 重启服务

```bash
docker restart deploy-your-app
```

### 停止服务

```bash
docker stop deploy-your-app
```

### 使用 Docker Compose（可选）

如果服务器上安装了 `docker-compose`，可以使用：

```bash
cd /opt/deploy-your-app
docker-compose up -d
docker-compose logs -f
```

## 环境变量配置

### 在 GitHub 中配置环境变量

**重要：** 敏感信息（API tokens、密钥）应该配置在 **Secrets** 中，非敏感配置可以放在 **Variables** 中。

#### 需要配置的 Secrets（敏感信息）

在 GitHub 仓库中，进入 **Settings** → **Secrets and variables** → **Actions** → **Secrets**，添加：

1. **CLOUDFLARE_ACCOUNT_ID** - Cloudflare 账户 ID（虽然不算特别敏感，但建议放在 Secrets）
2. **CLOUDFLARE_API_TOKEN** - Cloudflare API Token（**敏感**，必须放在 Secrets）
3. **DASHSCOPE_API_KEY** - DashScope API Key（**敏感**，必须放在 Secrets）

#### 需要配置的 Variables（非敏感配置，可选）

在 **Settings** → **Secrets and variables** → **Actions** → **Variables**，可以添加：

1. **DEPLOY_TARGET** - 部署目标（可选，如果不设置，代码默认使用 `local`，可选值：`local` 或 `cloudflare`）
2. **CLOUDFLARE_PAGES_PROJECT_PREFIX** - Cloudflare Pages 项目名称前缀（可选，如果不设置，代码默认使用 `deploy-your-app`）

**注意：** 这些 Variables 是可选的。如果不设置，代码会使用内置的默认值。只有在需要覆盖默认值时才需要配置。

#### 如何添加

**添加 Secrets：**
1. 进入 GitHub 仓库页面
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **Secrets** 标签页
4. 点击 **New repository secret**
5. 输入 Name 和 Value，点击 **Add secret**

**添加 Variables：**
1. 在同一个页面，点击 **Variables** 标签页
2. 点击 **New repository variable**
3. 输入 Name 和 Value，点击 **Add variable**

**区别：**
- **Secrets**：加密存储，在日志中会被隐藏，用于敏感信息
- **Variables**：明文存储，在日志中可见，用于非敏感配置

#### 工作原理

- GitHub Actions 工作流会自动从 Secrets 中读取这些值
- 通过 SSH 传递到阿里云服务器
- 部署脚本将这些环境变量传递给 Docker 容器
- 容器内的应用代码从环境变量中读取配置

### 在服务器上配置环境变量（不推荐用于敏感信息）

如果你需要在服务器上直接配置非敏感的环境变量，可以在部署脚本执行前设置：

```bash
# 这些环境变量会在部署时传递给 Docker 容器
export PORT=80
export DATA_DIR=/opt/deploy-your-app/data
```

**注意：** 不要在服务器上创建包含敏感信息的 `.env` 文件，因为这些文件可能会被意外提交到代码仓库。

## 数据持久化

数据目录挂载在 `/opt/deploy-your-app/data`，包含：

- `data/apps/` - 部署的静态应用
- `data/builds/` - 构建缓存
- `data/projects.json` - 项目数据

**重要：** 定期备份 `data` 目录！

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/deploy-your-app/data
```

## 故障排查

### 容器无法启动

1. 检查日志：
   ```bash
   docker logs deploy-your-app
   ```

2. 检查端口占用：
   ```bash
   netstat -tulpn | grep 80
   ```

3. 检查数据目录权限：
   ```bash
   ls -la /opt/deploy-your-app/data
   ```

### SSH 连接失败

1. 检查服务器防火墙设置
2. 确认 SSH 密钥权限正确
3. 测试 SSH 连接：
   ```bash
   ssh -i ~/.ssh/aliyun_deploy user@your-server-ip
   ```

### 部署失败

1. 查看 GitHub Actions 日志
2. 检查服务器磁盘空间：
   ```bash
   df -h
   ```
3. 检查 Docker 状态：
   ```bash
   docker info
   ```

## 安全建议

1. **使用非 root 用户**：创建专用用户用于部署
2. **限制 SSH 访问**：配置防火墙只允许特定 IP
3. **定期更新**：保持系统和 Docker 更新
4. **备份数据**：定期备份 `data` 目录
5. **监控日志**：设置日志监控和告警

## 更新部署脚本

如果需要修改部署流程，编辑以下文件：

- `.github/workflows/deploy.yml` - GitHub Actions 工作流
- `scripts/deploy.sh` - 服务器端部署脚本

修改后提交到仓库，下次部署时会自动使用新脚本。

