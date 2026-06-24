import json
from io import BytesIO

from fastapi import UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.config import get_settings
from app.database import Base
from app.models import (
    GrowthTask,
    LiveSession,
    ModelSetting,
    PreparationPlan,
    RecognizedMetrics,
    ReviewReportVersion,
    RuleEntry,
    Streamer,
    UploadedAsset,
    User,
    UserFeedback,
)
from app.routes import (
    add_platform_member,
    archive_streamer,
    confirm_metrics,
    create_feedback,
    create_live_session,
    create_platform_account,
    create_platform_sync_job,
    create_prepare_plan,
    create_report,
    dashboard,
    delete_model_setting,
    delete_screenshot,
    douyin_authorize_url,
    ensure_platform_access,
    get_platform_account,
    get_report_version,
    latest_streamer_growth_tasks,
    list_anchor_platform_accounts,
    list_live_sessions,
    list_platform_accounts,
    list_screenshots,
    login,
    ready,
    register,
    remove_platform_member,
    reorder_screenshots,
    request_account_deletion,
    restore_streamer,
    save_model_setting,
    set_default_streamer,
    update_growth_task,
    update_model_setting,
    update_platform_account,
    update_platform_member,
    update_prepare_plan,
    upload_screenshots,
)
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
    PlatformAccountCreate,
    PlatformAccountUpdate,
    PlatformMemberCreate,
    PlatformMemberUpdate,
    PreparePlanRequest,
    PreparePlanUpdate,
    ReportRequest,
    ScreenshotOrderUpdate,
)


def make_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def image_upload(filename: str, content_type: str = "image/png") -> UploadFile:
    return UploadFile(
        BytesIO(b"\x89PNG\r\n\x1a\nfake-image"),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def test_register_login_and_deleted_user_boundaries():
    db = make_db()

    registered = register(
        AuthRegister(phone="13800000000", name="真实主播", password="secret123", invite_code=get_settings().invite_code),
        db,
    )
    assert registered["access_token"]
    assert registered["user"]["name"] == "真实主播"

    try:
        register(AuthRegister(phone="13800000000", name="重复账号", password="secret123", invite_code=get_settings().invite_code), db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
    else:
        raise AssertionError("重复手机号不应注册成功")

    try:
        login(AuthLogin(phone="13800000000", password="wrong-password"), db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
    else:
        raise AssertionError("错误密码不应登录成功")

    user = db.scalar(select(User).where(User.phone == "13800000000"))
    user.is_deleted = True
    db.commit()
    try:
        login(AuthLogin(phone="13800000000", password="secret123"), db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("已停用账号不应登录成功")


def test_ready_reports_database_and_upload_directory():
    db = make_db()

    result = ready(db)

    assert result["ok"] is True
    assert result["checks"]["database"] is True
    assert result["checks"]["upload_dir_writable"] is True


def test_streamer_with_sessions_is_archived_not_deleted():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="第一场")
    db.add_all([user, streamer, session])
    db.commit()

    result = archive_streamer(1, user, db)

    assert result["ok"] is True
    assert db.get(Streamer, 1).is_archived is True


def test_streamer_default_can_persist_and_archived_streamer_can_restore():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="第一场")
    db.add_all([user, streamer, session])
    db.commit()

    default_result = set_default_streamer(1, user, db)
    archive_streamer(1, user, db)
    restored = restore_streamer(1, user, db)
    default_again = set_default_streamer(1, user, db)

    assert default_result["streamer"]["is_default"] is True
    assert user.default_streamer_id == 1
    assert restored["streamer"]["is_archived"] is False
    assert default_again["streamer"]["is_default"] is True


def test_growth_task_execution_status_is_saved():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    task = GrowthTask(id=1, user_id=1, live_session_id=1, action="开场先互动")
    db.add_all([user, task])
    db.commit()

    result = update_growth_task(1, GrowthTaskUpdate(status="已执行", remark="照做了"), user, db)

    assert result["status"] == "已执行"
    assert result["remark"] == "照做了"


def test_feedback_and_deletion_request_are_persisted():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="第一场")
    db.add_all([user, session])
    db.commit()

    feedback_result = create_feedback(
        FeedbackCreate(live_session_id=1, feedback_type="操作遇到问题", content="按钮不明显"),
        user,
        db,
    )
    deletion_result = request_account_deletion(AccountDeletionRequest(reason="测试"), user, db)

    assert feedback_result["item"]["feedback_type"] == "操作遇到问题"
    assert db.scalar(select(UserFeedback)).content == "按钮不明显"
    assert deletion_result["ok"] is True
    assert db.get(User, 1).deletion_requested_at is not None


def test_feedback_links_report_version_and_context():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="第一场")
    db.add_all([user, streamer, session])
    db.add(RecognizedMetrics(live_session_id=1, metrics_json='{"total_viewers": 1000}', source="manual_input"))
    db.commit()

    create_report(1, ReportRequest(report_type="simple", metrics=MetricsConfirm(total_viewers=1000, comments=20)), user, db)
    feedback_result = create_feedback(
        FeedbackCreate(live_session_id=1, feedback_type="报告有帮助", content="任务很清楚"),
        user,
        db,
    )
    saved = db.scalar(select(UserFeedback).where(UserFeedback.feedback_type == "报告有帮助"))

    assert feedback_result["item"]["streamer_id"] == 1
    assert feedback_result["item"]["report_version_id"] is not None
    assert feedback_result["item"]["rule_snapshot"] == []
    assert saved.report_version_id is not None
    assert saved.rule_snapshot_json == "[]"


