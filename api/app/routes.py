import json
import time
from datetime import datetime
from pathlib import Path
from secrets import token_urlsafe
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.ai_gateway import (
    ChatModelConfig,
    MockASRTranscriber,
    MockContentAnalyzer,
    MockReviewCoach,
    MockSpeechRiskAnalyzer,
    MockVisionAnalyzer,
    ModelAdapterError,
    OpenAICompatibleChatClient,
    OpenAICompatibleVisionAnalyzer,
    VisionModelConfig,
    flatten_metrics_for_confirm,
    manual_required_recognition,
    parse_json_response,
    request_openai_compatible_chat,
    run_rule_diagnostics,
)
from app.config import get_settings
from app.database import get_db
from app.deps import current_user
from app.media_processing import FFmpegProcessor, MediaProcessingError
from app.models import (
    AnalysisJob,
    AnchorPlatformAccount,
    AudioChunk,
    ContentAnalysis,
    GrowthTask,
    LiveSession,
    ModelCallLog,
    ModelSetting,
    PlatformAccount,
    PlatformAuthorization,
    PlatformDataSnapshot,
    PlatformSyncJob,
    PreparationPlan,
    RecognizedMetricField,
    RecognizedMetrics,
    ReportRuleReference,
    ReportTemporaryInstruction,
    ReviewReport,
    ReviewReportVersion,
    RuleEntry,
    RuleInterpretation,
    RuleVersion,
    ScreenshotRecognition,
    SpeechRisk,
    Streamer,
    TranscriptSegment,
    UploadedAsset,
    User,
    UserFeedback,
    UserPlatformAccount,
)
from app.platform_oauth import DouyinOAuthProvider
from app.schemas import (
    AccountDeletionRequest,
    AuthLogin,
    AuthRegister,
    FeedbackCreate,
    GrowthTaskUpdate,
    LiveSessionCreate,
    MetricsConfirm,
    ModelSettingIn,
    ModelSettingUpdate,
    PasswordChange,
    PlatformAccountCreate,
    PlatformAccountUpdate,
    PlatformMemberCreate,
    PlatformMemberUpdate,
    PreparePlanRequest,
    PreparePlanUpdate,
    RecognizedFieldsConfirm,
    ReportRequest,
    RuleConfirm,
    RuleCreate,
    RuleUpdate,
    ScreenshotOrderUpdate,
    StreamerCreate,
    StreamerUpdate,
)
from app.security import (
    create_token,
    decrypt_secret,
    encrypt_secret,
    hash_password,
    mask_secret,
    verify_password,
)
from app.storage import get_storage, safe_storage_filename

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"ok": True, "name": get_settings().app_name}


@router.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    checks = {
        "database": False,
        "upload_dir_writable": False,
    }
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False
    try:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        probe = upload_dir / ".ready-check"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        checks["upload_dir_writable"] = True
    except OSError:
        checks["upload_dir_writable"] = False
    return {"ok": all(checks.values()), "name": settings.app_name, "checks": checks}


@router.post("/auth/register")
def register(payload: AuthRegister, db: Session = Depends(get_db)) -> dict:
    if payload.invite_code != get_settings().invite_code:
        raise HTTPException(status_code=400, detail="邀请码无效")
    exists = db.scalar(select(User).where(User.phone == payload.phone))
    if exists:
        raise HTTPException(status_code=400, detail="手机号已注册")
    user = User(phone=payload.phone, name=payload.name, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user), "token_type": "bearer", "user": {"id": user.id, "name": user.name}}


@router.post("/auth/login")
def login(payload: AuthLogin, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.phone == payload.phone))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="手机号或密码不正确")
    if user.is_deleted:
        raise HTTPException(status_code=403, detail="账号已停用，请联系管理员处理。")
    return {"access_token": create_token(user), "token_type": "bearer", "user": {"id": user.id, "name": user.name}}


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "default_streamer_id": user.default_streamer_id,
        "deletion_requested_at": user.deletion_requested_at.isoformat() if user.deletion_requested_at else "",
    }


