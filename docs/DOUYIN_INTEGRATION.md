# 抖音开放平台接入说明

## 当前结论

当前 Beta 已支持手动记录抖音账号，并将平台账号绑定到主播档案和直播复盘。

当前尚未接入真实抖音官方 OAuth 和直播数据同步。系统不会使用 Cookie、账号密码、网页爬虫、模拟登录、逆向 App 接口或未经授权的第三方接口。

## 官方接入准备

1. 注册抖音开放平台账号。
2. 创建网站应用或符合业务场景的应用。
3. 配置 OAuth 授权回调地址。
4. 获取 `Client Key` 和 `Client Secret`。
5. 在后端环境变量中配置：
   - `DOUYIN_CLIENT_KEY`
   - `DOUYIN_CLIENT_SECRET`
   - `DOUYIN_REDIRECT_URI`
6. 根据业务场景申请必要 Scope。
7. 准备隐私政策和用户协议。
8. 明确用户数据删除和授权撤销机制。

## OAuth 流程预留

未来授权流程：

1. 用户点击“连接抖音账号”。
2. 后端生成授权地址和 `state`。
3. 用户跳转抖音官方授权页面。
4. 用户确认授权。
5. 抖音回调系统。
6. 后端验证 `state`，防止 CSRF。
7. 后端用 `code` 换取 Token。
8. 后端获取账号基础资料。
9. 创建或关联 `PlatformAccount`。
10. 前端显示授权范围和到期时间。

Access Token 和 Refresh Token 必须加密保存，不返回前端，不写入日志。

## 能力分级

不要假设完成 OAuth 后就能获取全部直播复盘数据。系统需要按账号保存能力状态：

- 基础资料可读取；
- 粉丝数据可读取；
- 作品数据可读取；
- 广告投放数据可读取；
- 直播数据可读取；
- 电商直播数据可读取；
- 暂不支持。

页面文案应准确表达：

- “已连接，可同步基础账号数据”；
- “已连接，但当前未获得直播数据权限”；
- “账号记录可用，官方授权待配置”。

不得显示“已连接，可自动同步全部数据”，除非官方权限已经真实验证。

## 预留同步类型

当前同步接口在没有官方权限时返回 `unsupported`，不会伪造数据。

预留数据类型：

- `account_profile`
- `follower_summary`
- `follower_daily`
- `content_summary`
- `video_metrics`
- `live_session_summary`
- `live_session_metrics`
- `traffic_source`
- `audience_profile`
- `ecommerce_metrics`
- `ad_metrics`
- `violation_notice`

## 安全边界

严格禁止：

- 保存抖音账号密码；
- 保存用户 Cookie；
- 抓取抖音创作者中心私有接口；
- 模拟登录；
- 逆向 App 接口；
- 使用未经授权的第三方数据接口；
- 将 Access Token 返回前端；
- 在日志中打印 Token；
- 在 Git 中保存 Client Secret。

必须支持：

- Token 加密存储；
- 授权撤销；
- 数据删除；
- 最小权限；
- 授权记录；
- 用户查看已授权范围。

## 尚未确认能力

当前账号基础授权和部分用户数据存在官方开放能力。

每场直播完整复盘指标是否可获取，需要根据应用类型、业务场景、资质和实际审批权限确认。
