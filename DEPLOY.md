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

在服务器上创建 `.env` 文件（可选）：

```bash
# /opt/deploy-your-app/.env
DATA_DIR=/opt/deploy-your-app/data
PORT=80
NODE_ENV=production
```

或者在 Docker Compose 中配置环境变量。

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