def test_prepare_plan_is_saved_for_streamer():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms='["评论互动"]')
    db.add_all([user, streamer])
    db.commit()

    result = create_prepare_plan(
        PreparePlanRequest(streamer_id=1, topic="新手开播留人", duration_minutes=90, goal="留得更久", special_notes="表达温和"),
        user,
        db,
    )

    assert result["topic"] == "新手开播留人"
    assert result["plan"]["titles"]
    assert "表达温和" in " ".join(result["plan"]["risk_notes"])


def test_prepare_plan_can_bind_account_and_session_marks_it_used():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms='["评论互动"]')
    db.add_all([user, streamer])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅主号", account_handle="prep", anchor_id=1), user, db)
    plan = create_prepare_plan(
        PreparePlanRequest(
            streamer_id=1,
            platform_account_id=account["id"],
            topic="开播承接",
            live_form="评论互动",
            has_cohost=True,
            has_ecommerce=True,
        ),
        user,
        db,
    )

    session = create_live_session(
        LiveSessionCreate(streamer_id=1, title="关联方案复盘", platform_account_id=account["id"], preparation_plan_id=plan["id"]),
        user,
        db,
    )

    assert session["preparation_plan_id"] == plan["id"]
    assert db.get(LiveSession, session["id"]).preparation_plan_id == plan["id"]
    assert plan["plan"]["target_metrics"]
    assert db.get(PreparationPlan, plan["id"]).is_used is True


def test_prepare_plan_can_save_user_edits():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms='["评论互动"]')
    db.add_all([user, streamer])
    db.commit()
    plan = create_prepare_plan(PreparePlanRequest(streamer_id=1, topic="留人话题"), user, db)
    edited_plan = plan["plan"] | {"opening_3_minutes": "大家好，今天先用一个简单问题开场。"}

    result = update_prepare_plan(
        plan["id"],
        PreparePlanUpdate(topic="编辑后的留人话题", plan=edited_plan),
        user,
        db,
    )

    assert result["topic"] == "编辑后的留人话题"
    assert result["plan"]["opening_3_minutes"] == "大家好，今天先用一个简单问题开场。"
    assert json.loads(db.get(PreparationPlan, plan["id"]).plan_json)["opening_3_minutes"] == "大家好，今天先用一个简单问题开场。"


