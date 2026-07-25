import re
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AuthRegister(BaseModel):
    phone: str
    sms_code: str = Field(default="", min_length=4, max_length=8)
    username: str = Field(default="", min_length=4, max_length=32)
    nickname: str = ""
    name: str = ""
    password: str = Field(min_length=6)
    confirm_password: str = ""
    invite_code: str = ""
    accepted_terms: bool = False

    @field_validator("username")
    @classmethod
    def username_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("用户名不能为空")
        return value


class AuthLogin(BaseModel):
    username: str = ""
    password: str


class SmsCodeRequest(BaseModel):
    phone: str
    purpose: Literal["register", "reset_password", "change_phone_old", "change_phone_new"]


class SmsCodeVerify(BaseModel):
    phone: str
    purpose: Literal["register", "reset_password", "change_phone_old", "change_phone_new"]
    code: str


class PasswordResetStart(BaseModel):
    account: str = Field(min_length=1)


class PasswordResetConfirm(BaseModel):
    account: str = Field(min_length=1)
    sms_code: str = Field(min_length=4, max_length=8)
    new_password: str = Field(min_length=6)
    confirm_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


class StreamerCreate(BaseModel):
    name: str
    direction: Literal["内容分享", "情感陪伴", "才艺娱乐", "商品或服务销售"]
    live_forms: list[str] = []
    average_online_range: str = ""
    usual_live_time: str = ""
    improvement_goal: str = ""
    notes: str = ""


class StreamerOut(StreamerCreate):
    id: int
    created_at: datetime


class StreamerUpdate(BaseModel):
    name: Optional[str] = None
    direction: Optional[Literal["内容分享", "情感陪伴", "才艺娱乐", "商品或服务销售"]] = None
    live_forms: Optional[list[str]] = None
    average_online_range: Optional[str] = None
    usual_live_time: Optional[str] = None
    improvement_goal: Optional[str] = None
    notes: Optional[str] = None


class ModelSettingIn(BaseModel):
    name: str = "默认模型"
    mode: Literal["platform", "custom", "mock"] = "platform"
    api_base: str = ""
    api_key: str = ""
    model_name: str = ""
    purpose: Literal["文字分析", "图片识别"] = "文字分析"
    timeout_seconds: int = Field(default=60, ge=5, le=180)
    max_retries: int = Field(default=1, ge=0, le=3)
    is_default: bool = False


class ModelSettingOut(BaseModel):
    id: int
    name: str
    mode: str
    api_base: str
    api_key_masked: str
    model_name: str
    purpose: str
    timeout_seconds: int
    max_retries: int
    is_default: bool
    is_active: bool


class ModelSettingUpdate(BaseModel):
    name: Optional[str] = None
    mode: Optional[Literal["platform", "custom", "mock"]] = None
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    timeout_seconds: Optional[int] = Field(default=None, ge=5, le=180)
    max_retries: Optional[int] = Field(default=None, ge=0, le=3)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class LiveSessionCreate(BaseModel):
    streamer_id: int
    title: str = "未命名直播"
    platform_account_id: Optional[int] = None
    preparation_plan_id: Optional[int] = None
    platform: str = "douyin"
    data_source: str = "manual_input"


class LiveSessionOut(BaseModel):
    id: int
    streamer_id: int
    title: str
    status: str
    created_at: datetime


class ScreenshotOrderUpdate(BaseModel):
    asset_ids: list[int]


