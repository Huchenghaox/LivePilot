from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    phone_normalized: Mapped[str] = mapped_column(String(32), unique=True, nullable=True, index=True)
    phone_verified_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=True, index=True)
    username_normalized: Mapped[str] = mapped_column(String(32), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    nickname: Mapped[str] = mapped_column(String(80), default="")
    email: Mapped[str] = mapped_column(String(160), default="")
    email_verified_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="active")
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deletion_requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    deletion_reason: Mapped[str] = mapped_column(Text, default="")
    default_streamer_id: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SmsVerificationCode(Base):
    __tablename__ = "sms_verification_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone_normalized: Mapped[str] = mapped_column(String(32), index=True)
    phone_hash: Mapped[str] = mapped_column(String(80), index=True)
    purpose: Mapped[str] = mapped_column(String(40), index=True)
    code_hash: Mapped[str] = mapped_column(String(120))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    request_ip: Mapped[str] = mapped_column(String(80), default="")
    provider_message_id: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    max_uses: Mapped[int] = mapped_column(Integer, default=1)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class Streamer(Base):
    __tablename__ = "streamers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    direction: Mapped[str] = mapped_column(String(40))
    live_forms: Mapped[str] = mapped_column(Text, default="[]")
    average_online_range: Mapped[str] = mapped_column(String(40), default="")
    usual_live_time: Mapped[str] = mapped_column(String(80), default="")
    improvement_goal: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelSetting(Base):
    __tablename__ = "model_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80), default="默认模型")
    mode: Mapped[str] = mapped_column(String(20), default="platform")
    api_base: Mapped[str] = mapped_column(String(255), default="")
    api_key_encrypted: Mapped[str] = mapped_column(Text, default="")
    model_name: Mapped[str] = mapped_column(String(120), default="")
    purpose: Mapped[str] = mapped_column(String(40), default="文字分析")
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=60)
    max_retries: Mapped[int] = mapped_column(Integer, default=1)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    test_status: Mapped[str] = mapped_column(String(40), default="未测试")
    last_tested_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlatformAccount(Base):
    __tablename__ = "platform_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(30), default="douyin", index=True)
    platform_user_id: Mapped[str] = mapped_column(String(120), default="", index=True)
    platform_open_id: Mapped[str] = mapped_column(String(160), default="", index=True)
    union_id: Mapped[str] = mapped_column(String(160), default="", index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    account_handle: Mapped[str] = mapped_column(String(120), default="", index=True)
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    account_type: Mapped[str] = mapped_column(String(40), default="个人账号")
    verification_status: Mapped[str] = mapped_column(String(40), default="未认证")
    connection_type: Mapped[str] = mapped_column(String(40), default="manual")
    connection_status: Mapped[str] = mapped_column(String(40), default="已手动记录")
    authorization_status: Mapped[str] = mapped_column(String(40), default="未授权")
    capability_status: Mapped[str] = mapped_column(Text, default="{}")
    follower_range: Mapped[str] = mapped_column(String(60), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    archived_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class AnchorPlatformAccount(Base):
    __tablename__ = "anchor_platform_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    anchor_id: Mapped[int] = mapped_column(ForeignKey("streamers.id"), index=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserPlatformAccount(Base):
    __tablename__ = "user_platform_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), index=True)
    role: Mapped[str] = mapped_column(String(30), default="owner")
    permission_scope: Mapped[str] = mapped_column(Text, default="review,report,rule")
    status: Mapped[str] = mapped_column(String(30), default="active")
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlatformAuthorization(Base):
    __tablename__ = "platform_authorizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), index=True)
    provider: Mapped[str] = mapped_column(String(40), default="douyin")
    encrypted_access_token: Mapped[str] = mapped_column(Text, default="")
    encrypted_refresh_token: Mapped[str] = mapped_column(Text, default="")
    token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    scopes: Mapped[str] = mapped_column(Text, default="[]")
    authorization_status: Mapped[str] = mapped_column(String(40), default="未授权")
    authorized_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlatformSyncJob(Base):
    __tablename__ = "platform_sync_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), index=True)
    sync_type: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(30), default="waiting")
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str] = mapped_column(String(80), default="")
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PlatformDataSnapshot(Base):
    __tablename__ = "platform_data_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), index=True)
    data_type: Mapped[str] = mapped_column(String(80))
    snapshot_date: Mapped[str] = mapped_column(String(20), default="")
    raw_data: Mapped[str] = mapped_column(Text, default="{}")
    normalized_data: Mapped[str] = mapped_column(Text, default="{}")
    source: Mapped[str] = mapped_column(String(40), default="official_api")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    streamer_id: Mapped[int] = mapped_column(ForeignKey("streamers.id"), index=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), nullable=True, index=True)
    preparation_plan_id: Mapped[int] = mapped_column(ForeignKey("preparation_plans.id"), nullable=True, index=True)
    platform: Mapped[str] = mapped_column(String(30), default="douyin")
    data_source: Mapped[str] = mapped_column(String(40), default="manual_input")
    title: Mapped[str] = mapped_column(String(160), default="未命名直播")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    report_type: Mapped[str] = mapped_column(String(30), default="simple")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assets: Mapped[list["UploadedAsset"]] = relationship(cascade="all, delete-orphan")