def test_report_regeneration_keeps_versions():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="第一场")
    db.add_all([user, streamer, session])
    db.add(RecognizedMetrics(live_session_id=1, metrics_json='{"total_viewers": 1000}', source="user_confirmed"))
    db.commit()

    payload = ReportRequest(report_type="simple", metrics=MetricsConfirm(total_viewers=1000, comments=20))
    create_report(1, payload, user, db)
    create_report(1, payload, user, db)
    versions = db.query(ReviewReportVersion).order_by(ReviewReportVersion.version_number).all()

    assert [item.version_number for item in versions] == [1, 2]
    assert versions[0].is_current is False
    assert versions[1].is_current is True
    old = get_report_version(1, versions[0].id, user, db)
    assert old["version_number"] == 1
    assert old["is_current_version"] is False


def test_confirm_metrics_persists_additional_manual_metrics():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="商品或服务销售", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="手动数据")
    db.add_all([user, streamer, session])
    db.commit()

    result = confirm_metrics(
        1,
        MetricsConfirm(
            total_viewers="1.2万",
            additional_metrics=[{"metric_key": "refunds", "label": "退款情况", "value": "无明显退款", "unit": "", "group": "成交"}],
        ),
        user,
        db,
    )

    saved = db.scalar(select(RecognizedMetrics).where(RecognizedMetrics.live_session_id == 1))
    assert result["total_viewers"] == 12000
    assert json.loads(saved.metrics_json)["additional_metrics"][0]["label"] == "退款情况"