def parse_common_number(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip().replace(",", "").replace("，", "")
    if not text:
        return None
    if any(unit in text for unit in ["小时", "分钟", "分", "秒"]):
        hours = re.search(r"(\d+(?:\.\d+)?)\s*小时", text)
        minutes = re.search(r"(\d+(?:\.\d+)?)\s*(?:分钟|分)", text)
        seconds = re.search(r"(\d+(?:\.\d+)?)\s*秒", text)
        if hours or minutes or seconds:
            total = 0.0
            if hours:
                total += float(hours.group(1)) * 3600
            if minutes:
                total += float(minutes.group(1)) * 60
            if seconds:
                total += float(seconds.group(1))
            return int(round(total))
    multiplier = 1
    if "万" in text:
        multiplier = 10000
    elif "千" in text:
        multiplier = 1000
    seconds_multiplier = 1
    if "小时" in text:
        seconds_multiplier = 3600
    elif "分钟" in text or "分" in text:
        seconds_multiplier = 60
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        raise ValueError("请输入数字，例如 1200、1.2万、3分钟")
    number = float(match.group(0)) * multiplier * seconds_multiplier
    return int(round(number))


class MetricsConfirm(BaseModel):
    duration_minutes: Optional[int] = None
    total_viewers: Optional[int] = None
    peak_online: Optional[int] = None
    average_online: Optional[int] = None
    new_followers: Optional[int] = None
    comments: Optional[int] = None
    likes: Optional[int] = None
    average_stay_seconds: Optional[int] = None
    traffic_sources: str = "暂未识别"
    live_date: str = ""
    has_paid_promotion: Optional[bool] = None
    has_violation: Optional[bool] = None
    violation_note: str = ""
    session_topic: str = ""
    main_goal: str = ""
    has_cohost: Optional[bool] = None
    self_review: str = ""
    abnormal_notes: str = ""
    additional_metrics: list[dict[str, Any]] = []

    @field_validator(
        "duration_minutes",
        "total_viewers",
        "peak_online",
        "average_online",
        "new_followers",
        "comments",
        "likes",
        "average_stay_seconds",
        mode="before",
    )
    @classmethod
    def parse_numeric_input(cls, value: Any) -> Optional[int]:
        return parse_common_number(value)


class ReportRequest(BaseModel):
    report_type: Literal["simple", "professional", "both"] = "simple"
    metrics: MetricsConfirm
    temporary_instruction: str = ""
    save_temporary_as_rule: bool = False


class RuleCreate(BaseModel):
    title: str = Field(min_length=1)
    raw_content: str = Field(min_length=1)
    rule_type: Literal["平台官方规则", "运营经验", "主播个人提醒", "系统提示"] = "主播个人提醒"
    scope_type: Literal["全部主播", "某类主播", "某个主播", "某种直播形式"] = "某个主播"
    scope_value: str = ""
    source_name: str = ""
    source_url: str = ""
    published_at: str = ""
    effective_at: str = ""
    expires_at: str = ""
    applicable_streamer_type: str = ""
    applicable_live_form: str = ""
    related_streamer_id: Optional[int] = None
    notes: str = ""


class RuleConfirm(BaseModel):
    structured_content: dict[str, Any] = {}
    change_reason: str = "人工确认生效"
    status: Literal["草稿", "待确认", "已生效"] = "已生效"


class RuleUpdate(BaseModel):
    title: Optional[str] = None
    raw_content: Optional[str] = None
    structured_content: Optional[dict[str, Any]] = None
    change_reason: str = "规则更新"


class GrowthTaskUpdate(BaseModel):
    status: Literal["已执行", "部分执行", "未执行", "不适用", "未完成"] = "未完成"
    remark: str = ""


class FeedbackCreate(BaseModel):
    live_session_id: Optional[int] = None
    report_id: Optional[int] = None
    feedback_type: Literal["报告有帮助", "数据判断不准确", "建议太空泛", "建议不适合我的直播", "规则依据有问题", "操作遇到问题", "其他"]
    content: str = ""


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class AccountDeletionRequest(BaseModel):
    reason: str = ""


class PreparePlanRequest(BaseModel):
    streamer_id: int
    platform_account_id: Optional[int] = None
    topic: str = Field(min_length=1)
    duration_minutes: int = Field(default=60, ge=10, le=480)
    goal: Literal["更多人进入", "留得更久", "更多互动", "更多关注", "更多成交", "降低违规风险"] = "留得更久"
    live_form: Literal["单人口播", "评论互动", "互动连麦", "商品或服务讲解"] = "评论互动"
    has_cohost: bool = False
    has_ecommerce: bool = False
    special_notes: str = ""


class PreparePlanUpdate(BaseModel):
    topic: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=10, le=480)
    goal: Optional[str] = None
    live_form: Optional[str] = None
    special_notes: Optional[str] = None
    plan: Optional[dict[str, Any]] = None


class PlatformAccountCreate(BaseModel):
    platform: Literal["douyin", "kuaishou", "xiaohongshu", "shipinhao", "bilibili", "other"] = "douyin"
    display_name: str = Field(min_length=1)
    account_handle: str = ""
    anchor_id: Optional[int] = None
    account_type: Literal["个人账号", "企业账号", "达人账号", "商家账号", "机构账号", "其他"] = "个人账号"
    follower_range: str = ""
    notes: str = ""


class PlatformAccountUpdate(BaseModel):
    display_name: Optional[str] = None
    account_handle: Optional[str] = None
    account_type: Optional[str] = None
    follower_range: Optional[str] = None
    notes: Optional[str] = None
    anchor_id: Optional[int] = None
    is_primary: Optional[bool] = None


class PlatformMemberCreate(BaseModel):
    phone: str
    role: Literal["owner", "admin", "operator", "viewer"] = "operator"
    permission_scope: str = "review,report,rule"


class PlatformMemberUpdate(BaseModel):
    role: Literal["owner", "admin", "operator", "viewer"]
    permission_scope: str = "review,report,rule"


class RecognizedFieldConfirm(BaseModel):
    id: Optional[int] = None
    metric_key: str
    label: str
    group: str = "核心数据"
    final_value: str = ""
    unit: str = ""
    source_screenshot_id: Optional[int] = None
    source_screenshot_type: str = ""
    deleted: bool = False


class RecognizedFieldsConfirm(BaseModel):
    fields: list[RecognizedFieldConfirm]