class UploadedAsset(Base):
    __tablename__ = "uploaded_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30), default="screenshot")
    original_filename: Mapped[str] = mapped_column(String(255), default="")
    filename: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="uploaded")
    error_message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecognizedMetrics(Base):
    __tablename__ = "recognized_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), unique=True)
    metrics_json: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="mock")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScreenshotRecognition(Base):
    __tablename__ = "screenshot_recognitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    uploaded_asset_id: Mapped[int] = mapped_column(ForeignKey("uploaded_assets.id"), index=True)
    screenshot_type: Mapped[str] = mapped_column(String(40), default="无法识别")
    reason: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    is_manually_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    user_corrected_type: Mapped[str] = mapped_column(String(40), default="")
    source: Mapped[str] = mapped_column(String(30), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecognizedMetricField(Base):
    __tablename__ = "recognized_metric_fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    metric_key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(80))
    raw_value: Mapped[str] = mapped_column(String(120), default="")
    normalized_value: Mapped[str] = mapped_column(String(120), default="")
    unit: Mapped[str] = mapped_column(String(30), default="")
    uploaded_asset_id: Mapped[int] = mapped_column(ForeignKey("uploaded_assets.id"), index=True)
    source_screenshot_type: Mapped[str] = mapped_column(String(40), default="")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    is_manually_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    manual_value: Mapped[str] = mapped_column(String(120), default="")
    final_value: Mapped[str] = mapped_column(String(120), default="")
    unreadable_reason: Mapped[str] = mapped_column(Text, default="")
    has_conflict: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(30), default="mock")
    recognized_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelCallLog(Base):
    __tablename__ = "model_call_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), nullable=True)
    task_type: Mapped[str] = mapped_column(String(60))
    model_setting_id: Mapped[int] = mapped_column(ForeignKey("model_settings.id"), nullable=True)
    model_name: Mapped[str] = mapped_column(String(120), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    usage_json: Mapped[str] = mapped_column(Text, default="{}")
    error_type: Mapped[str] = mapped_column(String(80), default="")


class ReviewReport(Base):
    __tablename__ = "review_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), unique=True)
    report_json: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReviewReportVersion(Base):
    __tablename__ = "review_report_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_report_id: Mapped[int] = mapped_column(ForeignKey("review_reports.id"), index=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    report_type: Mapped[str] = mapped_column(String(30), default="simple")
    report_json: Mapped[str] = mapped_column(Text)
    metrics_snapshot: Mapped[str] = mapped_column(Text, default="{}")
    rule_snapshot: Mapped[str] = mapped_column(Text, default="[]")
    model_name: Mapped[str] = mapped_column(String(120), default="")
    source: Mapped[str] = mapped_column(String(30), default="mock")
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GrowthTask(Base):
    __tablename__ = "growth_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(30), default="未完成")
    remark: Mapped[str] = mapped_column(Text, default="")
    improvement: Mapped[str] = mapped_column(String(120), default="等待下一场验证")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    streamer_id: Mapped[int] = mapped_column(ForeignKey("streamers.id"), nullable=True, index=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), nullable=True, index=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), nullable=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("review_reports.id"), nullable=True)
    report_version_id: Mapped[int] = mapped_column(ForeignKey("review_report_versions.id"), nullable=True)
    model_name: Mapped[str] = mapped_column(String(120), default="")
    rule_snapshot_json: Mapped[str] = mapped_column(Text, default="[]")
    feedback_type: Mapped[str] = mapped_column(String(60))
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PreparationPlan(Base):
    __tablename__ = "preparation_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    streamer_id: Mapped[int] = mapped_column(ForeignKey("streamers.id"), index=True)
    platform_account_id: Mapped[int] = mapped_column(ForeignKey("platform_accounts.id"), nullable=True, index=True)
    topic: Mapped[str] = mapped_column(String(160))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    goal: Mapped[str] = mapped_column(String(60), default="")
    live_form: Mapped[str] = mapped_column(String(60), default="")
    has_cohost: Mapped[bool] = mapped_column(Boolean, default=False)
    has_ecommerce: Mapped[bool] = mapped_column(Boolean, default=False)
    special_notes: Mapped[str] = mapped_column(Text, default="")
    plan_json: Mapped[str] = mapped_column(Text)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    uploaded_asset_id: Mapped[int] = mapped_column(ForeignKey("uploaded_assets.id"), index=True)
    job_type: Mapped[str] = mapped_column(String(40), default="media_content_analysis")
    status: Mapped[str] = mapped_column(String(30), default="waiting")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(255), default="等待处理")
    error_message: Mapped[str] = mapped_column(Text, default="")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id"), index=True)
    uploaded_asset_id: Mapped[int] = mapped_column(ForeignKey("uploaded_assets.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    start_seconds: Mapped[int] = mapped_column(Integer)
    end_seconds: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="ready")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id"), index=True)
    audio_chunk_id: Mapped[int] = mapped_column(ForeignKey("audio_chunks.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    start_seconds: Mapped[int] = mapped_column(Integer)
    end_seconds: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    speaker: Mapped[str] = mapped_column(String(40), default="未知")
    confidence: Mapped[int] = mapped_column(Integer, default=80)
    source_file: Mapped[str] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(30), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ContentAnalysis(Base):
    __tablename__ = "content_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id"), unique=True)
    analysis_json: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SpeechRisk(Base):
    __tablename__ = "speech_risks"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_job_id: Mapped[int] = mapped_column(ForeignKey("analysis_jobs.id"), index=True)
    transcript_segment_id: Mapped[int] = mapped_column(ForeignKey("transcript_segments.id"), index=True)
    time_seconds: Mapped[int] = mapped_column(Integer)
    original_text: Mapped[str] = mapped_column(Text)
    risk_type: Mapped[str] = mapped_column(String(80))
    risk_level: Mapped[str] = mapped_column(String(40), default="建议修改")
    reason: Mapped[str] = mapped_column(Text)
    rewrite: Mapped[str] = mapped_column(Text)
    needs_human_review: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String(30), default="mock")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RuleEntry(Base):
    __tablename__ = "rule_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    raw_content: Mapped[str] = mapped_column(Text)
    rule_type: Mapped[str] = mapped_column(String(40), index=True)
    scope_type: Mapped[str] = mapped_column(String(40), default="全部主播")
    scope_value: Mapped[str] = mapped_column(String(120), default="")
    source_name: Mapped[str] = mapped_column(String(160), default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    published_at: Mapped[str] = mapped_column(String(30), default="")
    effective_at: Mapped[str] = mapped_column(String(30), default="")
    expires_at: Mapped[str] = mapped_column(String(30), default="")
    status: Mapped[str] = mapped_column(String(30), default="待确认", index=True)
    risk_level: Mapped[str] = mapped_column(String(30), default="中")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rule_entries.id"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    raw_content: Mapped[str] = mapped_column(Text)
    structured_content: Mapped[str] = mapped_column(Text, default="{}")
    change_reason: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RuleInterpretation(Base):
    __tablename__ = "rule_interpretations"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rule_entries.id"), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    applicable_users: Mapped[str] = mapped_column(Text, default="")
    risky_behaviors: Mapped[str] = mapped_column(Text, default="[]")
    recommended_actions: Mapped[str] = mapped_column(Text, default="[]")
    keywords: Mapped[str] = mapped_column(Text, default="[]")
    confidence: Mapped[int] = mapped_column(Integer, default=70)
    possible_conflicts: Mapped[str] = mapped_column(Text, default="[]")
    model_name: Mapped[str] = mapped_column(String(120), default="")
    confirmed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class ReportRuleReference(Base):
    __tablename__ = "report_rule_references"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("review_reports.id"), index=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rule_entries.id"), index=True)
    rule_version_id: Mapped[int] = mapped_column(ForeignKey("rule_versions.id"), index=True)
    reference_type: Mapped[str] = mapped_column(String(40), default="报告依据")
    reason_used: Mapped[str] = mapped_column(Text, default="")


class ReportTemporaryInstruction(Base):
    __tablename__ = "report_temporary_instructions"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_session_id: Mapped[int] = mapped_column(ForeignKey("live_sessions.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    save_as_anchor_rule: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
