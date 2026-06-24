from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import LiveSession, RuleEntry, RuleInterpretation, RuleVersion, Streamer, User
from app.routes import build_text_model_report, create_rule, ensure_can_manage_rule, list_rule_versions, select_relevant_rules, update_rule
from app.schemas import MetricsConfirm, ReportRequest, RuleCreate, RuleUpdate


def make_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def add_rule(db, user_id: int, title: str, rule_type: str, status: str = "已生效", scope_value: str = "", raw: str = "避免诱导打赏"):
    rule = RuleEntry(
        user_id=user_id,
        title=title,
        raw_content=raw,
        rule_type=rule_type,
        scope_type="全部主播" if not scope_value else "某个主播",
        scope_value=scope_value,
        status=status,
        created_by=user_id,
    )
    db.add(rule)
    db.flush()
    db.add(
        RuleVersion(
            rule_id=rule.id,
            version_number=1,
            raw_content=raw,
            structured_content='{"summary":"避免诱导打赏","keywords":["诱导打赏"]}',
            created_by=user_id,
        )
    )
    db.add(
        RuleInterpretation(
            rule_id=rule.id,
            summary="避免诱导打赏",
            keywords='["诱导打赏"]',
            recommended_actions='["下一场避免诱导打赏"]',
            risky_behaviors='["诱导打赏"]',
            confirmed_by=user_id,
            confirmed_at=datetime.utcnow(),
        )
    )
    db.flush()
    return rule


def test_public_rule_permission_blocks_normal_user():
    user = User(id=1, phone="13800000000", name="测试", password_hash="x")
    rule = RuleEntry(user_id=2, title="公共规则", raw_content="官方规则", rule_type="平台官方规则", created_by=2)

    try:
        ensure_can_manage_rule(rule, user)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("普通用户不应修改公共规则")


def test_normal_user_cannot_create_public_operating_experience():
    db = make_db()
    user = User(id=1, phone="13800000000", name="测试", password_hash="x")
    db.add(user)
    db.commit()

    try:
        create_rule(RuleCreate(title="团队经验", raw_content="建议多互动", rule_type="运营经验"), user, db)
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
    else:
        raise AssertionError("普通用户不应创建公共运营经验")


def test_only_effective_relevant_rules_enter_report_context():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    other = User(id=2, phone="13900000000", name="别人", password_hash="x")
    db.add_all([user, other])
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="情感陪伴", live_forms='["评论互动"]')
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="情感直播")
    db.add_all([streamer, session])
    db.flush()
    active = add_rule(db, 1, "本主播提醒", "主播个人提醒", scope_value="1")
    add_rule(db, 1, "草稿不生效", "主播个人提醒", status="草稿", scope_value="1")
    disabled = add_rule(db, 1, "停用不生效", "主播个人提醒", status="已停用", scope_value="1")
    expired = add_rule(db, 1, "过期不生效", "平台官方规则")
    expired.expires_at = "2000-01-01"
    add_rule(db, 2, "别人主播提醒", "主播个人提醒", scope_value="99")
    add_rule(db, 1, "官方优先", "平台官方规则")
    db.commit()

    rules = select_relevant_rules(
        user,
        session,
        MetricsConfirm(total_viewers=1000, has_violation=True, violation_note="诱导打赏"),
        db,
    )
    titles = [item["title"] for item in rules]

    assert titles.index("官方优先") < titles.index("本主播提醒")
    assert active.id in [item["id"] for item in rules]
    assert disabled.title not in titles
    assert expired.title not in titles
    assert "草稿不生效" not in titles
    assert "别人主播提醒" not in titles


def test_report_saves_rule_snapshot_and_temporary_instruction():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    streamer = Streamer(id=1, user_id=1, name="小雅", direction="情感陪伴", live_forms='["评论互动"]')
    session = LiveSession(id=1, user_id=1, streamer_id=1, title="情感直播")
    db.add_all([user, streamer, session])
    db.flush()
    add_rule(db, 1, "官方合规提醒", "平台官方规则")
    db.commit()

    report = build_text_model_report(
        user=user,
        session=session,
        payload=ReportRequest(
            report_type="simple",
            temporary_instruction="这次要特别注意诱导打赏",
            metrics=MetricsConfirm(total_viewers=1200, comments=20, has_violation=True, violation_note="诱导打赏"),
        ),
        db=db,
    )

    assert report["temporary_instruction"] == "这次要特别注意诱导打赏"
    assert report["rule_snapshot"][0]["title"] == "官方合规提醒"
    assert report["prompt_version"] == "review_rules_v1"


def test_rule_versions_can_be_listed_after_update():
    db = make_db()
    user = User(id=1, phone="13800000000", name="主播", password_hash="x")
    db.add(user)
    db.commit()
    rule = create_rule(RuleCreate(title="个人提醒", raw_content="避免诱导打赏", rule_type="主播个人提醒"), user, db)

    update_rule(rule["id"], RuleUpdate(title="个人提醒更新", raw_content="避免诱导打赏，也不要夸张承诺"), user, db)
    versions = list_rule_versions(rule["id"], user, db)

    assert len(versions["items"]) == 2
    assert versions["items"][0]["version_number"] == 2
