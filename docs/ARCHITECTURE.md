# 架构设计

## 总览

Beta 采用前后端分离：

- `web/`：Next.js + TypeScript + Tailwind CSS，面向普通主播的中文操作界面。
- `api/`：FastAPI + Python，提供认证、主播档案、上传、识别、复盘报告、模型配置等 API。
- PostgreSQL：正式数据存储。
- Redis + Celery：异步分析任务队列。
- S3 兼容存储：截图、录音、录像和导出短视频。
- FFmpeg：Phase 2/5 用于音频提取和高光切片。

Phase 1 为了本地快速闭环，后端支持 SQLite 开发模式；生产通过 `DATABASE_URL` 切换 PostgreSQL。

## 模块

### 前端模块

- 登录注册：邀请码注册、登录、会话保存。
- 首页：下一步动作、最近复盘、本周成长任务。
- 主播档案：创建主播、维护方向和直播形式。
- 直播复盘上传：上传截图、补充资料入口。
- 数据确认：展示 AI 识别的关键指标并允许修改。
- 直播报告：一句话总结、三个问题、优势、下一场动作。
- 实时助手：Beta 静态提词和快捷救场入口。
- 我的设置与模型设置：简单模式和高级模型配置。

### 后端模块

- `auth`：邀请码注册、登录、简单 Bearer Token。
- `streamers`：主播档案。
- `model_settings`：模型配置、脱敏展示、测试连接、删除。
- `uploads`：本地/S3 文件适配层。
- `analysis_jobs`：异步任务状态。
- `ai_gateway`：统一模型适配层，支持 Mock、OpenAI 兼容 API 和后续多用途模型。
- `reports`：复盘报告生成、历史记录、下一场任务。
- `platform_accounts`：平台账号、用户成员关系、主播绑定、授权状态和同步能力预留。

## 数据模型

核心表：

- `users`
- `invite_codes`
- `streamers`
- `model_settings`
- `live_sessions`
- `uploaded_assets`
- `recognized_metrics`
- `analysis_jobs`
- `review_reports`
- `growth_tasks`
- `platform_accounts`
- `anchor_platform_accounts`
- `user_platform_accounts`
- `platform_authorizations`
- `platform_sync_jobs`
- `platform_data_snapshots`

## AI 适配层

所有 AI 调用统一从 `ai_gateway` 出口进入。Phase 1 提供：

- `MockVisionAnalyzer`：根据上传文件和用户确认字段生成带 `source: mock` 标识的识别结果。
- `MockReviewCoach`：根据确认指标生成三个核心问题、一个优势和三条行动。

后续真实模型实现必须保持相同接口，不让前端感知模型差异。

## 安全

- API Key 不返回明文。
- 日志不打印 API Key。
- 模型配置删除为软删除或直接清除密文。
- 平台自动操作只预留建议接口，不执行发评论、禁言、断麦、私信等动作。

## 状态约定

页面与 API 统一覆盖：

- 空状态；
- 加载状态；
- 成功状态；
- 错误状态；
- 重试入口。

## 本地运行

Phase 1 目标命令：

- API：`cd api && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Web：`cd web && npm install && npm run dev`
- 全量基础设施：`docker compose up -d postgres redis`