@router.post("/account/change-password")
def change_password(payload: PasswordChange, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(User, user.id)
    if not row or not verify_password(payload.old_password, row.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    row.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True, "message": "密码已修改，请下次使用新密码登录。"}


@router.get("/account/export")
def export_account_data(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    streamers = db.scalars(select(Streamer).where(Streamer.user_id == user.id)).all()
    sessions = db.scalars(select(LiveSession).where(LiveSession.user_id == user.id)).all()
    feedback = db.scalars(select(UserFeedback).where(UserFeedback.user_id == user.id)).all()
    return {
        "account": {"id": user.id, "name": user.name, "phone": user.phone, "created_at": user.created_at.isoformat()},
        "streamers": [serialize_streamer(row, db) for row in streamers],
        "live_sessions": [serialize_live_session_summary(row, db) for row in sessions],
        "feedback": [
            {"id": row.id, "feedback_type": row.feedback_type, "content": row.content, "created_at": row.created_at.isoformat()}
            for row in feedback
        ],
    }


@router.post("/account/deletion-request")
def request_account_deletion(
    payload: AccountDeletionRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(User, user.id)
    if not row:
        raise HTTPException(status_code=404, detail="账号不存在")
    row.deletion_requested_at = datetime.utcnow()
    row.deletion_reason = payload.reason
    db.commit()
    return {"ok": True, "message": "注销申请已记录，Beta 阶段将由管理员处理。"}


@router.get("/streamers")
def list_streamers(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Streamer).where(Streamer.user_id == user.id).order_by(Streamer.is_archived, Streamer.id.desc())).all()
    return [serialize_streamer(row, db) for row in rows]


def serialize_streamer(row: Streamer, db: Session) -> dict:
    session_count = db.scalar(select(func.count()).select_from(LiveSession).where(LiveSession.streamer_id == row.id)) or 0
    owner = db.get(User, row.user_id)
    return {
        "id": row.id,
        "name": row.name,
        "direction": row.direction,
        "live_forms": json.loads(row.live_forms),
        "average_online_range": row.average_online_range,
        "usual_live_time": row.usual_live_time,
        "improvement_goal": row.improvement_goal,
        "notes": row.notes,
        "is_archived": row.is_archived,
        "is_default": owner.default_streamer_id == row.id if owner else False,
        "session_count": session_count,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/streamers")
def create_streamer(
    payload: StreamerCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    row = Streamer(
        user_id=user.id,
        name=payload.name,
        direction=payload.direction,
        live_forms=json.dumps(payload.live_forms, ensure_ascii=False),
        average_online_range=payload.average_online_range,
        usual_live_time=payload.usual_live_time,
        improvement_goal=payload.improvement_goal,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    if not user.default_streamer_id:
        user.default_streamer_id = row.id
        db.commit()
    return serialize_streamer(row, db)


@router.patch("/streamers/{streamer_id}")
def update_streamer(
    streamer_id: int,
    payload: StreamerUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(Streamer, streamer_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        row.name = data["name"]
    if "direction" in data and data["direction"]:
        row.direction = data["direction"]
    if "live_forms" in data and data["live_forms"] is not None:
        row.live_forms = json.dumps(data["live_forms"], ensure_ascii=False)
    for key in ["average_online_range", "usual_live_time", "improvement_goal", "notes"]:
        if key in data and data[key] is not None:
            setattr(row, key, data[key])
    db.commit()
    db.refresh(row)
    return serialize_streamer(row, db)


@router.post("/streamers/{streamer_id}/set-default")
def set_default_streamer(streamer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(Streamer, streamer_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    if row.is_archived:
        raise HTTPException(status_code=400, detail="已归档主播不能设为当前，请先恢复")
    user.default_streamer_id = row.id
    db.commit()
    return {"ok": True, "message": f"已设为当前主播：{row.name}", "streamer": serialize_streamer(row, db)}


@router.post("/streamers/{streamer_id}/restore")
def restore_streamer(streamer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(Streamer, streamer_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    row.is_archived = False
    if not user.default_streamer_id:
        user.default_streamer_id = row.id
    db.commit()
    return {"ok": True, "message": "主播已恢复。", "streamer": serialize_streamer(row, db)}


@router.delete("/streamers/{streamer_id}")
def archive_streamer(streamer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(Streamer, streamer_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    session_count = db.scalar(select(func.count()).select_from(LiveSession).where(LiveSession.streamer_id == row.id)) or 0
    if session_count:
        row.is_archived = True
        message = "该主播已有直播记录，已为你归档，不会直接删除。"
    else:
        db.delete(row)
        message = "主播已删除。"
    if user.default_streamer_id == row.id:
        user.default_streamer_id = 0
    db.commit()
    return {"ok": True, "message": message}


@router.get("/model-settings")
def list_model_settings(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(ModelSetting).where(ModelSetting.user_id == user.id, ModelSetting.is_active)).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "mode": row.mode,
            "api_base": row.api_base,
            "api_key_masked": mask_secret(row.api_key_encrypted),
            "model_name": row.model_name,
            "purpose": row.purpose,
            "timeout_seconds": row.timeout_seconds,
            "max_retries": row.max_retries,
            "is_default": row.is_default,
            "is_active": row.is_active,
            "test_status": row.test_status,
            "last_tested_at": row.last_tested_at.isoformat() if row.last_tested_at else "",
            "last_error": row.last_error,
        }
        for row in rows
    ]


@router.post("/model-settings")
def save_model_setting(
    payload: ModelSettingIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    if payload.is_default:
        existing_defaults = db.scalars(
            select(ModelSetting).where(
                ModelSetting.user_id == user.id,
                ModelSetting.purpose == payload.purpose,
                ModelSetting.is_active,
                ModelSetting.is_default,
            )
        ).all()
        for item in existing_defaults:
            item.is_default = False
    row = ModelSetting(
        user_id=user.id,
        name=payload.name,
        mode=payload.mode,
        api_base=payload.api_base,
        api_key_encrypted=encrypt_secret(payload.api_key),
        model_name=payload.model_name,
        purpose=payload.purpose,
        timeout_seconds=payload.timeout_seconds,
        max_retries=payload.max_retries,
        is_default=payload.is_default,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "api_key_masked": mask_secret(row.api_key_encrypted), "message": "模型配置已保存"}


@router.patch("/model-settings/{setting_id}")
def update_model_setting(
    setting_id: int,
    payload: ModelSettingUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(ModelSetting, setting_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default") is True:
        for item in db.scalars(
            select(ModelSetting).where(
                ModelSetting.user_id == user.id,
                ModelSetting.purpose == row.purpose,
                ModelSetting.is_active,
                ModelSetting.is_default,
                ModelSetting.id != row.id,
            )
        ).all():
            item.is_default = False
    for key in ["name", "mode", "api_base", "model_name", "timeout_seconds", "max_retries", "is_active"]:
        if key in data and data[key] is not None:
            setattr(row, key, data[key])
    if "api_key" in data and data["api_key"]:
        row.api_key_encrypted = encrypt_secret(data["api_key"])
    if "is_default" in data and data["is_default"] is not None:
        row.is_default = data["is_default"]
    db.commit()
    return {"ok": True, "message": "模型配置已更新"}


@router.post("/model-settings/{setting_id}/test")
def test_model_setting(setting_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(ModelSetting, setting_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    if row.mode == "mock":
        row.test_status = "成功"
        row.last_tested_at = datetime.utcnow()
        row.last_error = ""
        db.commit()
        return {"ok": True, "message": "Mock 模型可用，适合本地测试"}
    config = model_config_from_setting(row)
    if not config.api_base or not config.api_key or not config.model_name:
        raise HTTPException(status_code=400, detail="请先填写 API 地址、API Key 和模型名称")
    try:
        if row.purpose == "图片识别":
            payload = test_vision_connection(config)
        else:
            payload = OpenAICompatibleChatClient(config).complete("请返回 OK")
    except ModelAdapterError as exc:
        row.test_status = "失败"
        row.last_tested_at = datetime.utcnow()
        row.last_error = exc.message
        db.commit()
        raise HTTPException(status_code=400, detail=f"模型连接失败：{exc.message}") from exc
    row.test_status = "成功"
    row.last_tested_at = datetime.utcnow()
    row.last_error = ""
    db.commit()
    content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {
        "ok": True,
        "message": "模型连接成功",
        "http_status": payload.get("_http_status"),
        "model": config.model_name,
        "preview": str(content)[:80],
    }


@router.delete("/model-settings/{setting_id}")
def delete_model_setting(setting_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(ModelSetting, setting_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    if row.is_default:
        replacement = db.scalar(
            select(ModelSetting).where(
                ModelSetting.user_id == user.id,
                ModelSetting.purpose == row.purpose,
                ModelSetting.is_active,
                ModelSetting.id != row.id,
            )
        )
        if replacement:
            raise HTTPException(status_code=400, detail="请先把其他模型设为默认，再删除当前默认模型")
    row.is_active = False
    row.is_default = False
    row.api_key_encrypted = ""
    db.commit()
    return {"ok": True}


def serialize_feedback(row: UserFeedback) -> dict:
    return {
        "id": row.id,
        "streamer_id": row.streamer_id,
        "platform_account_id": row.platform_account_id,
        "live_session_id": row.live_session_id,
        "report_id": row.report_id,
        "report_version_id": row.report_version_id,
        "model_name": row.model_name,
        "rule_snapshot": json.loads(row.rule_snapshot_json or "[]"),
        "feedback_type": row.feedback_type,
        "content": row.content,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/feedback")
def create_feedback(payload: FeedbackCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    session = None
    report = None
    current_version = None
    if payload.live_session_id:
        session = db.get(LiveSession, payload.live_session_id)
        if not session or session.user_id != user.id:
            raise HTTPException(status_code=404, detail="直播记录不存在")
        report = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session.id))
    if payload.report_id:
        report = db.get(ReviewReport, payload.report_id)
        if not report:
            raise HTTPException(status_code=404, detail="报告不存在")
        session = db.get(LiveSession, report.live_session_id)
        if not session or session.user_id != user.id:
            raise HTTPException(status_code=404, detail="报告不存在")
    if report:
        current_version = db.scalar(
            select(ReviewReportVersion)
            .where(ReviewReportVersion.review_report_id == report.id, ReviewReportVersion.is_current.is_(True))
            .order_by(ReviewReportVersion.version_number.desc())
        )
    row = UserFeedback(
        user_id=user.id,
        streamer_id=session.streamer_id if session else None,
        platform_account_id=session.platform_account_id if session else None,
        live_session_id=session.id if session else payload.live_session_id,
        report_id=report.id if report else payload.report_id,
        report_version_id=current_version.id if current_version else None,
        model_name=current_version.model_name if current_version else "",
        rule_snapshot_json=current_version.rule_snapshot if current_version else "[]",
        feedback_type=payload.feedback_type,
        content=payload.content,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"message": "反馈已提交，谢谢你帮我们改进 Beta。", "item": serialize_feedback(row)}


@router.get("/feedback")
def list_feedback(user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if not is_admin_user(user):
        rows = db.scalars(select(UserFeedback).where(UserFeedback.user_id == user.id).order_by(UserFeedback.id.desc())).all()
    else:
        rows = db.scalars(select(UserFeedback).order_by(UserFeedback.id.desc()).limit(100)).all()
    return {"items": [serialize_feedback(row) for row in rows], "is_admin": is_admin_user(user)}


def is_admin_user(user: User) -> bool:
    admin_phones = {phone.strip() for phone in getattr(get_settings(), "admin_phones", "").split(",") if phone.strip()}
    return bool(admin_phones and user.phone in admin_phones)


MANAGE_PLATFORM_ROLES = {"owner", "admin"}
CREATE_REVIEW_ROLES = {"owner", "admin", "operator"}


def platform_capabilities(status: str = "manual") -> dict:
    if status == "connected_basic":
        return {
            "基础资料可读取": True,
            "粉丝数据可读取": False,
            "作品数据可读取": False,
            "广告投放数据可读取": False,
            "直播数据可读取": False,
            "电商直播数据可读取": False,
            "暂不支持": False,
        }
    return {
        "基础资料可读取": False,
        "粉丝数据可读取": False,
        "作品数据可读取": False,
        "广告投放数据可读取": False,
        "直播数据可读取": False,
        "电商直播数据可读取": False,
        "暂不支持": True,
    }


def user_platform_link(db: Session, user_id: int, account_id: int) -> Optional[UserPlatformAccount]:
    return db.scalar(
        select(UserPlatformAccount).where(
            UserPlatformAccount.user_id == user_id,
            UserPlatformAccount.platform_account_id == account_id,
            UserPlatformAccount.status == "active",
        )
    )


def ensure_platform_access(account_id: int, user: User, db: Session, manage: bool = False) -> PlatformAccount:
    account = db.get(PlatformAccount, account_id)
    if not account or account.archived_at:
        raise HTTPException(status_code=404, detail="平台账号不存在")
    link = user_platform_link(db, user.id, account_id)
    if not link:
        raise HTTPException(status_code=403, detail="你没有权限查看这个平台账号")
    if manage and link.role not in MANAGE_PLATFORM_ROLES:
        raise HTTPException(status_code=403, detail="你没有权限管理这个平台账号")
    return account


def can_create_review_for_account(account_id: int, user: User, db: Session) -> bool:
    link = user_platform_link(db, user.id, account_id)
    return bool(link and link.role in CREATE_REVIEW_ROLES)


def latest_anchor_binding(db: Session, account_id: int) -> Optional[AnchorPlatformAccount]:
    return db.scalar(
        select(AnchorPlatformAccount)
        .where(AnchorPlatformAccount.platform_account_id == account_id)
        .order_by(AnchorPlatformAccount.is_primary.desc(), AnchorPlatformAccount.id.desc())
    )


def serialize_platform_account(account: PlatformAccount, db: Session, user: Optional[User] = None, include_detail: bool = False) -> dict:
    binding = latest_anchor_binding(db, account.id)
    anchor = db.get(Streamer, binding.anchor_id) if binding else None
    members = db.scalars(select(UserPlatformAccount).where(UserPlatformAccount.platform_account_id == account.id)).all()
    current_member = user_platform_link(db, user.id, account.id) if user else None
    capability_status = json.loads(account.capability_status or "{}")
    if not capability_status:
        capability_status = platform_capabilities("connected_basic" if account.connection_type == "oauth" else "manual")
    payload = {
        "id": account.id,
        "platform": account.platform,
        "display_name": account.display_name,
        "account_handle": account.account_handle,
        "avatar_url": account.avatar_url,
        "account_type": account.account_type,
        "verification_status": account.verification_status,
        "connection_type": account.connection_type,
        "connection_status": account.connection_status,
        "authorization_status": account.authorization_status,
        "capability_status": capability_status,
        "follower_range": account.follower_range,
        "notes": account.notes,
        "last_synced_at": account.last_synced_at.isoformat() if account.last_synced_at else "",
        "token_expires_at": account.token_expires_at.isoformat() if account.token_expires_at else "",
        "anchor": {"id": anchor.id, "name": anchor.name} if anchor else None,
        "is_primary": bool(binding and binding.is_primary),
        "member_role": current_member.role if current_member else "",
        "member_count": len(members),
        "created_at": account.created_at.isoformat(),
    }
    if include_detail:
        authorization = db.scalar(
            select(PlatformAuthorization)
            .where(PlatformAuthorization.platform_account_id == account.id)
            .order_by(PlatformAuthorization.id.desc())
        )
        snapshots = db.scalars(
            select(PlatformDataSnapshot)
            .where(PlatformDataSnapshot.platform_account_id == account.id)
            .order_by(PlatformDataSnapshot.id.desc())
            .limit(5)
        ).all()
        payload["authorization"] = {
            "provider": authorization.provider,
            "authorization_status": authorization.authorization_status,
            "scopes": json.loads(authorization.scopes or "[]"),
            "token_expires_at": authorization.token_expires_at.isoformat() if authorization.token_expires_at else "",
            "authorized_at": authorization.authorized_at.isoformat() if authorization.authorized_at else "",
            "revoked_at": authorization.revoked_at.isoformat() if authorization.revoked_at else "",
            "last_error": authorization.last_error,
        } if authorization else None
        payload["data_snapshots"] = [
            {
                "id": item.id,
                "data_type": item.data_type,
                "snapshot_date": item.snapshot_date,
                "source": item.source,
                "created_at": item.created_at.isoformat(),
            }
            for item in snapshots
        ]
        member_payload = []
        for item in members:
            member_user = db.get(User, item.user_id)
            member_payload.append(
                {
                    "id": item.id,
                    "user_id": item.user_id,
                    "user_name": member_user.name if member_user else "",
                    "phone_masked": mask_phone(member_user.phone) if member_user else "",
                    "role": item.role,
                    "permission_scope": item.permission_scope,
                    "status": item.status,
                    "created_at": item.created_at.isoformat(),
                }
            )
        payload["members"] = member_payload
        payload["sync_jobs"] = [
            serialize_platform_sync_job(job)
            for job in db.scalars(
                select(PlatformSyncJob)
                .where(PlatformSyncJob.platform_account_id == account.id)
                .order_by(PlatformSyncJob.id.desc())
                .limit(10)
            ).all()
        ]
    return payload


def serialize_platform_sync_job(job: PlatformSyncJob) -> dict:
    return {
        "id": job.id,
        "sync_type": job.sync_type,
        "status": job.status,
        "started_at": job.started_at.isoformat() if job.started_at else "",
        "completed_at": job.completed_at.isoformat() if job.completed_at else "",
        "records_synced": job.records_synced,
        "error_code": job.error_code,
        "error_message": job.error_message,
        "created_at": job.created_at.isoformat(),
    }


def mask_phone(phone: str) -> str:
    if len(phone) < 7:
        return "****"
    return f"{phone[:3]}****{phone[-4:]}"


def owner_count(db: Session, account_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(UserPlatformAccount)
        .where(
            UserPlatformAccount.platform_account_id == account_id,
            UserPlatformAccount.role == "owner",
            UserPlatformAccount.status == "active",
        )
    ) or 0


def set_anchor_account_binding(
    db: Session,
    account: PlatformAccount,
    anchor_id: Optional[int],
    is_primary: bool,
    user_id: Optional[int] = None,
) -> None:
    if not anchor_id:
        return
    anchor = db.get(Streamer, anchor_id)
    if not anchor or (user_id is not None and anchor.user_id != user_id):
        raise HTTPException(status_code=404, detail="主播不存在")
    existing = db.scalar(
        select(AnchorPlatformAccount).where(
            AnchorPlatformAccount.anchor_id == anchor_id,
            AnchorPlatformAccount.platform_account_id == account.id,
        )
    )
    if is_primary:
        for row in db.scalars(select(AnchorPlatformAccount).where(AnchorPlatformAccount.anchor_id == anchor_id)).all():
            row.is_primary = False
    if existing:
        existing.is_primary = is_primary or existing.is_primary
    else:
        db.add(AnchorPlatformAccount(anchor_id=anchor_id, platform_account_id=account.id, is_primary=is_primary))


def find_duplicate_platform_account(db: Session, payload: PlatformAccountCreate) -> Optional[PlatformAccount]:
    if payload.account_handle:
        return db.scalar(
            select(PlatformAccount).where(
                PlatformAccount.platform == payload.platform,
                PlatformAccount.account_handle == payload.account_handle,
                PlatformAccount.archived_at.is_(None),
            )
        )
    return None


@router.get("/platform-accounts")
def list_platform_accounts(
    anchor_id: Optional[int] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if anchor_id:
        anchor = db.get(Streamer, anchor_id)
        if not anchor or anchor.user_id != user.id:
            raise HTTPException(status_code=404, detail="主播不存在")
    links = db.scalars(
        select(UserPlatformAccount).where(UserPlatformAccount.user_id == user.id, UserPlatformAccount.status == "active")
    ).all()
    account_ids = [link.platform_account_id for link in links]
    if not account_ids:
        return {"items": []}
    rows = db.scalars(select(PlatformAccount).where(PlatformAccount.id.in_(account_ids), PlatformAccount.archived_at.is_(None))).all()
    if anchor_id:
        bound_ids = {
            row.platform_account_id
            for row in db.scalars(select(AnchorPlatformAccount).where(AnchorPlatformAccount.anchor_id == anchor_id)).all()
        }
        rows = [row for row in rows if row.id in bound_ids]
    return {"items": [serialize_platform_account(row, db, user) for row in rows]}


@router.post("/platform-accounts")
def create_platform_account(payload: PlatformAccountCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if payload.anchor_id:
        anchor = db.get(Streamer, payload.anchor_id)
        if not anchor or anchor.user_id != user.id:
            raise HTTPException(status_code=404, detail="主播不存在")
    duplicate = find_duplicate_platform_account(db, payload)
    if duplicate:
        existing_link = user_platform_link(db, user.id, duplicate.id)
        if not existing_link:
            raise HTTPException(status_code=409, detail="这个平台账号已被其他用户记录。请让账号负责人邀请你，或后续通过官方授权完成合并。")
        set_anchor_account_binding(db, duplicate, payload.anchor_id, True, user.id)
        db.commit()
        return serialize_platform_account(duplicate, db, user, include_detail=True)
    account = PlatformAccount(
        platform=payload.platform,
        display_name=payload.display_name,
        account_handle=payload.account_handle,
        account_type=payload.account_type,
        follower_range=payload.follower_range,
        notes=payload.notes,
        connection_type="manual",
        connection_status="已手动记录",
        authorization_status="未授权",
        capability_status=json.dumps(platform_capabilities("manual"), ensure_ascii=False),
    )
    db.add(account)
    db.flush()
    db.add(UserPlatformAccount(user_id=user.id, platform_account_id=account.id, role="owner", permission_scope="all"))
    set_anchor_account_binding(db, account, payload.anchor_id, True, user.id)
    db.commit()
    db.refresh(account)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.get("/platform-accounts/{account_id}")
def get_platform_account(account_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    account = ensure_platform_access(account_id, user, db)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.patch("/platform-accounts/{account_id}")
def update_platform_account(
    account_id: int,
    payload: PlatformAccountUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    account = ensure_platform_access(account_id, user, db, manage=True)
    data = payload.model_dump(exclude_unset=True)
    for key in ["display_name", "account_handle", "account_type", "follower_range", "notes"]:
        if key in data and data[key] is not None:
            setattr(account, key, data[key])
    if "anchor_id" in data:
        if data.get("anchor_id") is None:
            db.query(AnchorPlatformAccount).filter(AnchorPlatformAccount.platform_account_id == account.id).delete(
                synchronize_session=False
            )
        else:
            set_anchor_account_binding(db, account, data.get("anchor_id"), bool(data.get("is_primary", True)), user.id)
    elif data.get("is_primary"):
        binding = latest_anchor_binding(db, account.id)
        set_anchor_account_binding(db, account, binding.anchor_id if binding else None, True, user.id)
    account.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(account)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.post("/platform-accounts/{account_id}/archive")
def archive_platform_account(account_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    account = ensure_platform_access(account_id, user, db, manage=True)
    account.archived_at = datetime.utcnow()
    account.connection_status = "已归档"
    db.commit()
    return {"ok": True, "message": "平台账号已归档。"}


@router.post("/platform-accounts/{account_id}/members")
def add_platform_member(
    account_id: int,
    payload: PlatformMemberCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_platform_access(account_id, user, db, manage=True)
    member_user = db.scalar(select(User).where(User.phone == payload.phone))
    if not member_user:
        raise HTTPException(status_code=404, detail="成员手机号尚未注册")
    existing = user_platform_link(db, member_user.id, account_id)
    if existing:
        existing.role = payload.role
        existing.permission_scope = payload.permission_scope
        existing.status = "active"
    else:
        db.add(
            UserPlatformAccount(
                user_id=member_user.id,
                platform_account_id=account_id,
                role=payload.role,
                permission_scope=payload.permission_scope,
                invited_by=user.id,
            )
        )
    db.commit()
    account = db.get(PlatformAccount, account_id)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.patch("/platform-accounts/{account_id}/members/{member_id}")
def update_platform_member(
    account_id: int,
    member_id: int,
    payload: PlatformMemberUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_platform_access(account_id, user, db, manage=True)
    member = db.get(UserPlatformAccount, member_id)
    if not member or member.platform_account_id != account_id or member.status != "active":
        raise HTTPException(status_code=404, detail="成员不存在")
    if member.role == "owner" and payload.role != "owner" and owner_count(db, account_id) <= 1:
        raise HTTPException(status_code=400, detail="账号至少需要保留一名负责人")
    member.role = payload.role
    member.permission_scope = payload.permission_scope
    db.commit()
    account = db.get(PlatformAccount, account_id)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.delete("/platform-accounts/{account_id}/members/{member_id}")
def remove_platform_member(
    account_id: int,
    member_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_platform_access(account_id, user, db, manage=True)
    member = db.get(UserPlatformAccount, member_id)
    if not member or member.platform_account_id != account_id or member.status != "active":
        raise HTTPException(status_code=404, detail="成员不存在")
    if member.role == "owner" and owner_count(db, account_id) <= 1:
        raise HTTPException(status_code=400, detail="账号至少需要保留一名负责人")
    member.status = "removed"
    db.commit()
    account = db.get(PlatformAccount, account_id)
    return serialize_platform_account(account, db, user, include_detail=True)


@router.get("/streamers/{streamer_id}/platform-accounts")
def list_anchor_platform_accounts(streamer_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    anchor = db.get(Streamer, streamer_id)
    if not anchor or anchor.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    bindings = db.scalars(select(AnchorPlatformAccount).where(AnchorPlatformAccount.anchor_id == streamer_id)).all()
    accounts = []
    for binding in bindings:
        account = db.get(PlatformAccount, binding.platform_account_id)
        if account and not account.archived_at and user_platform_link(db, user.id, account.id):
            accounts.append(serialize_platform_account(account, db, user))
    return {"items": accounts}


@router.get("/platform/oauth/douyin/status")
def douyin_oauth_status(user: User = Depends(current_user)) -> dict:
    provider = DouyinOAuthProvider()
    status = provider.test_connection()
    return {
        "configured": status.configured,
        "message": status.message,
        "platform_status": get_settings().douyin_platform_status,
    }


@router.post("/platform/oauth/douyin/authorize-url")
def douyin_authorize_url(user: User = Depends(current_user)) -> dict:
    provider = DouyinOAuthProvider()
    state = token_urlsafe(24)
    status = provider.get_authorization_url(state)
    return {"configured": status.configured, "message": status.message, "authorization_url": status.authorization_url, "state": state}


@router.post("/platform-accounts/{account_id}/sync")
def create_platform_sync_job(
    account_id: int,
    sync_type: str = "account_profile",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_platform_access(account_id, user, db)
    job = PlatformSyncJob(
        platform_account_id=account_id,
        sync_type=sync_type,
        status="unsupported",
        completed_at=datetime.utcnow(),
        error_code="unsupported",
        error_message="当前账号记录可用，官方数据同步尚未配置。",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return serialize_platform_sync_job(job)


def parse_json_list(value: str) -> list:
    try:
        data = json.loads(value or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def latest_rule_version(db: Session, rule_id: int) -> Optional[RuleVersion]:
    return db.scalar(select(RuleVersion).where(RuleVersion.rule_id == rule_id).order_by(RuleVersion.version_number.desc()))


def latest_rule_interpretation(db: Session, rule_id: int) -> Optional[RuleInterpretation]:
    return db.scalar(select(RuleInterpretation).where(RuleInterpretation.rule_id == rule_id).order_by(RuleInterpretation.id.desc()))


def rule_to_dict(rule: RuleEntry, db: Session, include_content: bool = False) -> dict:
    interpretation = latest_rule_interpretation(db, rule.id)
    version = latest_rule_version(db, rule.id)
    payload = {
        "id": rule.id,
        "title": rule.title,
        "rule_type": rule.rule_type,
        "scope_type": rule.scope_type,
        "scope_value": rule.scope_value,
        "source_name": rule.source_name,
        "source_url": rule.source_url,
        "published_at": rule.published_at,
        "effective_at": rule.effective_at,
        "expires_at": rule.expires_at,
        "status": rule.status,
        "risk_level": rule.risk_level,
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat(),
        "version_number": version.version_number if version else 1,
        "interpretation": serialize_rule_interpretation(interpretation) if interpretation else None,
    }
    if include_content:
        payload["raw_content"] = rule.raw_content
        payload["structured_content"] = json.loads(version.structured_content) if version else {}
    return payload


def serialize_rule_interpretation(row: RuleInterpretation) -> dict:
    return {
        "summary": row.summary,
        "applicable_users": row.applicable_users,
        "risky_behaviors": parse_json_list(row.risky_behaviors),
        "recommended_actions": parse_json_list(row.recommended_actions),
        "keywords": parse_json_list(row.keywords),
        "confidence": row.confidence,
        "possible_conflicts": parse_json_list(row.possible_conflicts),
        "model_name": row.model_name,
        "confirmed_at": row.confirmed_at.isoformat() if row.confirmed_at else "",
    }


def local_rule_interpretation(rule: RuleEntry, conflicts: list[dict], model_name: str = "local_rule_parser") -> dict:
    content = rule.raw_content.strip()
    sentences = [part.strip() for part in content.replace("。", "\n").splitlines() if part.strip()]
    keywords = []
    for word in ["诱导打赏", "站外引流", "绝对化", "违规", "未成年人", "医疗", "法律", "连麦", "标题", "关注"]:
        if word in content:
            keywords.append(word)
    risky_behaviors = [sentence for sentence in sentences if any(token in sentence for token in ["不要", "禁止", "避免", "违规", "不能"])]
    recommended_actions = [sentence for sentence in sentences if any(token in sentence for token in ["建议", "可以", "需要", "优先"])]
    summary = sentences[0][:120] if sentences else rule.title
    return {
        "summary": summary,
        "applicable_users": rule.scope_value or rule.scope_type,
        "risky_behaviors": risky_behaviors[:5],
        "recommended_actions": recommended_actions[:5],
        "keywords": keywords[:10],
        "risk_level": "高" if rule.rule_type in ["平台官方规则", "主播个人提醒"] and ("违规" in content or "处罚" in content) else "中",
        "applicable_scenes": [rule.scope_type],
        "needs_human_confirmation": True,
        "possible_conflicts": conflicts,
        "model_name": model_name,
        "confidence": 70 if model_name == "local_rule_parser" else 85,
    }


def detect_rule_conflicts(rule: RuleEntry, db: Session) -> list[dict]:
    conflict_tokens = ["允许", "可以", "禁止", "不要", "不能", "诱导打赏", "站外引流", "医疗", "法律", "未成年人"]
    words = {word for word in conflict_tokens if word in rule.raw_content}
    if not words:
        return []
    active_rules = db.scalars(select(RuleEntry).where(RuleEntry.status == "已生效", RuleEntry.id != rule.id)).all()
    conflicts = []
    for item in active_rules:
        if not words.intersection({word for word in words if word in item.raw_content}):
            continue
        opposite = ("允许" in rule.raw_content or "可以" in rule.raw_content) and any(
            token in item.raw_content for token in ["禁止", "不要", "不能"]
        )
        reverse = any(token in rule.raw_content for token in ["禁止", "不要", "不能"]) and any(
            token in item.raw_content for token in ["允许", "可以"]
        )
        if opposite or reverse:
            conflicts.append(
                {
                    "rule_id": item.id,
                    "title": item.title,
                    "source": item.source_name or item.rule_type,
                    "effective_at": item.effective_at,
                    "conflict": "新旧规则对同类表达的允许或禁止方向不同，建议人工确认。",
                }
            )
    return conflicts[:5]


def interpret_rule(rule: RuleEntry, user: User, db: Session) -> dict:
    conflicts = detect_rule_conflicts(rule, db)
    setting = select_model_setting(user, "文字分析", db)
    if setting and setting.mode != "mock":
        config = model_config_from_setting(setting)
        prompt = (
            "请把人工录入的直播规则整理为严格 JSON。不得把运营经验写成平台官方规则。"
            "字段：summary, applicable_users, risky_behaviors, recommended_actions, keywords, risk_level,"
            "applicable_scenes, needs_human_confirmation, possible_conflicts。"
            f"规则类型：{rule.rule_type}；适用范围：{rule.scope_type} {rule.scope_value}；"
            f"来源：{rule.source_name}；原文：{rule.raw_content}；已发现的潜在冲突：{json.dumps(conflicts, ensure_ascii=False)}"
        )
        try:
            response = request_openai_compatible_chat(
                api_base=config.api_base,
                api_key=config.api_key,
                model_name=config.model_name,
                messages=[{"role": "user", "content": prompt}],
                timeout_seconds=config.timeout_seconds,
                max_retries=config.max_retries,
                response_format={"type": "json_object"},
            )
            data = parse_json_response(response)
            data["model_name"] = config.model_name
            data["possible_conflicts"] = data.get("possible_conflicts") or conflicts
            data["confidence"] = int(data.get("confidence") or 85)
            return data
        except ModelAdapterError:
            return local_rule_interpretation(rule, conflicts)
    return local_rule_interpretation(rule, conflicts)


def save_rule_interpretation(rule: RuleEntry, data: dict, db: Session) -> RuleInterpretation:
    row = RuleInterpretation(
        rule_id=rule.id,
        summary=str(data.get("summary") or rule.title),
        applicable_users=str(data.get("applicable_users") or rule.scope_value or rule.scope_type),
        risky_behaviors=json.dumps(data.get("risky_behaviors") or [], ensure_ascii=False),
        recommended_actions=json.dumps(data.get("recommended_actions") or [], ensure_ascii=False),
        keywords=json.dumps(data.get("keywords") or [], ensure_ascii=False),
        confidence=int(data.get("confidence") or 70),
        possible_conflicts=json.dumps(data.get("possible_conflicts") or [], ensure_ascii=False),
        model_name=str(data.get("model_name") or "local_rule_parser"),
    )
    rule.risk_level = str(data.get("risk_level") or rule.risk_level or "中")
    db.add(row)
    return row


def ensure_can_manage_rule(rule: RuleEntry, user: User) -> None:
    if rule.rule_type in ["平台官方规则", "运营经验", "系统提示"] and not is_admin_user(user):
        raise HTTPException(status_code=403, detail="普通用户不能修改公共规则")
    if rule.rule_type == "主播个人提醒" and rule.user_id != user.id and not is_admin_user(user):
        raise HTTPException(status_code=403, detail="不能修改其他用户的规则")


@router.get("/rules")
def list_rules(
    rule_type: str = "",
    keyword: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    rows = db.scalars(select(RuleEntry).order_by(RuleEntry.id.desc())).all()
    visible = []
    for row in rows:
        public = row.rule_type in ["平台官方规则", "运营经验", "系统提示"]
        owned = row.user_id == user.id
        if not public and not owned and not is_admin_user(user):
            continue
        if rule_type and row.rule_type != rule_type:
            continue
        if keyword and keyword not in row.title and keyword not in row.raw_content:
            continue
        visible.append(row)
    return {"items": [rule_to_dict(row, db) for row in visible], "is_admin": is_admin_user(user)}


@router.post("/rules")
def create_rule(payload: RuleCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    if payload.rule_type in ["平台官方规则", "运营经验", "系统提示"] and not is_admin_user(user):
        raise HTTPException(status_code=403, detail="普通用户不能发布公共规则")
    scope_value = payload.scope_value
    if payload.related_streamer_id:
        streamer = db.get(Streamer, payload.related_streamer_id)
        if not streamer or streamer.user_id != user.id:
            raise HTTPException(status_code=404, detail="主播不存在")
        scope_value = str(payload.related_streamer_id)
    row = RuleEntry(
        user_id=user.id,
        title=payload.title.strip(),
        raw_content=payload.raw_content.strip(),
        rule_type=payload.rule_type,
        scope_type=payload.scope_type,
        scope_value=scope_value,
        source_name=payload.source_name,
        source_url=payload.source_url,
        published_at=payload.published_at,
        effective_at=payload.effective_at,
        expires_at=payload.expires_at,
        status="待确认",
        created_by=user.id,
    )
    db.add(row)
    db.flush()
    data = interpret_rule(row, user, db)
    save_rule_interpretation(row, data, db)
    db.add(
        RuleVersion(
            rule_id=row.id,
            version_number=1,
            raw_content=row.raw_content,
            structured_content=json.dumps(data, ensure_ascii=False),
            change_reason="首次录入并 AI 理解",
            created_by=user.id,
        )
    )
    db.commit()
    db.refresh(row)
    return rule_to_dict(row, db, include_content=True)


@router.get("/rules/{rule_id}")
def get_rule(rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(RuleEntry, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="规则不存在")
    public = row.rule_type in ["平台官方规则", "运营经验", "系统提示"]
    if not public and row.user_id != user.id and not is_admin_user(user):
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule_to_dict(row, db, include_content=True)


@router.get("/rules/{rule_id}/versions")
def list_rule_versions(rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(RuleEntry, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="规则不存在")
    public = row.rule_type in ["平台官方规则", "运营经验", "系统提示"]
    if not public and row.user_id != user.id and not is_admin_user(user):
        raise HTTPException(status_code=404, detail="规则不存在")
    versions = db.scalars(select(RuleVersion).where(RuleVersion.rule_id == rule_id).order_by(RuleVersion.version_number.desc())).all()
    return {
        "items": [
            {
                "id": item.id,
                "version_number": item.version_number,
                "change_reason": item.change_reason,
                "raw_content": item.raw_content,
                "structured_content": json.loads(item.structured_content or "{}"),
                "created_at": item.created_at.isoformat(),
            }
            for item in versions
        ]
    }


@router.post("/rules/{rule_id}/confirm")
def confirm_rule(rule_id: int, payload: RuleConfirm, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(RuleEntry, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="规则不存在")
    ensure_can_manage_rule(row, user)
    if row.rule_type in ["平台官方规则", "系统提示"] and not is_admin_user(user):
        raise HTTPException(status_code=403, detail="公共规则必须由管理员确认")
    structured = payload.structured_content or (rule_to_dict(row, db, include_content=True).get("structured_content") or {})
    version = latest_rule_version(db, row.id)
    if version and json.loads(version.structured_content or "{}") != structured:
        next_version = version.version_number + 1
    else:
        next_version = version.version_number if version else 1
    if not version or next_version != version.version_number:
        db.add(
            RuleVersion(
                rule_id=row.id,
                version_number=next_version,
                raw_content=row.raw_content,
                structured_content=json.dumps(structured, ensure_ascii=False),
                change_reason=payload.change_reason,
                created_by=user.id,
            )
        )
    interpretation = latest_rule_interpretation(db, row.id)
    if interpretation:
        interpretation.confirmed_by = user.id
        interpretation.confirmed_at = datetime.utcnow()
    row.status = payload.status
    row.updated_at = datetime.utcnow()
    db.commit()
    return rule_to_dict(row, db, include_content=True)


@router.patch("/rules/{rule_id}")
def update_rule(rule_id: int, payload: RuleUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(RuleEntry, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="规则不存在")
    ensure_can_manage_rule(row, user)
    if payload.title is not None:
        row.title = payload.title
    if payload.raw_content is not None:
        row.raw_content = payload.raw_content
    row.status = "待确认"
    row.updated_at = datetime.utcnow()
    data = payload.structured_content or interpret_rule(row, user, db)
    save_rule_interpretation(row, data, db)
    version = latest_rule_version(db, row.id)
    db.add(
        RuleVersion(
            rule_id=row.id,
            version_number=(version.version_number + 1) if version else 1,
            raw_content=row.raw_content,
            structured_content=json.dumps(data, ensure_ascii=False),
            change_reason=payload.change_reason,
            created_by=user.id,
        )
    )
    db.commit()
    return rule_to_dict(row, db, include_content=True)


@router.post("/rules/{rule_id}/disable")
def disable_rule(rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(RuleEntry, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="规则不存在")
    ensure_can_manage_rule(row, user)
    row.status = "已停用"
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/live-sessions")
def create_live_session(
    payload: LiveSessionCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    streamer = db.get(Streamer, payload.streamer_id)
    if not streamer or streamer.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    if payload.platform_account_id:
        account = ensure_platform_access(payload.platform_account_id, user, db)
        if not can_create_review_for_account(account.id, user, db):
            raise HTTPException(status_code=403, detail="你没有权限为这个抖音账号创建复盘")
        binding = db.scalar(
            select(AnchorPlatformAccount).where(
                AnchorPlatformAccount.anchor_id == payload.streamer_id,
                AnchorPlatformAccount.platform_account_id == account.id,
            )
        )
        if not binding:
            raise HTTPException(status_code=400, detail="请先把该平台账号绑定到当前主播")
    if payload.preparation_plan_id:
        plan = db.get(PreparationPlan, payload.preparation_plan_id)
        if not plan or plan.user_id != user.id or plan.streamer_id != payload.streamer_id:
            raise HTTPException(status_code=404, detail="开播方案不存在")
        if plan.platform_account_id and payload.platform_account_id and plan.platform_account_id != payload.platform_account_id:
            raise HTTPException(status_code=400, detail="开播方案和当前抖音账号不一致")
        plan.is_used = True
        plan.used_at = datetime.utcnow()
    row = LiveSession(
        user_id=user.id,
        streamer_id=payload.streamer_id,
        platform_account_id=payload.platform_account_id,
        preparation_plan_id=payload.preparation_plan_id,
        platform=payload.platform,
        data_source=payload.data_source,
        title=payload.title,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "streamer_id": row.streamer_id,
        "platform_account_id": row.platform_account_id,
        "preparation_plan_id": row.preparation_plan_id,
        "platform": row.platform,
        "data_source": row.data_source,
        "title": row.title,
        "status": row.status,
    }


@router.get("/live-sessions")
def list_live_sessions(
    streamer_id: Optional[int] = None,
    platform_account_id: Optional[int] = None,
    status: str = "",
    date_from: str = "",
    date_to: str = "",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    if platform_account_id:
        ensure_platform_access(platform_account_id, user, db)
    query = select(LiveSession).where(LiveSession.user_id == user.id, LiveSession.is_archived.is_(False))
    if streamer_id:
        query = query.where(LiveSession.streamer_id == streamer_id)
    if platform_account_id:
        query = query.where(LiveSession.platform_account_id == platform_account_id)
    if status:
        query = query.where(LiveSession.status == status)
    rows = db.scalars(query.order_by(LiveSession.id.desc())).all()
    summaries = [serialize_live_session_summary(row, db) for row in rows]
    if date_from:
        summaries = [item for item in summaries if (item.get("live_date") or item["created_at"][:10]) >= date_from]
    if date_to:
        summaries = [item for item in summaries if (item.get("live_date") or item["created_at"][:10]) <= date_to]
    return summaries


def serialize_live_session_summary(row: LiveSession, db: Session) -> dict:
    metrics_row = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == row.id))
    report_row = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == row.id))
    metrics = json.loads(metrics_row.metrics_json) if metrics_row else {}
    report = json.loads(report_row.report_json) if report_row else {}
    platform_account = db.get(PlatformAccount, row.platform_account_id) if row.platform_account_id else None
    return {
        "id": row.id,
        "streamer_id": row.streamer_id,
        "platform_account_id": row.platform_account_id,
        "preparation_plan_id": row.preparation_plan_id,
        "platform": row.platform,
        "data_source": row.data_source,
        "platform_account": serialize_platform_account(platform_account, db) if platform_account else None,
        "title": row.title,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
        "live_date": metrics.get("live_date") or row.created_at.date().isoformat(),
        "duration_minutes": metrics.get("duration_minutes"),
        "peak_online": metrics.get("peak_online"),
        "average_online": metrics.get("average_online"),
        "new_followers": metrics.get("new_followers"),
        "main_problem": report.get("main_problem", ""),
    }


@router.delete("/live-sessions/{session_id}")
def archive_live_session(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    session = ensure_owned_session(session_id, user, db)
    if session.status in ["draft", "metrics_recognized", "metrics_confirmed"]:
        db.delete(session)
        message = "未完成复盘已删除。"
    else:
        session.is_archived = True
        message = "已完成复盘已归档。"
    db.commit()
    return {"ok": True, "message": message}


def build_prepare_plan(streamer: Streamer, payload: PreparePlanRequest, user: User, db: Session) -> dict:
    live_forms = json.loads(streamer.live_forms)
    form_text = payload.live_form or (live_forms[0] if live_forms else "评论互动")
    rules = select_relevant_rules(
        user,
        LiveSession(user_id=user.id, streamer_id=streamer.id, platform_account_id=payload.platform_account_id, title=payload.topic),
        MetricsConfirm(session_topic=payload.topic, main_goal=payload.goal, has_violation="违规" in payload.special_notes),
        db,
        limit=5,
    )
    direction_hint = {
        "内容分享": "把观点拆成具体步骤，让新观众快速听懂。",
        "情感陪伴": "表达更温和，先共情再给建议，避免刺激对立。",
        "才艺娱乐": "先建立期待，再安排互动和展示节奏。",
        "商品或服务销售": "先讲适合谁和真实使用场景，避免绝对化承诺。",
    }.get(streamer.direction, "先讲清直播价值，再安排互动。")
    titles = [
        f"{payload.topic}，新手先看这3点",
        f"今晚聊{payload.topic}：少走弯路版",
        f"{payload.topic}怎么做更稳？",
        f"刚开播也能用的{payload.topic}方法",
        f"下一场直播前，把{payload.topic}想清楚",
    ]
    return {
        "recommended_theme": f"{payload.topic}：围绕{payload.goal}做一场更稳的直播",
        "backup_themes": [f"{payload.topic}的常见误区", f"{payload.topic}的实操问答"],
        "titles": titles,
        "opening_3_minutes": (
            f"刚进来的朋友，今天这场我们围绕“{payload.topic}”讲清楚。"
            f"如果你现在最想解决的是“{payload.goal}”，可以先在评论区扣 1。"
            f"这场采用{form_text}形式，我会用 {streamer.direction} 的方式，把下一场能直接用的做法拆出来。{direction_hint}"
        ),
        "interaction_nodes": [
            "第5分钟：让观众用 1/2 选择当前最卡的问题。",
            "直播中段：请观众发一个自己最想解决的场景。",
            "结束前10分钟：让观众选择下一场还想听的主题。",
        ],
        "follow_prompts": [
            "如果你想继续拿到下一场能直接用的话术，可以先点关注。",
            "关注后，后面几场会继续拆留人、互动和复盘方法。",
        ],
        "new_traffic_script": f"刚进来的朋友，我们正在讲{payload.topic}，你先听这一段，马上会给一个可以直接照着用的做法。",
        "outline": [
            "开场：说明主题、适合谁、听完能拿走什么。",
            "第一段：讲一个最常见问题。",
            "第二段：给出具体做法和示例话术。",
            "第三段：评论互动和答疑。",
            "收尾：总结、关注引导和下一场预告。",
        ],
        "risk_notes": [
            "避免绝对化承诺，不说保证涨粉、保证成交。",
            "涉及个人经历时避免人身攻击、群体攻击和隐私信息。",
            *(["连麦时先设边界，出现隐私、攻击或极端表达要及时转回安全话题。"] if payload.has_cohost else []),
            *(["带货或服务转化时避免保证效果、夸大收益和诱导站外交易。"] if payload.has_ecommerce else []),
            *(f"{rule['rule_type']}：{rule['title']}。{rule['summary']}" for rule in rules[:3]),
            *(["特别注意：" + payload.special_notes] if payload.special_notes else []),
        ],
        "target_metrics": [
            f"{payload.goal}：开播后重点观察对应指标是否比上一场改善。",
            "平均停留：观察前10分钟是否稳定。",
            "互动反馈：观察评论数、关注数和新流量承接表现。",
        ],
        "rule_snapshot": rules,
        "live_forms": live_forms,
    }


@router.get("/prepare-plans")
def list_prepare_plans(
    streamer_id: Optional[int] = None,
    platform_account_id: Optional[int] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = select(PreparationPlan).where(PreparationPlan.user_id == user.id)
    if streamer_id:
        query = query.where(PreparationPlan.streamer_id == streamer_id)
    if platform_account_id:
        ensure_platform_access(platform_account_id, user, db)
        query = query.where(PreparationPlan.platform_account_id == platform_account_id)
    rows = db.scalars(query.order_by(PreparationPlan.id.desc()).limit(20)).all()
    return {"items": [serialize_prepare_plan(row) for row in rows]}


def serialize_prepare_plan(row: PreparationPlan) -> dict:
    return {
        "id": row.id,
        "streamer_id": row.streamer_id,
        "platform_account_id": row.platform_account_id,
        "topic": row.topic,
        "duration_minutes": row.duration_minutes,
        "goal": row.goal,
        "live_form": row.live_form,
        "has_cohost": row.has_cohost,
        "has_ecommerce": row.has_ecommerce,
        "special_notes": row.special_notes,
        "plan": json.loads(row.plan_json),
        "is_used": row.is_used,
        "used_at": row.used_at.isoformat() if row.used_at else "",
        "created_at": row.created_at.isoformat(),
    }


@router.post("/prepare-plans")
def create_prepare_plan(payload: PreparePlanRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    streamer = db.get(Streamer, payload.streamer_id)
    if not streamer or streamer.user_id != user.id or streamer.is_archived:
        raise HTTPException(status_code=404, detail="主播不存在")
    if payload.platform_account_id:
        account = ensure_platform_access(payload.platform_account_id, user, db)
        binding = db.scalar(
            select(AnchorPlatformAccount).where(
                AnchorPlatformAccount.anchor_id == streamer.id,
                AnchorPlatformAccount.platform_account_id == account.id,
            )
        )
        if not binding:
            raise HTTPException(status_code=400, detail="请先把该平台账号绑定到当前主播")
    plan = build_prepare_plan(streamer, payload, user, db)
    row = PreparationPlan(
        user_id=user.id,
        streamer_id=streamer.id,
        platform_account_id=payload.platform_account_id,
        topic=payload.topic,
        duration_minutes=payload.duration_minutes,
        goal=payload.goal,
        live_form=payload.live_form,
        has_cohost=payload.has_cohost,
        has_ecommerce=payload.has_ecommerce,
        special_notes=payload.special_notes,
        plan_json=json.dumps(plan, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_prepare_plan(row)


@router.patch("/prepare-plans/{plan_id}")
def update_prepare_plan(
    plan_id: int,
    payload: PreparePlanUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.get(PreparationPlan, plan_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="开播方案不存在")
    data = payload.model_dump(exclude_unset=True)
    for key in ["topic", "duration_minutes", "goal", "live_form", "special_notes"]:
        if key in data and data[key] is not None:
            setattr(row, key, data[key])
    if "plan" in data and data["plan"] is not None:
        row.plan_json = json.dumps(data["plan"], ensure_ascii=False)
    db.commit()
    db.refresh(row)
    return serialize_prepare_plan(row)


@router.post("/prepare-plans/{plan_id}/mark-used")
def mark_prepare_plan_used(plan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    row = db.get(PreparationPlan, plan_id)
    if not row or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="开播方案不存在")
    row.is_used = True
    row.used_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "message": "已标记为使用过。"}


def ensure_owned_session(session_id: int, user: User, db: Session) -> LiveSession:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    return session


def serialize_asset(asset: UploadedAsset) -> dict:
    return {
        "id": asset.id,
        "kind": asset.kind,
        "original_filename": asset.original_filename or asset.filename,
        "filename": asset.filename,
        "content_type": asset.content_type,
        "size_bytes": asset.size_bytes,
        "display_order": asset.display_order,
        "status": asset.status,
        "error_message": asset.error_message,
        "created_at": asset.created_at.isoformat(),
    }


def save_screenshot_file(file: UploadFile, *, user_id: int, session_id: int, display_order: int) -> UploadedAsset:
    settings = get_settings()
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    allowed_suffixes = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    original_filename = file.filename or "screenshot.png"
    suffix = Path(original_filename).suffix.lower()
    if file.content_type not in allowed_types or suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail="请上传 PNG、JPG、WEBP 或 GIF 格式的截图")

    filename = safe_storage_filename(original_filename)
    target_dir = Path(settings.upload_dir) / str(user_id) / str(session_id) / "screenshots"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    size = 0
    try:
        with target.open("wb") as buffer:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_screenshot_upload_bytes:
                    buffer.close()
                    target.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail=f"截图过大，请上传 {settings.max_screenshot_upload_mb}MB 以内的图片")
                buffer.write(chunk)
    except HTTPException:
        raise
    except OSError:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="截图保存失败，请稍后重试") from None
    finally:
        file.file.close()

    if size == 0:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="图片为空，请重新选择")

    return UploadedAsset(
        live_session_id=session_id,
        kind="screenshot",
        original_filename=original_filename,
        filename=filename,
        path=str(target),
        content_type=file.content_type or "",
        size_bytes=size,
        display_order=display_order,
        status="uploaded",
    )


def active_session_screenshots(db: Session, session_id: int) -> list[UploadedAsset]:
    return db.scalars(
        select(UploadedAsset)
        .where(
            UploadedAsset.live_session_id == session_id,
            UploadedAsset.kind == "screenshot",
            UploadedAsset.status != "deleted",
        )
        .order_by(UploadedAsset.display_order, UploadedAsset.id)
    ).all()


def serialize_job(job: AnalysisJob) -> dict:
    return {
        "id": job.id,
        "live_session_id": job.live_session_id,
        "uploaded_asset_id": job.uploaded_asset_id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "error_message": job.error_message,
        "retry_count": job.retry_count,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat() if job.updated_at else job.created_at.isoformat(),
    }


def serialize_growth_task(task: GrowthTask) -> dict:
    return {
        "id": task.id,
        "live_session_id": task.live_session_id,
        "action": task.action,
        "status": task.status,
        "remark": task.remark,
        "improvement": task.improvement,
        "created_at": task.created_at.isoformat(),
    }


@router.get("/growth-tasks")
def list_growth_tasks(
    live_session_id: Optional[int] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    query = select(GrowthTask).where(GrowthTask.user_id == user.id)
    if live_session_id:
        query = query.where(GrowthTask.live_session_id == live_session_id)
    rows = db.scalars(query.order_by(GrowthTask.id.desc()).limit(20)).all()
    return {"items": [serialize_growth_task(row) for row in rows]}


@router.patch("/growth-tasks/{task_id}")
def update_growth_task(
    task_id: int,
    payload: GrowthTaskUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    task = db.get(GrowthTask, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="任务不存在")
    task.status = payload.status
    task.remark = payload.remark
    task.improvement = "等待下一场验证" if payload.status in ["已执行", "部分执行"] else "未执行，下一场继续观察"
    db.commit()
    db.refresh(task)
    return serialize_growth_task(task)


@router.get("/streamers/{streamer_id}/latest-growth-tasks")
def latest_streamer_growth_tasks(
    streamer_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    streamer = db.get(Streamer, streamer_id)
    if not streamer or streamer.user_id != user.id:
        raise HTTPException(status_code=404, detail="主播不存在")
    session = db.scalar(
        select(LiveSession)
        .where(LiveSession.user_id == user.id, LiveSession.streamer_id == streamer_id, LiveSession.status == "reported")
        .order_by(LiveSession.id.desc())
    )
    if not session:
        return {"session": None, "items": []}
    rows = db.scalars(
        select(GrowthTask)
        .where(GrowthTask.user_id == user.id, GrowthTask.live_session_id == session.id)
        .order_by(GrowthTask.id.asc())
    ).all()
    return {
        "session": {"id": session.id, "title": session.title, "created_at": session.created_at.isoformat()},
        "items": [serialize_growth_task(row) for row in rows],
    }


def serialize_audio_chunk(chunk: AudioChunk) -> dict:
    return {
        "id": chunk.id,
        "analysis_job_id": chunk.analysis_job_id,
        "uploaded_asset_id": chunk.uploaded_asset_id,
        "chunk_index": chunk.chunk_index,
        "start_seconds": chunk.start_seconds,
        "end_seconds": chunk.end_seconds,
        "status": chunk.status,
        "created_at": chunk.created_at.isoformat(),
    }


def serialize_transcript_segment(segment: TranscriptSegment) -> dict:
    return {
        "id": segment.id,
        "analysis_job_id": segment.analysis_job_id,
        "audio_chunk_id": segment.audio_chunk_id,
        "chunk_index": segment.chunk_index,
        "start_seconds": segment.start_seconds,
        "end_seconds": segment.end_seconds,
        "text": segment.text,
        "speaker": segment.speaker,
        "confidence": segment.confidence,
        "source_file": segment.source_file,
        "source": segment.source,
        "created_at": segment.created_at.isoformat(),
    }


def serialize_content_analysis(row: ContentAnalysis) -> dict:
    data = json.loads(row.analysis_json)
    data["id"] = row.id
    data["analysis_job_id"] = row.analysis_job_id
    data["created_at"] = row.created_at.isoformat()
    return data


def serialize_speech_risk(risk: SpeechRisk) -> dict:
    return {
        "id": risk.id,
        "analysis_job_id": risk.analysis_job_id,
        "transcript_segment_id": risk.transcript_segment_id,
        "time_seconds": risk.time_seconds,
        "original_text": risk.original_text,
        "risk_type": risk.risk_type,
        "risk_level": risk.risk_level,
        "reason": risk.reason,
        "rewrite": risk.rewrite,
        "needs_human_review": risk.needs_human_review,
        "source": risk.source,
        "created_at": risk.created_at.isoformat(),
    }


def serialize_recognized_field(field: RecognizedMetricField) -> dict:
    return {
        "id": field.id,
        "metric_key": field.metric_key,
        "label": field.label,
        "group": metric_group(field.metric_key),
        "raw_value": field.raw_value,
        "normalized_value": field.normalized_value,
        "unit": field.unit,
        "source_screenshot_id": field.uploaded_asset_id,
        "source_screenshot_type": field.source_screenshot_type,
        "raw_text": field.raw_text,
        "confidence": field.confidence,
        "is_manually_confirmed": field.is_manually_confirmed,
        "manual_value": field.manual_value,
        "final_value": field.final_value,
        "unreadable_reason": field.unreadable_reason,
        "has_conflict": field.has_conflict,
        "source": field.source,
        "recognized_at": field.recognized_at.isoformat(),
    }


def metric_group(metric_key: str) -> str:
    groups = {
        "live_date": "核心数据",
        "live_start_time": "核心数据",
        "duration_minutes": "核心数据",
        "is_paid_traffic": "核心数据",
        "total_viewers": "流量",
        "peak_online": "流量",
        "average_online": "流量",
        "impressions": "流量",
        "room_entries": "流量",
        "entry_rate": "流量",
        "recommend_traffic_ratio": "流量",
        "follow_page_traffic_ratio": "流量",
        "fan_traffic_ratio": "流量",
        "other_traffic_sources": "流量",
        "average_stay_seconds": "停留",
        "per_capita_watch_seconds": "停留",
        "one_minute_retention": "停留",
        "comments": "互动",
        "likes": "互动",
        "shares": "互动",
        "call_in_count": "互动",
        "fan_club_count": "互动",
        "new_followers": "关注",
        "view_follow_rate": "关注",
        "new_fans": "关注",
        "fan_growth": "关注",
        "new_old_user_ratio": "用户画像",
        "fan_nonfan_ratio": "用户画像",
        "gender_distribution": "用户画像",
        "age_distribution": "用户画像",
        "region_distribution": "用户画像",
        "product_impressions": "成交",
        "product_clicks": "成交",
        "buyers": "成交",
        "orders": "成交",
        "gmv": "成交",
        "click_rate": "成交",
        "conversion_rate": "成交",
        "has_violation": "合规",
        "violation_type": "合规",
        "violation_text": "合规",
        "violation_result": "合规",
    }
    return groups.get(metric_key, "核心数据")


def select_model_setting(user: User, purpose: str, db: Session) -> Optional[ModelSetting]:
    default_setting = db.scalar(
        select(ModelSetting).where(
            ModelSetting.user_id == user.id,
            ModelSetting.purpose == purpose,
            ModelSetting.is_active,
            ModelSetting.is_default,
        )
    )
    if default_setting:
        return default_setting
    return db.scalar(
        select(ModelSetting)
        .where(ModelSetting.user_id == user.id, ModelSetting.purpose == purpose, ModelSetting.is_active)
        .order_by(ModelSetting.id.desc())
    )


def model_config_from_setting(setting: ModelSetting) -> ChatModelConfig:
    settings = get_settings()
    if setting.mode == "platform" and setting.purpose == "图片识别":
        return ChatModelConfig(
            api_base=settings.platform_vision_api_base,
            api_key=settings.platform_vision_api_key,
            model_name=settings.platform_vision_model,
            timeout_seconds=setting.timeout_seconds,
            max_retries=setting.max_retries,
            source="platform_vision",
        )
    if setting.mode == "platform":
        return ChatModelConfig(
            api_base=settings.platform_text_api_base,
            api_key=settings.platform_text_api_key,
            model_name=settings.platform_text_model,
            timeout_seconds=setting.timeout_seconds,
            max_retries=setting.max_retries,
            source="platform_text",
        )
    return ChatModelConfig(
        api_base=setting.api_base,
        api_key=decrypt_secret(setting.api_key_encrypted),
        model_name=setting.model_name,
        timeout_seconds=setting.timeout_seconds,
        max_retries=setting.max_retries,
        source=f"custom_{setting.purpose}",
    )


def test_vision_connection(config: ChatModelConfig) -> dict:
    transparent_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    payload = request_openai_compatible_chat(
        api_base=config.api_base,
        api_key=config.api_key,
        model_name=config.model_name,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "请识别这张测试图，并只返回 JSON："
                            "{\"screenshots\":[{\"type\":\"无法识别\",\"reason\":\"测试图\",\"confidence\":1}],"
                            "\"metrics\":[{\"metric_key\":\"total_viewers\",\"raw_value\":null,\"confidence\":1}]}"
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{transparent_png}"}},
                ],
            }
        ],
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
        response_format={"type": "json_object"},
    )
    parse_json_response(payload)
    return payload


def build_report_history(user: User, current_session_id: int, db: Session) -> list[dict]:
    sessions = db.scalars(
        select(LiveSession)
        .where(LiveSession.user_id == user.id, LiveSession.id != current_session_id)
        .order_by(LiveSession.id.desc())
        .limit(3)
    ).all()
    rows = []
    for item in sessions:
        metrics = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == item.id))
        report = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == item.id))
        metric_data = json.loads(metrics.metrics_json) if metrics else {}
        report_data = json.loads(report.report_json) if report else {}
        rows.append(
            {
                "session_id": item.id,
                "title": item.title,
                "created_at": item.created_at.isoformat(),
                "total_viewers": metric_data.get("total_viewers"),
                "average_online": metric_data.get("average_online"),
                "average_stay_seconds": metric_data.get("average_stay_seconds"),
                "comments": metric_data.get("comments"),
                "new_followers": metric_data.get("new_followers"),
                "previous_actions": report_data.get("next_actions", []),
            }
        )
    return rows


def build_history_comparison(metrics: MetricsConfirm, history: list[dict]) -> dict:
    metric_labels = {
        "total_viewers": "累计观看",
        "peak_online": "最高在线",
        "average_online": "平均在线",
        "average_stay_seconds": "平均停留",
        "comments": "评论数",
        "new_followers": "新增关注",
    }
    current = metrics.model_dump()
    previous = history[0] if history else {}
    recent = history[:3]
    improved = []
    declined = []
    stable = []
    previous_compare = {}
    recent_compare = {}
    for key, label in metric_labels.items():
        current_value = current.get(key)
        previous_value = previous.get(key)
        if current_value is not None and previous_value not in (None, ""):
            diff = int(current_value) - int(previous_value)
            previous_compare[key] = {"label": label, "current": current_value, "previous": previous_value, "diff": diff}
            if diff > 0:
                improved.append(label)
            elif diff < 0:
                declined.append(label)
            else:
                stable.append(label)
        values = [int(item[key]) for item in recent if item.get(key) not in (None, "")]
        if current_value is not None and values:
            average = round(sum(values) / len(values), 1)
            recent_compare[key] = {
                "label": label,
                "current": current_value,
                "recent_average": average,
                "diff": round(float(current_value) - average, 1),
            }
    return {
        "has_history": bool(history),
        "previous": previous_compare,
        "recent_average": recent_compare,
        "improved_metrics": improved,
        "declined_metrics": declined,
        "stable_metrics": stable,
        "repeated_issues": [],
        "previous_actions": previous.get("previous_actions", []),
        "limitation": "" if history else "当前缺少历史场次，本次主要根据单场数据分析。",
    }


PROMPT_VERSION = "review_rules_v1"


def rule_is_effective(rule: RuleEntry) -> bool:
    today = datetime.utcnow().date().isoformat()
    if rule.status != "已生效":
        return False
    if rule.effective_at and rule.effective_at > today:
        return False
    if rule.expires_at and rule.expires_at < today:
        return False
    return True


def rule_priority(rule: RuleEntry) -> int:
    order = {"平台官方规则": 0, "主播个人提醒": 1, "系统提示": 2, "运营经验": 3}
    return order.get(rule.rule_type, 9)


def select_relevant_rules(user: User, session: LiveSession, metrics: MetricsConfirm, db: Session, limit: int = 8) -> list[dict]:
    streamer = db.get(Streamer, session.streamer_id)
    live_forms = json.loads(streamer.live_forms) if streamer else []
    keywords = {
        metrics.session_topic,
        metrics.main_goal,
        metrics.violation_note,
        "违规" if metrics.has_violation else "",
        streamer.direction if streamer else "",
        *live_forms,
    }
    keywords = {item for item in keywords if item}
    rows = db.scalars(select(RuleEntry).order_by(RuleEntry.id.desc())).all()
    candidates = []
    for rule in rows:
        if not rule_is_effective(rule):
            continue
        public = rule.rule_type in ["平台官方规则", "运营经验", "系统提示"]
        personal = rule.rule_type == "主播个人提醒" and rule.user_id == user.id
        if not public and not personal:
            continue
        if rule.scope_type == "某个主播" and rule.scope_value and rule.scope_value != str(session.streamer_id):
            continue
        if rule.scope_type == "某类主播" and streamer and rule.scope_value and rule.scope_value != streamer.direction:
            continue
        if rule.scope_type == "某种直播形式" and rule.scope_value and rule.scope_value not in live_forms:
            continue
        interpretation = latest_rule_interpretation(db, rule.id)
        version = latest_rule_version(db, rule.id)
        haystack = " ".join(
            [
                rule.title,
                rule.raw_content,
                interpretation.summary if interpretation else "",
                " ".join(parse_json_list(interpretation.keywords)) if interpretation else "",
            ]
        )
        matched = [word for word in keywords if word and word in haystack]
        if not matched and rule.rule_type != "系统提示" and not metrics.has_violation:
            continue
        candidates.append(
            {
                "id": rule.id,
                "version_id": version.id if version else 0,
                "version_number": version.version_number if version else 1,
                "title": rule.title,
                "rule_type": rule.rule_type,
                "source_name": rule.source_name,
                "summary": interpretation.summary if interpretation else rule.raw_content[:120],
                "risk_level": rule.risk_level,
                "keywords": parse_json_list(interpretation.keywords) if interpretation else [],
                "recommended_actions": parse_json_list(interpretation.recommended_actions) if interpretation else [],
                "reason_used": "、".join(matched) if matched else ("违规提示相关" if metrics.has_violation else "系统提示"),
                "priority": rule_priority(rule),
            }
        )
    candidates.sort(key=lambda item: (item["priority"], -item["version_number"], item["id"]))
    return candidates[:limit]


def build_report_context(
    *,
    user: User,
    session: LiveSession,
    metrics: MetricsConfirm,
    report_type: str,
    temporary_instruction: str,
    db: Session,
) -> dict:
    streamer = db.get(Streamer, session.streamer_id)
    confirmed_fields = db.scalars(
        select(RecognizedMetricField).where(
            RecognizedMetricField.live_session_id == session.id,
            RecognizedMetricField.is_manually_confirmed.is_(True),
        )
    ).all()
    history = build_report_history(user, session.id, db)
    history_comparison = build_history_comparison(metrics, history)
    diagnostics = run_rule_diagnostics(metrics, history)
    relevant_rules = select_relevant_rules(user, session, metrics, db)
    return {
        "report_type": report_type,
        "streamer": {
            "name": streamer.name if streamer else "",
            "direction": streamer.direction if streamer else "",
            "live_forms": json.loads(streamer.live_forms) if streamer else [],
            "notes": streamer.notes if streamer else "",
        },
        "session": {
            "id": session.id,
            "title": session.title,
            "created_at": session.created_at.isoformat(),
        },
        "confirmed_metrics": metrics.model_dump(),
        "streamer_background": {
            "本场直播主题": metrics.session_topic,
            "本场最想解决的问题": metrics.main_goal,
            "是否投流": metrics.has_paid_promotion,
            "是否连麦": metrics.has_cohost,
            "主播自评": metrics.self_review,
            "设备网络或其他异常": metrics.abnormal_notes,
        },
        "confirmed_fields": [serialize_recognized_field(field) for field in confirmed_fields],
        "history": history,
        "history_comparison": history_comparison,
        "diagnostics": diagnostics,
        "rules": {
            "selection_policy": "仅传入当前有效且与主播、主题、直播形式、违规提示或系统提示相关的规则。",
            "priority": ["平台官方规则", "主播个人提醒", "系统提示", "运营经验"],
            "items": relevant_rules,
            "temporary_instruction": temporary_instruction,
        },
        "limits": [
            "当前仅根据后台截图和用户确认数据分析。",
            "缺少直播录像、录音或逐字稿时，不得判断具体某分钟发生了什么。",
            "不得编造主播具体说过的话、冷场时间点、连麦问题或精确因果关系。",
        ],
    }


def report_prompt(context: dict) -> str:
    return (
        "你是谨慎的直播运营复盘助手。请基于给定 JSON 生成直播复盘报告，必须返回严格 JSON。"
        "必须区分后台数据事实、主播自己的描述、系统规则诊断、AI推断、可能原因、需要主播补充的信息。"
        "引用规则时必须说明依据类型：平台官方规则、此前违规提醒、系统提示或运营经验。"
        "不得把运营经验写成官方要求；没有官方来源时不得使用“平台明确规定”。"
        "只有截图数据时，不得编造具体话术、具体冷场时间、具体连麦问题或精确因果关系。"
        "数据不足时允许只输出 1 到 2 个 issues，不要为了凑数编造问题。"
        "输出结构："
        "{\"summary\":\"一句话结论\",\"main_problem\":\"最大问题\",\"strength\":\"最大优势\","
        "\"next_actions\":[\"三个具体动作\"],"
        "\"issues\":[{\"title\":\"问题\",\"evidence\":\"数据事实\",\"reason\":\"可能原因，注明推断限制\","
        "\"fix\":\"下一场怎么改\",\"script\":\"主播可直接说的话\",\"target\":\"验证指标\"}],"
        "\"details\":{\"数据完整度\":\"...\",\"流量分析\":\"...\",\"停留分析\":\"...\",\"互动分析\":\"...\","
        "\"关注分析\":\"...\",\"用户画像\":\"...\",\"转化分析\":\"...\",\"合规情况\":\"...\",\"历史对比\":\"...\",\"结论限制\":\"...\"},"
        "\"next_plan\":{\"recommended_theme\":\"首选主题\",\"backup_themes\":[\"备选1\",\"备选2\"],"
        "\"titles\":[\"5条合规标题\"],\"opening_3_minutes\":\"开场3分钟话术\","
        "\"interaction_nodes\":[\"3个互动节点\"],\"follow_prompts\":[\"2个关注引导\"],"
        "\"new_traffic_script\":\"新流量承接话术\",\"goals\":[\"3个目标\"],"
        "\"goal_metrics\":[\"每个目标的验证指标\"],\"watch_metrics\":[\"开播后重点观察的数据\"]},"
        "\"rule_notes\":[{\"type\":\"规则类型\",\"title\":\"规则标题\",\"usage\":\"如何影响本报告\"}]}"
        "}。"
        f"上下文 JSON：{json.dumps(context, ensure_ascii=False)}"
    )


def normalize_report(report: dict, fallback: dict, context: dict, source: str) -> dict:
    normalized = {**fallback, **{key: value for key, value in report.items() if value not in (None, "", [], {})}}
    normalized["source"] = source
    normalized["diagnostics"] = context["diagnostics"]
    normalized["analysis_limits"] = context["limits"]
    normalized["history_comparison"] = context["history_comparison"]
    normalized["streamer_background"] = context["streamer_background"]
    normalized["rule_snapshot"] = context["rules"]["items"]
    normalized["temporary_instruction"] = context["rules"]["temporary_instruction"]
    normalized["prompt_version"] = PROMPT_VERSION
    normalized["generated_at"] = datetime.utcnow().isoformat()
    normalized.setdefault("details", {})
    normalized.setdefault("next_plan", fallback["next_plan"])
    normalized["next_actions"] = list(normalized.get("next_actions", []))[:3]
    while len(normalized["next_actions"]) < 3:
        normalized["next_actions"].append(fallback["next_actions"][len(normalized["next_actions"])])
    normalized["issues"] = list(normalized.get("issues", []))[:3]
    if not normalized["issues"]:
        normalized["issues"] = fallback["issues"][:1]
    return normalized


def report_quality_errors(report: dict, metrics: MetricsConfirm) -> list[str]:
    errors = []
    if len(report.get("next_actions", [])) < 3:
        errors.append("缺少三个具体动作")
    if len(report.get("issues", [])) < 3:
        errors.append("缺少三个核心问题")
    for issue in report.get("issues", []):
        if not issue.get("target"):
            errors.append("缺少验证指标")
    banned = ["保证涨粉", "保证流量", "绝不违规", "一定爆"]
    text = json.dumps(report, ensure_ascii=False)
    if any(word in text for word in banned):
        errors.append("包含结果保证")
    known_numbers = [
        str(value)
        for value in [metrics.total_viewers, metrics.peak_online, metrics.average_online, metrics.comments, metrics.new_followers]
        if value not in (None, 0)
    ]
    if known_numbers and not any(number in text for number in known_numbers):
        errors.append("未引用已确认数据")
    vague = ["加强互动", "优化话术", "提升内容质量"]
    if any(word in text for word in vague):
        errors.append("包含空泛建议")
    return errors


def build_text_model_report(
    *,
    user: User,
    session: LiveSession,
    payload: ReportRequest,
    db: Session,
) -> dict:
    fallback = MockReviewCoach().build_report(payload.metrics)
    context = build_report_context(
        user=user,
        session=session,
        metrics=payload.metrics,
        report_type=payload.report_type,
        temporary_instruction=payload.temporary_instruction,
        db=db,
    )
    setting = select_model_setting(user, "文字分析", db)
    if not setting or setting.mode == "mock":
        report = normalize_report(fallback, fallback, context, "mock")
        report["model_name"] = "mock"
        report["quality_errors"] = report_quality_errors(report, payload.metrics)
        return report
    config = model_config_from_setting(setting)

    def generate_with_model(extra_instruction: str = "") -> dict:
        started_at = time.time()
        response = request_openai_compatible_chat(
            api_base=config.api_base,
            api_key=config.api_key,
            model_name=config.model_name,
            messages=[{"role": "user", "content": report_prompt(context) + extra_instruction}],
            timeout_seconds=config.timeout_seconds,
            max_retries=config.max_retries,
            response_format={"type": "json_object"},
        )
        save_model_call_log(
            db=db,
            user=user,
            live_session_id=session.id,
            task_type="text_report_generation",
            setting=setting,
            model_name=config.model_name,
            started_at=started_at,
            success=True,
            usage=response.get("usage", {}),
        )
        report = normalize_report(parse_json_response(response), fallback, context, "text_model")
        report["model_name"] = config.model_name
        return report

    try:
        report = generate_with_model()
        errors = report_quality_errors(report, payload.metrics)
        if errors:
            report = generate_with_model(
                "\n上一次报告质量校验未通过，问题包括："
                f"{'、'.join(errors)}。请重新生成，必须引用已确认数据，给出三个具体动作和验证指标，"
                "不得使用空泛建议或承诺平台结果。"
            )
    except ModelAdapterError as exc:
        failed_started_at = time.time()
        save_model_call_log(
            db=db,
            user=user,
            live_session_id=session.id,
            task_type="text_report_generation",
            setting=setting,
            model_name=config.model_name,
            started_at=failed_started_at,
            success=False,
            error_type=exc.error_type,
        )
        report = normalize_report(fallback, fallback, context, "mock_text_fallback")
        report["model_name"] = config.model_name
        report["model_error"] = exc.message

    errors = report_quality_errors(report, payload.metrics)
    if errors and report.get("source") == "text_model":
        report["needs_human_review"] = True
        report["quality_errors"] = errors
    else:
        report["quality_errors"] = errors
    return report


def build_vision_analyzer(setting: Optional[ModelSetting]):
    settings = get_settings()
    if not setting:
        return None, None
    if setting.mode == "mock":
        return MockVisionAnalyzer(), None
    if setting.mode == "platform":
        if not settings.platform_vision_api_base or not settings.platform_vision_api_key or not settings.platform_vision_model:
            return None, None
        return (
            OpenAICompatibleVisionAnalyzer(
                VisionModelConfig(
                    api_base=settings.platform_vision_api_base,
                    api_key=settings.platform_vision_api_key,
                    model_name=settings.platform_vision_model,
                    timeout_seconds=setting.timeout_seconds,
                    max_retries=setting.max_retries,
                    source="platform_vision",
                )
            ),
            setting,
        )
    return (
        OpenAICompatibleVisionAnalyzer(
            VisionModelConfig(
                api_base=setting.api_base,
                api_key=decrypt_secret(setting.api_key_encrypted),
                model_name=setting.model_name,
                timeout_seconds=setting.timeout_seconds,
                max_retries=setting.max_retries,
                source="custom_vision",
            )
        ),
        setting,
    )


def save_model_call_log(
    *,
    db: Session,
    user: User,
    live_session_id: Optional[int],
    task_type: str,
    setting: Optional[ModelSetting],
    model_name: str,
    started_at: float,
    success: bool,
    usage: Optional[dict] = None,
    error_type: str = "",
) -> None:
    db.add(
        ModelCallLog(
            user_id=user.id,
            live_session_id=live_session_id,
            task_type=task_type,
            model_setting_id=setting.id if setting else None,
            model_name=model_name,
            duration_ms=int((time.time() - started_at) * 1000),
            success=success,
            usage_json=json.dumps(usage or {}, ensure_ascii=False),
            error_type=error_type,
        )
    )


def persist_recognition(db: Session, session_id: int, recognition: dict) -> None:
    stale_screenshots = db.scalars(
        select(ScreenshotRecognition).where(
            ScreenshotRecognition.live_session_id == session_id,
            ScreenshotRecognition.is_manually_confirmed.is_(False),
        )
    ).all()
    for row in stale_screenshots:
        db.delete(row)
    stale_fields = db.scalars(
        select(RecognizedMetricField).where(
            RecognizedMetricField.live_session_id == session_id,
            RecognizedMetricField.is_manually_confirmed.is_(False),
        )
    ).all()
    for row in stale_fields:
        db.delete(row)

    for item in recognition["screenshots"]:
        db.add(
            ScreenshotRecognition(
                live_session_id=session_id,
                uploaded_asset_id=item["asset_id"] or 0,
                screenshot_type=item["type"],
                reason=item["reason"],
                confidence=item["confidence"],
                source=recognition["source"],
            )
        )
    for item in recognition["fields"]:
        db.add(
            RecognizedMetricField(
                live_session_id=session_id,
                metric_key=item["metric_key"],
                label=item["label"],
                raw_value=item["raw_value"],
                normalized_value="" if item["normalized_value"] is None else str(item["normalized_value"]),
                unit=item["unit"],
                uploaded_asset_id=item["source_screenshot_id"] or 0,
                source_screenshot_type=item["source_screenshot_type"],
                raw_text=item["raw_text"],
                confidence=item["confidence"],
                final_value="" if item["final_value"] is None else str(item["final_value"]),
                unreadable_reason=item["unreadable_reason"],
                has_conflict=item["has_conflict"],
                source=recognition["source"],
            )
        )


@router.post("/live-sessions/{session_id}/screenshots")
def upload_screenshots(
    session_id: int,
    files: list[UploadFile] = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = ensure_owned_session(session_id, user, db)
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一张截图")

    next_order = (
        db.scalar(
            select(func.coalesce(func.max(UploadedAsset.display_order), 0)).where(
                UploadedAsset.live_session_id == session_id,
                UploadedAsset.kind == "screenshot",
            )
        )
        or 0
    )
    for file in files:
        next_order += 1
        asset = save_screenshot_file(file, user_id=user.id, session_id=session_id, display_order=next_order)
        db.add(asset)
        db.flush()

    setting = select_model_setting(user, "图片识别", db)
    analyzer, effective_setting = build_vision_analyzer(setting)
    assets = [
        {
            "id": asset.id,
            "original_filename": asset.original_filename,
            "filename": asset.filename,
            "path": asset.path,
            "content_type": asset.content_type,
        }
        for asset in active_session_screenshots(db, session_id)
    ]
    started_at = time.time()
    try:
        if analyzer is None:
            recognition = manual_required_recognition()
        else:
            recognition = analyzer.recognize_assets(assets)
            if isinstance(analyzer, MockVisionAnalyzer):
                recognition["notice"] = "当前使用模拟识别结果，仅用于功能演示。"
        save_model_call_log(
            db=db,
            user=user,
            live_session_id=session_id,
            task_type="screenshot_recognition",
            setting=effective_setting,
            model_name=getattr(getattr(analyzer, "config", None), "model_name", getattr(analyzer, "source", "manual_required")),
            started_at=started_at,
            success=True,
        )
    except ModelAdapterError as exc:
        save_model_call_log(
            db=db,
            user=user,
            live_session_id=session_id,
            task_type="screenshot_recognition",
            setting=effective_setting,
            model_name=getattr(getattr(analyzer, "config", None), "model_name", getattr(analyzer, "source", "manual_required")),
            started_at=started_at,
            success=False,
            error_type=exc.error_type,
        )
        fallback_started_at = time.time()
        recognition = manual_required_recognition(
            f"图片识别模型暂时不可用，请手动录入关键数据，或稍后配置可用视觉模型。失败原因：{exc.message}"
        )
        save_model_call_log(
            db=db,
            user=user,
            live_session_id=session_id,
            task_type="screenshot_recognition_fallback",
            setting=None,
            model_name="manual_required",
            started_at=fallback_started_at,
            success=True,
        )

    existing = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == session_id))
    existing_data = json.loads(existing.metrics_json) if existing else {}
    recognized = {
        **flatten_metrics_for_confirm(recognition),
        **recognition,
        "screenshot_types": recognition["screenshots"],
    }
    for key in [
        "live_date",
        "session_topic",
        "main_goal",
        "has_paid_promotion",
        "has_cohost",
        "self_review",
        "abnormal_notes",
    ]:
        if existing_data.get(key) not in [None, ""]:
            recognized[key] = existing_data[key]
    persist_recognition(db, session_id, recognition)
    if existing:
        existing.metrics_json = json.dumps(recognized, ensure_ascii=False)
        existing.source = recognition["source"]
    else:
        db.add(
            RecognizedMetrics(
                live_session_id=session_id,
                metrics_json=json.dumps(recognized, ensure_ascii=False),
                source=recognition["source"],
            )
        )
    session.status = "metrics_recognized"
    db.commit()
    return {"recognized": recognized, "assets": [serialize_asset(asset) for asset in active_session_screenshots(db, session_id)]}


@router.get("/live-sessions/{session_id}/screenshots")
def list_screenshots(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    ensure_owned_session(session_id, user, db)
    return {"items": [serialize_asset(asset) for asset in active_session_screenshots(db, session_id)]}


@router.put("/live-sessions/{session_id}/screenshots/order")
def reorder_screenshots(
    session_id: int,
    payload: ScreenshotOrderUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_owned_session(session_id, user, db)
    assets = active_session_screenshots(db, session_id)
    by_id = {asset.id: asset for asset in assets}
    if len(payload.asset_ids) != len(by_id) or set(payload.asset_ids) != set(by_id):
        raise HTTPException(status_code=400, detail="截图顺序数据不完整，请刷新后重试")
    for index, asset_id in enumerate(payload.asset_ids, start=1):
        by_id[asset_id].display_order = index
    db.commit()
    return {"items": [serialize_asset(asset) for asset in active_session_screenshots(db, session_id)]}


@router.delete("/live-sessions/{session_id}/screenshots/{asset_id}")
def delete_screenshot(
    session_id: int,
    asset_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_owned_session(session_id, user, db)
    asset = db.get(UploadedAsset, asset_id)
    if not asset or asset.live_session_id != session_id or asset.kind != "screenshot" or asset.status == "deleted":
        raise HTTPException(status_code=404, detail="截图不存在")
    asset.status = "deleted"
    db.query(ScreenshotRecognition).filter(
        ScreenshotRecognition.live_session_id == session_id,
        ScreenshotRecognition.uploaded_asset_id == asset_id,
        ScreenshotRecognition.is_manually_confirmed.is_(False),
    ).delete(synchronize_session=False)
    db.query(RecognizedMetricField).filter(
        RecognizedMetricField.live_session_id == session_id,
        RecognizedMetricField.uploaded_asset_id == asset_id,
        RecognizedMetricField.is_manually_confirmed.is_(False),
    ).delete(synchronize_session=False)
    Path(asset.path).unlink(missing_ok=True)
    db.commit()
    return {"ok": True, "items": [serialize_asset(item) for item in active_session_screenshots(db, session_id)]}


@router.post("/live-sessions/{session_id}/media")
def upload_media(
    session_id: int,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    session = ensure_owned_session(session_id, user, db)
    stored = get_storage().save_upload(
        file,
        user_id=user.id,
        session_id=session_id,
        max_bytes=settings.max_media_upload_bytes,
    )

    asset = UploadedAsset(
        live_session_id=session_id,
        kind=stored.kind,
        original_filename=stored.original_filename,
        filename=stored.filename,
        path=stored.path,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
        status="uploaded",
    )
    db.add(asset)
    db.flush()

    existing_job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.uploaded_asset_id == asset.id,
            AnalysisJob.job_type == "media_content_analysis",
        )
    )
    job = existing_job or AnalysisJob(
        user_id=user.id,
        live_session_id=session_id,
        uploaded_asset_id=asset.id,
        status="waiting",
        progress=0,
        message="音视频已上传，等待处理",
    )
    db.add(job)
    session.status = "media_uploaded"
    db.commit()
    db.refresh(asset)
    db.refresh(job)
    return {
        "asset": serialize_asset(asset),
        "job": serialize_job(job),
        "next_step": "已创建处理任务，稍后将进行音频提取和内容分析。",
    }


@router.get("/live-sessions/{session_id}/media")
def list_media_assets(
    session_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    ensure_owned_session(session_id, user, db)
    assets = db.scalars(
        select(UploadedAsset)
        .where(UploadedAsset.live_session_id == session_id, UploadedAsset.kind.in_(["video", "audio"]))
        .order_by(UploadedAsset.id.desc())
    ).all()
    jobs = db.scalars(select(AnalysisJob).where(AnalysisJob.live_session_id == session_id)).all()
    jobs_by_asset = {job.uploaded_asset_id: job for job in jobs}
    return {
        "items": [
            {
                **serialize_asset(asset),
                "job": serialize_job(jobs_by_asset[asset.id]) if asset.id in jobs_by_asset else None,
            }
            for asset in assets
        ]
    }


@router.get("/analysis-jobs/{job_id}")
def get_analysis_job(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    return serialize_job(job)


@router.post("/analysis-jobs/{job_id}/retry")
def retry_analysis_job(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    if job.status not in ["failed", "cancelled"]:
        raise HTTPException(status_code=400, detail="当前任务不需要重试")
    job.status = "waiting"
    job.progress = 0
    job.message = "已重新加入处理队列"
    job.error_message = ""
    job.retry_count += 1
    job.updated_at = datetime.utcnow()
    asset = db.get(UploadedAsset, job.uploaded_asset_id)
    if asset:
        asset.status = "uploaded"
        asset.error_message = ""
    db.commit()
    db.refresh(job)
    return serialize_job(job)


@router.post("/analysis-jobs/{job_id}/process-media")
def process_media_job(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    asset = db.get(UploadedAsset, job.uploaded_asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="上传文件不存在")

    existing_chunks = db.scalars(
        select(AudioChunk).where(AudioChunk.analysis_job_id == job.id).order_by(AudioChunk.chunk_index)
    ).all()
    if job.status == "completed" and existing_chunks:
        return {"job": serialize_job(job), "chunks": [serialize_audio_chunk(chunk) for chunk in existing_chunks]}

    job.status = "processing"
    job.progress = 10
    job.message = "正在提取和整理音频"
    job.error_message = ""
    job.updated_at = datetime.utcnow()
    asset.status = "processing"
    db.commit()

    try:
        chunk_plans = FFmpegProcessor(get_settings()).process_asset(asset, job_id=job.id)
    except MediaProcessingError as exc:
        job.status = "failed"
        job.progress = 0
        job.message = exc.message
        job.error_message = exc.install_hint or exc.message
        job.updated_at = datetime.utcnow()
        asset.status = "failed"
        asset.error_message = exc.message
        db.commit()
        db.refresh(job)
        return {"job": serialize_job(job), "chunks": [], "install_hint": exc.install_hint}

    for chunk in existing_chunks:
        db.delete(chunk)
    db.flush()
    chunks = [
        AudioChunk(
            analysis_job_id=job.id,
            uploaded_asset_id=asset.id,
            chunk_index=plan.chunk_index,
            start_seconds=plan.start_seconds,
            end_seconds=plan.end_seconds,
            path=plan.path,
            status="ready",
        )
        for plan in chunk_plans
    ]
    db.add_all(chunks)
    job.status = "completed"
    job.progress = 100
    job.message = "音频已整理完成"
    job.updated_at = datetime.utcnow()
    asset.status = "processed"
    db.commit()
    for chunk in chunks:
        db.refresh(chunk)
    db.refresh(job)
    return {"job": serialize_job(job), "chunks": [serialize_audio_chunk(chunk) for chunk in chunks]}


@router.get("/analysis-jobs/{job_id}/audio-chunks")
def list_audio_chunks(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    chunks = db.scalars(
        select(AudioChunk).where(AudioChunk.analysis_job_id == job.id).order_by(AudioChunk.chunk_index)
    ).all()
    return {"items": [serialize_audio_chunk(chunk) for chunk in chunks]}


@router.post("/analysis-jobs/{job_id}/transcribe")
def transcribe_audio_chunks(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")

    existing_segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.analysis_job_id == job.id).order_by(TranscriptSegment.start_seconds)
    ).all()
    if existing_segments:
        return {"segments": [serialize_transcript_segment(segment) for segment in existing_segments], "source": existing_segments[0].source}

    chunks = db.scalars(
        select(AudioChunk).where(AudioChunk.analysis_job_id == job.id).order_by(AudioChunk.chunk_index)
    ).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="请先完成音频整理，再开始转写")

    job.status = "processing"
    job.progress = max(job.progress, 60)
    job.message = "正在转写直播内容"
    job.updated_at = datetime.utcnow()
    db.commit()

    chunk_payload = [
        {
            "chunk_index": chunk.chunk_index,
            "start_seconds": chunk.start_seconds,
            "end_seconds": chunk.end_seconds,
            "path": chunk.path,
        }
        for chunk in chunks
    ]
    chunk_by_index = {chunk.chunk_index: chunk for chunk in chunks}
    results = MockASRTranscriber().transcribe(chunk_payload)
    segments = [
        TranscriptSegment(
            analysis_job_id=job.id,
            audio_chunk_id=chunk_by_index[result["chunk_index"]].id,
            chunk_index=result["chunk_index"],
            start_seconds=result["start_seconds"],
            end_seconds=result["end_seconds"],
            text=result["text"],
            speaker=result["speaker"],
            confidence=result["confidence"],
            source_file=result["source_file"],
            source=result["source"],
        )
        for result in results
    ]
    db.add_all(segments)
    job.status = "completed"
    job.progress = 100
    job.message = "直播内容已转写完成"
    job.updated_at = datetime.utcnow()
    db.commit()
    for segment in segments:
        db.refresh(segment)
    return {"segments": [serialize_transcript_segment(segment) for segment in segments], "source": "mock"}


@router.get("/analysis-jobs/{job_id}/transcript-segments")
def list_transcript_segments(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.analysis_job_id == job.id).order_by(TranscriptSegment.start_seconds)
    ).all()
    return {"items": [serialize_transcript_segment(segment) for segment in segments]}


@router.post("/analysis-jobs/{job_id}/content-analysis")
def create_content_analysis(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")

    existing = db.scalar(select(ContentAnalysis).where(ContentAnalysis.analysis_job_id == job.id))
    if existing:
        return serialize_content_analysis(existing)

    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.analysis_job_id == job.id).order_by(TranscriptSegment.start_seconds)
    ).all()
    if not segments:
        raise HTTPException(status_code=400, detail="请先完成直播内容转写，再开始内容分析")

    payload = [serialize_transcript_segment(segment) for segment in segments]
    analysis = MockContentAnalyzer().analyze(payload)
    row = ContentAnalysis(
        analysis_job_id=job.id,
        analysis_json=json.dumps(analysis, ensure_ascii=False),
        source=analysis["source"],
    )
    db.add(row)
    job.message = "内容分析已完成"
    job.progress = 100
    job.status = "completed"
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return serialize_content_analysis(row)


@router.get("/analysis-jobs/{job_id}/content-analysis")
def get_content_analysis(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    row = db.scalar(select(ContentAnalysis).where(ContentAnalysis.analysis_job_id == job.id))
    if not row:
        raise HTTPException(status_code=404, detail="还没有生成内容分析")
    return serialize_content_analysis(row)


@router.post("/analysis-jobs/{job_id}/speech-risks")
def create_speech_risks(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")

    existing = db.scalars(select(SpeechRisk).where(SpeechRisk.analysis_job_id == job.id).order_by(SpeechRisk.time_seconds)).all()
    if existing:
        return {"items": [serialize_speech_risk(risk) for risk in existing], "source": existing[0].source}

    segments = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.analysis_job_id == job.id).order_by(TranscriptSegment.start_seconds)
    ).all()
    if not segments:
        raise HTTPException(status_code=400, detail="请先完成直播内容转写，再检查话术风险")

    payload = [serialize_transcript_segment(segment) for segment in segments]
    results = MockSpeechRiskAnalyzer().analyze(payload)
    risks = [
        SpeechRisk(
            analysis_job_id=job.id,
            transcript_segment_id=result["transcript_segment_id"],
            time_seconds=result["time_seconds"],
            original_text=result["original_text"],
            risk_type=result["risk_type"],
            risk_level=result["risk_level"],
            reason=result["reason"],
            rewrite=result["rewrite"],
            needs_human_review=result["needs_human_review"],
            source=result["source"],
        )
        for result in results
    ]
    db.add_all(risks)
    db.commit()
    for risk in risks:
        db.refresh(risk)
    return {"items": [serialize_speech_risk(risk) for risk in risks], "source": "mock"}


@router.get("/analysis-jobs/{job_id}/speech-risks")
def list_speech_risks(job_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="处理任务不存在")
    risks = db.scalars(select(SpeechRisk).where(SpeechRisk.analysis_job_id == job.id).order_by(SpeechRisk.time_seconds)).all()
    return {"items": [serialize_speech_risk(risk) for risk in risks]}


@router.get("/live-sessions/{session_id}/metrics")
def get_metrics(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    row = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == session_id))
    if not row:
        raise HTTPException(status_code=404, detail="还没有识别到数据")
    data = json.loads(row.metrics_json)
    persisted_fields = db.scalars(
        select(RecognizedMetricField).where(RecognizedMetricField.live_session_id == session_id).order_by(RecognizedMetricField.id)
    ).all()
    if persisted_fields:
        data["fields"] = [serialize_recognized_field(field) for field in persisted_fields]
    return data


@router.put("/live-sessions/{session_id}/recognized-fields")
def confirm_recognized_fields(
    session_id: int,
    payload: RecognizedFieldsConfirm,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = ensure_owned_session(session_id, user, db)
    existing_rows = {
        row.id: row
        for row in db.scalars(select(RecognizedMetricField).where(RecognizedMetricField.live_session_id == session_id)).all()
    }

    confirmed = []
    for item in payload.fields:
        if item.id and item.id in existing_rows:
            row = existing_rows[item.id]
            if item.deleted:
                db.delete(row)
                continue
        elif item.deleted:
            continue
        else:
            row = RecognizedMetricField(
                live_session_id=session_id,
                metric_key=item.metric_key,
                label=item.label,
                uploaded_asset_id=item.source_screenshot_id or 0,
                source_screenshot_type=item.source_screenshot_type,
                raw_value="",
                normalized_value="",
                unit=item.unit,
                confidence=100,
                source="user_added",
            )
            db.add(row)

        row.metric_key = item.metric_key
        row.label = item.label
        row.final_value = item.final_value
        row.manual_value = item.final_value
        row.unit = item.unit
        row.uploaded_asset_id = item.source_screenshot_id or row.uploaded_asset_id
        row.source_screenshot_type = item.source_screenshot_type or row.source_screenshot_type
        row.is_manually_confirmed = True
        row.has_conflict = False
        confirmed.append(row)

    session.status = "metrics_confirmed"
    db.commit()
    return {"items": [serialize_recognized_field(row) for row in confirmed if row.id]}


@router.put("/live-sessions/{session_id}/metrics")
def confirm_metrics(
    session_id: int,
    payload: MetricsConfirm,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    data = payload.model_dump()
    data["source"] = "user_confirmed"
    data["data_source"] = session.data_source or "manual_input"
    data["platform"] = session.platform or "douyin"
    data["platform_account_id"] = session.platform_account_id
    row = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == session_id))
    if row:
        row.metrics_json = json.dumps(data, ensure_ascii=False)
        row.source = "user_confirmed"
    else:
        db.add(RecognizedMetrics(live_session_id=session_id, metrics_json=json.dumps(data, ensure_ascii=False), source="user_confirmed"))
    session.status = "metrics_confirmed"
    db.commit()
    return data


@router.post("/live-sessions/{session_id}/report")
def create_report(
    session_id: int,
    payload: ReportRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    if payload.temporary_instruction.strip():
        db.add(
            ReportTemporaryInstruction(
                live_session_id=session_id,
                content=payload.temporary_instruction.strip(),
                save_as_anchor_rule=payload.save_temporary_as_rule,
            )
        )
        if payload.save_temporary_as_rule:
            rule = RuleEntry(
                user_id=user.id,
                title=f"{session.title} 的长期提醒",
                raw_content=payload.temporary_instruction.strip(),
                rule_type="主播个人提醒",
                scope_type="某个主播",
                scope_value=str(session.streamer_id),
                status="待确认",
                created_by=user.id,
            )
            db.add(rule)
            db.flush()
            data = interpret_rule(rule, user, db)
            save_rule_interpretation(rule, data, db)
            db.add(
                RuleVersion(
                    rule_id=rule.id,
                    version_number=1,
                    raw_content=rule.raw_content,
                    structured_content=json.dumps(data, ensure_ascii=False),
                    change_reason="从本次临时提示保存为主播提醒",
                    created_by=user.id,
                )
            )
    report = build_text_model_report(user=user, session=session, payload=payload, db=db)
    row = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session_id))
    if row:
        row.report_json = json.dumps(report, ensure_ascii=False)
        row.source = report["source"]
    else:
        row = ReviewReport(live_session_id=session_id, report_json=json.dumps(report, ensure_ascii=False), source=report["source"])
        db.add(row)
    db.flush()
    old_versions = db.scalars(select(ReviewReportVersion).where(ReviewReportVersion.review_report_id == row.id)).all()
    for version in old_versions:
        version.is_current = False
    next_version = (max([version.version_number for version in old_versions] or [0]) + 1)
    db.add(
        ReviewReportVersion(
            review_report_id=row.id,
            live_session_id=session_id,
            version_number=next_version,
            report_type=payload.report_type,
            report_json=json.dumps(report, ensure_ascii=False),
            metrics_snapshot=json.dumps(payload.metrics.model_dump(), ensure_ascii=False),
            rule_snapshot=json.dumps(report.get("rule_snapshot", []), ensure_ascii=False),
            model_name=report.get("model_name", ""),
            source=report["source"],
            is_current=True,
        )
    )
    stale_refs = db.scalars(select(ReportRuleReference).where(ReportRuleReference.report_id == row.id)).all()
    for ref in stale_refs:
        db.delete(ref)
    for rule in report.get("rule_snapshot", []):
        if rule.get("version_id"):
            db.add(
                ReportRuleReference(
                    report_id=row.id,
                    rule_id=rule["id"],
                    rule_version_id=rule["version_id"],
                    reference_type=rule["rule_type"],
                    reason_used=rule.get("reason_used", ""),
                )
            )
    for action in report["next_actions"]:
        db.add(GrowthTask(user_id=user.id, live_session_id=session_id, action=action))
    session.status = "reported"
    session.report_type = payload.report_type
    db.commit()
    return report


@router.get("/live-sessions/{session_id}/report")
def get_report(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    row = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session_id))
    if not row:
        raise HTTPException(status_code=404, detail="还没有生成报告")
    data = json.loads(row.report_json)
    data["report_id"] = row.id
    data["report_type"] = session.report_type
    current_version = db.scalar(
        select(ReviewReportVersion)
        .where(ReviewReportVersion.review_report_id == row.id, ReviewReportVersion.is_current.is_(True))
        .order_by(ReviewReportVersion.version_number.desc())
    )
    data["version_number"] = current_version.version_number if current_version else 1
    return data


@router.get("/live-sessions/{session_id}/report-versions")
def list_report_versions(session_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    report = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session_id))
    if not report:
        return {"items": []}
    versions = db.scalars(
        select(ReviewReportVersion)
        .where(ReviewReportVersion.review_report_id == report.id)
        .order_by(ReviewReportVersion.version_number.desc())
    ).all()
    return {
        "items": [
            {
                "id": item.id,
                "version_number": item.version_number,
                "report_type": item.report_type,
                "model_name": item.model_name,
                "source": item.source,
                "is_current": item.is_current,
                "created_at": item.created_at.isoformat(),
            }
            for item in versions
        ]
    }


@router.get("/live-sessions/{session_id}/report-versions/{version_id}")
def get_report_version(
    session_id: int,
    version_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    session = db.get(LiveSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    report = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session_id))
    if not report:
        raise HTTPException(status_code=404, detail="还没有生成报告")
    version = db.get(ReviewReportVersion, version_id)
    if not version or version.live_session_id != session_id or version.review_report_id != report.id:
        raise HTTPException(status_code=404, detail="报告版本不存在")
    data = json.loads(version.report_json)
    data["report_id"] = report.id
    data["report_type"] = version.report_type
    data["version_number"] = version.version_number
    data["model_name"] = version.model_name or data.get("model_name", "")
    data["source"] = version.source or data.get("source", "")
    data["is_current_version"] = version.is_current
    data["version_created_at"] = version.created_at.isoformat()
    return data


def metrics_for_session(db: Session, session_id: int) -> dict:
    row = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == session_id))
    return json.loads(row.metrics_json) if row else {}


def build_dashboard_metric_changes(db: Session, sessions: list[LiveSession]) -> list[dict]:
    if len(sessions) < 2:
        return []
    latest_metrics = metrics_for_session(db, sessions[0].id)
    previous_metrics = metrics_for_session(db, sessions[1].id)
    metric_labels = {
        "total_viewers": "累计观看",
        "peak_online": "最高在线",
        "average_online": "平均在线",
        "average_stay_seconds": "平均停留",
        "comments": "评论数",
        "new_followers": "新增关注",
    }
    changes = []
    for key, label in metric_labels.items():
        current = latest_metrics.get(key)
        previous = previous_metrics.get(key)
        if not isinstance(current, (int, float)) or not isinstance(previous, (int, float)) or previous == 0:
            continue
        diff = current - previous
        if abs(diff) < 1:
            trend = "稳定"
        elif diff > 0:
            trend = "上升"
        else:
            trend = "下降"
        changes.append(
            {
                "metric_key": key,
                "label": label,
                "current": current,
                "previous": previous,
                "diff": diff,
                "trend": trend,
            }
        )
    return changes[:4]


def build_task_execution_summary(tasks: list[GrowthTask]) -> dict:
    statuses = ["已执行", "部分执行", "未执行", "不适用", "未完成"]
    counts = {status: 0 for status in statuses}
    for task in tasks:
        counts[task.status if task.status in counts else "未完成"] += 1
    completed = counts["已执行"] + counts["部分执行"]
    total = len(tasks)
    if not total:
        text = "最近一场还没有行动计划。"
    elif completed == total:
        text = "上一场行动计划已全部标记执行。"
    elif completed:
        text = f"上一场 {total} 项行动中，{completed} 项已执行或部分执行。"
    else:
        text = f"上一场 {total} 项行动还未确认执行情况。"
    return {"total": total, "counts": counts, "summary": text}


@router.get("/dashboard")
def dashboard(
    streamer_id: Optional[int] = None,
    platform_account_id: Optional[int] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    streamer_count = (
        db.scalar(select(func.count()).select_from(Streamer).where(Streamer.user_id == user.id, Streamer.is_archived.is_(False))) or 0
    )
    platform_account_count = (
        db.scalar(
            select(func.count())
            .select_from(UserPlatformAccount)
            .join(PlatformAccount, PlatformAccount.id == UserPlatformAccount.platform_account_id)
            .where(
                UserPlatformAccount.user_id == user.id,
                UserPlatformAccount.status == "active",
                PlatformAccount.archived_at.is_(None),
            )
        )
        or 0
    )
    prepare_plan_count = db.scalar(select(func.count()).select_from(PreparationPlan).where(PreparationPlan.user_id == user.id)) or 0
    text_model_configured = bool(select_model_setting(user, "文字分析", db))
    image_model_configured = bool(select_model_setting(user, "图片识别", db))
    session_query = select(LiveSession).where(LiveSession.user_id == user.id, LiveSession.is_archived.is_(False))
    if streamer_id:
        session_query = session_query.where(LiveSession.streamer_id == streamer_id)
    if platform_account_id:
        ensure_platform_access(platform_account_id, user, db)
        session_query = session_query.where(LiveSession.platform_account_id == platform_account_id)
    session_count = db.scalar(select(func.count()).select_from(session_query.subquery())) or 0
    recent_sessions = db.scalars(session_query.order_by(LiveSession.id.desc()).limit(3)).all()
    session = recent_sessions[0] if recent_sessions else None
    report = None
    if session:
        row = db.scalar(select(ReviewReport).where(ReviewReport.live_session_id == session.id))
        report = json.loads(row.report_json) if row else None
    task_query = select(GrowthTask).where(GrowthTask.user_id == user.id)
    if session:
        task_query = task_query.where(GrowthTask.live_session_id == session.id)
    tasks = db.scalars(task_query.order_by(GrowthTask.id.desc()).limit(3)).all()
    task_summary = build_task_execution_summary(tasks)
    rules = db.scalars(select(RuleEntry)).all()
    active_rule_count = sum(
        1
        for rule in rules
        if rule_is_effective(rule)
        and (rule.rule_type in ["平台官方规则", "运营经验", "系统提示"] or (rule.rule_type == "主播个人提醒" and rule.user_id == user.id))
    )
    return {
        "streamer_count": streamer_count,
        "platform_account_count": platform_account_count,
        "prepare_plan_count": prepare_plan_count,
        "model_status": {
            "text_model_configured": text_model_configured,
            "image_model_configured": image_model_configured,
        },
        "session_count": session_count,
        "latest_session": {
            "id": session.id,
            "title": session.title,
            "created_at": session.created_at.isoformat(),
            "status": session.status,
            "summary": report["summary"] if report else "还没有生成复盘，先上传一场直播数据。",
            "main_problem": report["main_problem"] if report else "暂无",
            "strength": report.get("strength", "暂无") if report else "暂无",
            "first_action": report["next_actions"][0] if report else "上传一场直播复盘",
        }
        if session
        else None,
        "tasks": [serialize_growth_task(task) for task in tasks],
        "task_execution_summary": task_summary,
        "metric_changes": build_dashboard_metric_changes(db, recent_sessions),
        "rule_reminder": f"有 {active_rule_count} 条已生效规则会参与后续分析。" if active_rule_count else "",
    }