def test_model_default_switch_and_delete_guard():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    db.add(user)
    db.commit()
    first = save_model_setting(
        ModelSettingIn(name="模型A", mode="mock", purpose="文字分析", model_name="mock-a", is_default=True),
        user,
        db,
    )
    second = save_model_setting(
        ModelSettingIn(name="模型B", mode="mock", purpose="文字分析", model_name="mock-b", is_default=False),
        user,
        db,
    )

    update_model_setting(second["id"], ModelSettingUpdate(is_default=True), user, db)

    assert db.get(ModelSetting, first["id"]).is_default is False
    assert db.get(ModelSetting, second["id"]).is_default is True
    try:
        delete_model_setting(second["id"], user, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
    else:
        raise AssertionError("删除默认模型前应先选择替代模型")


def test_dashboard_rule_reminder_ignores_other_user_personal_rules():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    other = User(id=2, phone="13900000000", name="别人", password_hash="x")
    db.add_all([user, other])
    db.add_all(
        [
            RuleEntry(user_id=1, title="我的提醒", raw_content="避免诱导打赏", rule_type="主播个人提醒", status="已生效", created_by=1),
            RuleEntry(user_id=2, title="别人提醒", raw_content="避免敏感话题", rule_type="主播个人提醒", status="已生效", created_by=2),
            RuleEntry(user_id=2, title="公共规则", raw_content="官方提醒", rule_type="平台官方规则", status="已生效", created_by=2),
            RuleEntry(user_id=2, title="草稿规则", raw_content="未发布", rule_type="平台官方规则", status="草稿", created_by=2),
        ]
    )
    db.commit()

    result = dashboard(user=user, db=db)

    assert result["rule_reminder"] == "有 2 条已生效规则会参与后续分析。"


def test_latest_streamer_growth_tasks_returns_last_reported_session_only():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    old_session = LiveSession(id=1, user_id=1, streamer_id=1, title="上一场", status="reported")
    latest_session = LiveSession(id=2, user_id=1, streamer_id=1, title="最近一场", status="reported")
    draft_session = LiveSession(id=3, user_id=1, streamer_id=1, title="草稿", status="draft")
    db.add_all([user, streamer, old_session, latest_session, draft_session])
    db.add_all(
        [
            GrowthTask(user_id=1, live_session_id=1, action="旧任务"),
            GrowthTask(user_id=1, live_session_id=2, action="新任务一"),
            GrowthTask(user_id=1, live_session_id=2, action="新任务二"),
        ]
    )
    db.commit()

    result = latest_streamer_growth_tasks(1, user, db)

    assert result["session"]["title"] == "最近一场"
    assert [item["action"] for item in result["items"]] == ["新任务一", "新任务二"]


def test_user_can_create_multiple_douyin_accounts_and_bind_anchor():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([user, anchor])
    db.commit()

    first = create_platform_account(
        PlatformAccountCreate(display_name="小雅直播间", account_handle="xiaoya001", anchor_id=1, account_type="个人账号"),
        user,
        db,
    )
    second = create_platform_account(
        PlatformAccountCreate(display_name="小雅带货号", account_handle="xiaoya_shop", anchor_id=1, account_type="商家账号"),
        user,
        db,
    )
    bound = list_anchor_platform_accounts(1, user, db)

    assert first["connection_status"] == "已手动记录"
    assert second["id"] != first["id"]
    assert len(bound["items"]) == 2


def test_platform_account_can_unbind_anchor_and_reject_foreign_anchor():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="运营", password_hash="x")
    other = User(id=2, phone="13900000000", name="其他人", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    foreign_anchor = Streamer(id=2, user_id=2, name="别人的主播", direction="才艺娱乐", live_forms="[]")
    db.add_all([owner, other, anchor, foreign_anchor])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="unbind", anchor_id=1), owner, db)

    unbound = update_platform_account(account["id"], PlatformAccountUpdate(anchor_id=None), owner, db)
    bound = list_anchor_platform_accounts(1, owner, db)

    assert unbound["anchor"] is None
    assert bound["items"] == []
    try:
        update_platform_account(account["id"], PlatformAccountUpdate(anchor_id=2), owner, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("不能把平台账号绑定到其他用户的主播")


def test_platform_account_can_have_multiple_members_with_permissions():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="负责人", password_hash="x")
    operator = User(id=2, phone="13900000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([owner, operator, anchor])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="xiaoya", anchor_id=1), owner, db)

    detail = add_platform_member(account["id"], PlatformMemberCreate(phone="13900000000", role="operator"), owner, db)

    assert detail["member_count"] == 2
    assert ensure_platform_access(account["id"], operator, db).display_name == "小雅号"


def test_platform_account_member_role_can_update_and_remove():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="负责人", password_hash="x")
    operator = User(id=2, phone="13900000000", name="运营", password_hash="x")
    db.add_all([owner, operator])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="member-edit"), owner, db)
    detail = add_platform_member(account["id"], PlatformMemberCreate(phone="13900000000", role="operator"), owner, db)
    member = next(item for item in detail["members"] if item["user_id"] == 2)

    updated = update_platform_member(account["id"], member["id"], PlatformMemberUpdate(role="viewer", permission_scope="read"), owner, db)
    removed = remove_platform_member(account["id"], member["id"], owner, db)

    assert next(item for item in updated["members"] if item["user_id"] == 2)["role"] == "viewer"
    assert next(item for item in removed["members"] if item["user_id"] == 2)["status"] == "removed"
    try:
        ensure_platform_access(account["id"], operator, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("被移除成员不应继续访问平台账号")


def test_non_member_cannot_read_platform_account():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="负责人", password_hash="x")
    stranger = User(id=2, phone="13900000000", name="陌生人", password_hash="x")
    db.add_all([owner, stranger])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="xiaoya"), owner, db)

    try:
        get_platform_account(account["id"], stranger, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("非成员不应查看平台账号")


def test_duplicate_manual_account_does_not_auto_add_unrelated_user():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="负责人", password_hash="x")
    stranger = User(id=2, phone="13900000000", name="陌生人", password_hash="x")
    db.add_all([owner, stranger])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="same-handle"), owner, db)

    try:
        create_platform_account(PlatformAccountCreate(display_name="陌生记录", account_handle="same-handle"), stranger, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 409
    else:
        raise AssertionError("陌生用户不能凭相同抖音号自动加入已有平台账号")

    try:
        get_platform_account(account["id"], stranger, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("重复记录失败后不应获得账号读取权限")


def test_platform_account_anchor_filter_rejects_foreign_anchor():
    db = make_db()
    owner = User(id=1, phone="13800000000", name="负责人", password_hash="x")
    stranger = User(id=2, phone="13900000000", name="陌生人", password_hash="x")
    own_anchor = Streamer(id=1, user_id=1, name="我的主播", direction="内容分享", live_forms="[]")
    foreign_anchor = Streamer(id=2, user_id=2, name="别人的主播", direction="情感陪伴", live_forms="[]")
    db.add_all([owner, stranger, own_anchor, foreign_anchor])
    db.commit()
    create_platform_account(PlatformAccountCreate(display_name="主号", account_handle="owner-main", anchor_id=1), owner, db)

    result = list_platform_accounts(anchor_id=1, user=owner, db=db)
    assert len(result["items"]) == 1
    try:
        list_platform_accounts(anchor_id=2, user=owner, db=db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 404
    else:
        raise AssertionError("不能用其他用户的主播筛选平台账号")


def test_manual_account_deduplicates_by_handle_and_can_create_session_with_account():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([user, anchor])
    db.commit()

    first = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="same", anchor_id=1), user, db)
    second = create_platform_account(PlatformAccountCreate(display_name="小雅号重复", account_handle="same", anchor_id=1), user, db)
    session = create_live_session(
        LiveSessionCreate(streamer_id=1, title="账号复盘", platform_account_id=first["id"], data_source="manual_input"),
        user,
        db,
    )

    assert first["id"] == second["id"]
    assert session["platform_account_id"] == first["id"]
    assert session["data_source"] == "manual_input"


def test_old_live_session_without_platform_account_still_accessible():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="旧数据")
    db.add_all([user, anchor, session])
    db.commit()

    result = create_report(1, ReportRequest(metrics=MetricsConfirm(total_viewers=100, comments=5)), user, db)

    assert result["summary"]


