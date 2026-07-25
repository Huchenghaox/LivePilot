# Cloudflare 原生 Worker 迁移记录

当前迁移策略：先新增一个独立 API Worker，用 D1 和 R2 验证 Cloudflare 原生数据与文件能力；现有 Next.js 前端和 FastAPI 主业务暂不删除。

## Worker 形态

- Worker 数量：单 Worker。
- Worker 项目名称：`livepilot-api`。
- Worker 目录：`workers/api`。
- Wrangler 配置：`workers/api/wrangler.jsonc`。
- D1 Binding：`DB`。
- R2 Binding：`UPLOADS`。
- R2 公开访问：关闭。
- 永久公共 URL：不生成。

## 已配置资源

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-d1-database-name",
      "database_id": "your-d1-database-id"
    }
  ],
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "your-private-r2-bucket"
    }
  ]
}
```

## 本地命令

```bash
cd workers/api
npm ci
npm run build
npm run d1:migrate:local
npm run dev
```

重复执行本地迁移应显示：

```text
No migrations to apply
```

远程 D1 迁移命令：

```bash
cd workers/api
npx wrangler d1 migrations apply livepilot-production --remote
```

部署命令：

```bash
cd workers/api
npx wrangler deploy
```

本地预览：

```bash
cd workers/api
npm run dev
```

## GitHub / Cloudflare Worker 构建配置

- Root directory：`workers/api`
- Build command：`npm ci && npm run build`
- Deploy command：`npx wrangler deploy`
- Node.js：`22`

Wrangler 配置已经声明 D1 和 R2 bindings。使用 `wrangler deploy` 时不需要在 Cloudflare 后台重复手动添加 Binding；如果改用后台手工创建 Worker，请确认后台 Binding 名称仍为 `DB` 和 `UPLOADS`。

## 当前已迁移接口

- `GET /health`
- `GET /ready`
- `POST /api/dev/session`，仅 development 可用，用于本地生成测试会话。
- `POST /api/uploads`
- `GET /api/uploads/:id`
- `DELETE /api/uploads/:id`

上传文件全部写入私有 R2 对象。读取和删除时先通过 Bearer token 找到当前用户，再按 `uploaded_assets.user_id` 校验归属。其他用户访问同一文件 ID 返回 404。

## 当前尚未迁移的核心接口

- 手机号验证码注册、用户名密码登录、找回密码；
- 主播档案；
- 平台账号；
- 模型设置；
- 开播准备生成；
- 直播复盘创建、数据确认；
- 报告生成和报告版本；
- 规则中心；
- 反馈；
- Dashboard；
- FastAPI 的完整权限模型和 AI 模型调用。

这些接口仍由 FastAPI 版本承担。后续迁移时应按业务闭环逐步迁移，不要一次性替换整个后端。
