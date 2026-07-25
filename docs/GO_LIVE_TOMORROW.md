# LivePilot 明天最短上线步骤

目标：先把真实可用版本跑在华为 Ubuntu 服务器上，再用 Cloudflare Tunnel 暴露 `livepilot.example.com` 和 `api.livepilot.example.com`。

本文件不要求修改 DNS，也不包含真实密钥。执行前请准备好 GitHub 访问权限、短信服务配置和模型服务配置。

## 1. 登录服务器并安装基础工具

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

安装 Docker 和 Compose 插件后确认：

```bash
docker --version
docker compose version
```

如果 `docker compose version` 不可用，先按 Docker 官方文档安装 Compose 插件，不要继续部署。

## 2. 拉取代码

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/Huchenghaox/LivePilot.git
cd LivePilot
```

后续更新：

```bash
git pull --ff-only
```

## 3. 创建生产配置

```bash
cp .env.example .env
nano .env
```

至少填写：

```bash
APP_ENV=production
JWT_SECRET=请填写32位以上随机字符串
REGISTRATION_MODE=invite
CORS_ORIGINS=https://livepilot.example.com,https://api.livepilot.example.com
NEXT_PUBLIC_API_BASE_URL=https://api.livepilot.example.com
DATABASE_URL=sqlite:////app/data/livepilot.db
UPLOAD_DIR=/app/uploads

SMS_ENABLED=true
SMS_PROVIDER=待接入的真实供应商
SMS_ACCESS_KEY_ID=真实值
SMS_ACCESS_KEY_SECRET=真实值
SMS_SIGN_NAME=真实短信签名
SMS_TEMPLATE_CODE=真实模板编号

PLATFORM_TEXT_API_BASE=真实模型网关
PLATFORM_TEXT_API_KEY=真实模型Key
PLATFORM_TEXT_MODEL=真实文本模型名
```

如果短信签名和模板还没审核通过，将 `REGISTRATION_MODE=closed`，先不要开放注册。

## 4. 生产预检

```bash
set -a
. ./.env
set +a
./scripts/preflight.sh
```

出现 `FAIL` 时先修配置，不要启动服务。

## 5. 首次构建和启动

```bash
./scripts/deploy-production.sh
```

该脚本会执行：

1. 读取 `.env`；
2. 生产配置预检；
3. `docker compose build`；
4. `docker compose up -d`；
5. 健康检查。

后端容器启动时会自动执行：

```bash
alembic upgrade head
```

## 6. 查看服务状态和日志

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

## 7. 健康检查

服务器本机：

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8000/ready
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/api/ready
curl -I http://127.0.0.1:3000
```

`/ready` 必须显示数据库、上传目录和迁移状态均正常。

## 8. Cloudflare Tunnel 路由

确认本机服务正常后，再配置 Tunnel：

- `livepilot.example.com` -> `http://127.0.0.1:3000`
- `api.livepilot.example.com` -> `http://127.0.0.1:8000`

不要同时保留冲突的旧 Tunnel 路由或 DNS 记录。

## 9. 真实验收

浏览器打开：

```text
https://livepilot.example.com
```

依次验收：

1. 手机号验证码注册；
2. 用户名密码登录；
3. 创建主播；
4. 添加平台账号；
5. 配置文本模型并测试连接；
6. 生成开播方案；
7. 保存方案；
8. 创建直播复盘；
9. 手动录入关键数据；
10. 生成报告；
11. 查看报告；
12. 从报告创建下一场开播方案。

## 10. 备份

备份 SQLite：

```bash
./scripts/backup-sqlite.sh /var/backups/livepilot
```

备份上传卷需按服务器实际 Docker volume 路径或额外挂载目录执行。

## 11. 回滚

如果新版本失败：

```bash
git log --oneline -5
git checkout <上一个可用提交>
docker compose build
docker compose up -d
docker compose logs -f api
```

如涉及数据库变更，先恢复备份，不要直接删除生产数据库。

## 12. 常见阻断

- 短信未配置：注册不会开放，不能伪装发送成功。
- 文本模型未配置：开播方案和报告生成不可用，但主播、账号、手动复盘录入仍可用。
- 视觉模型未配置：截图识别不可用，手动录入仍可用。
- `NEXT_PUBLIC_API_BASE_URL` 配错为 `http://api:8000`：浏览器无法访问，必须改为公网 API 地址。