def test_screenshot_upload_lists_reorders_and_deletes(tmp_path):
    get_settings().upload_dir = str(tmp_path)
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="截图复盘")
    db.add_all([user, anchor, session])
    db.commit()

    upload_screenshots(1, [image_upload("first.png"), image_upload("second.jpg", "image/jpeg")], user, db)
    listed = list_screenshots(1, user, db)
    ids = [item["id"] for item in listed["items"]]
    reordered = reorder_screenshots(1, ScreenshotOrderUpdate(asset_ids=list(reversed(ids))), user, db)
    deleted = delete_screenshot(1, ids[0], user, db)

    assert [item["id"] for item in reordered["items"]] == list(reversed(ids))
    assert len(deleted["items"]) == 1
    assert db.get(UploadedAsset, ids[0]).status == "deleted"


def test_screenshot_upload_rejects_wrong_type(tmp_path):
    get_settings().upload_dir = str(tmp_path)
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="截图复盘")
    db.add_all([user, anchor, session])
    db.commit()

    try:
        upload_screenshots(1, [image_upload("bad.txt", "text/plain")], user, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
        assert "PNG" in getattr(exc, "detail", "")
    else:
        raise AssertionError("非图片截图应被拒绝")


def test_oauth_not_configured_does_not_fake_success():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    db.add(user)
    db.commit()

    result = douyin_authorize_url(user)

    assert result["configured"] is False
    assert "尚未配置" in result["message"]


def test_platform_account_detail_does_not_return_tokens():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    db.add(user)
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="safe"), user, db)

    detail = get_platform_account(account["id"], user, db)
    serialized = str(detail)

    assert "access_token" not in serialized
    assert "refresh_token" not in serialized
    assert "encrypted_access_token" not in serialized


def test_dashboard_can_filter_by_platform_account_without_mixing_sessions():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([user, anchor])
    db.commit()
    first = create_platform_account(PlatformAccountCreate(display_name="小雅主号", account_handle="main", anchor_id=1), user, db)
    second = create_platform_account(PlatformAccountCreate(display_name="小雅小号", account_handle="alt", anchor_id=1), user, db)
    create_live_session(LiveSessionCreate(streamer_id=1, title="主号复盘", platform_account_id=first["id"]), user, db)
    create_live_session(LiveSessionCreate(streamer_id=1, title="小号复盘", platform_account_id=second["id"]), user, db)

    result = dashboard(streamer_id=1, platform_account_id=first["id"], user=user, db=db)

    assert result["session_count"] == 1
    assert result["latest_session"]["title"] == "主号复盘"


def test_dashboard_returns_metric_changes_and_task_summary_for_same_context():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([user, anchor])
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅主号", account_handle="dash-main", anchor_id=1), user, db)
    older = create_live_session(LiveSessionCreate(streamer_id=1, title="上一场", platform_account_id=account["id"]), user, db)
    latest = create_live_session(LiveSessionCreate(streamer_id=1, title="最近一场", platform_account_id=account["id"]), user, db)
    db.add_all(
        [
            RecognizedMetrics(live_session_id=older["id"], metrics_json='{"total_viewers": 8000, "comments": 80}', source="user_confirmed"),
            RecognizedMetrics(
                live_session_id=latest["id"],
                metrics_json='{"total_viewers": 12000, "comments": 70}',
                source="user_confirmed",
            ),
            GrowthTask(user_id=1, live_session_id=latest["id"], action="开场先互动", status="已执行"),
            GrowthTask(user_id=1, live_session_id=latest["id"], action="中段引导关注", status="未完成"),
        ]
    )
    db.commit()

    result = dashboard(streamer_id=1, platform_account_id=account["id"], user=user, db=db)

    assert result["metric_changes"][0]["label"] == "累计观看"
    assert result["metric_changes"][0]["trend"] == "上升"
    assert "1 项已执行" in result["task_execution_summary"]["summary"]


def test_live_session_history_filters_by_account_status_and_live_date():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    anchor = Streamer(id=1, user_id=1, name="小雅", direction="内容分享", live_forms="[]")
    db.add_all([user, anchor])
    db.commit()
    first = create_platform_account(PlatformAccountCreate(display_name="主号", account_handle="history-main", anchor_id=1), user, db)
    second = create_platform_account(PlatformAccountCreate(display_name="小号", account_handle="history-alt", anchor_id=1), user, db)
    first_session = create_live_session(LiveSessionCreate(streamer_id=1, title="主号已报告", platform_account_id=first["id"]), user, db)
    second_session = create_live_session(LiveSessionCreate(streamer_id=1, title="小号草稿", platform_account_id=second["id"]), user, db)
    db.get(LiveSession, first_session["id"]).status = "reported"
    db.add(RecognizedMetrics(live_session_id=first_session["id"], metrics_json='{"live_date": "2026-06-20"}', source="user_confirmed"))
    db.add(RecognizedMetrics(live_session_id=second_session["id"], metrics_json='{"live_date": "2026-06-21"}', source="user_confirmed"))
    db.commit()

    result = list_live_sessions(
        streamer_id=1,
        platform_account_id=first["id"],
        status="reported",
        date_from="2026-06-19",
        date_to="2026-06-20",
        user=user,
        db=db,
    )

    assert [item["title"] for item in result] == ["主号已报告"]
    assert result[0]["platform_account"]["display_name"] == "主号"
    assert result[0]["live_date"] == "2026-06-20"


def test_platform_sync_returns_unsupported_record_without_fake_data():
    db = make_db()
    user = User(id=1, phone="13800000000", name="运营", password_hash="x")
    db.add(user)
    db.commit()
    account = create_platform_account(PlatformAccountCreate(display_name="小雅号", account_handle="sync-safe"), user, db)

    job = create_platform_sync_job(account["id"], "live_session_summary", user, db)
    detail = get_platform_account(account["id"], user, db)

    assert job["status"] == "unsupported"
    assert "尚未配置" in job["error_message"]
    assert detail["sync_jobs"][0]["status"] == "unsupported"
