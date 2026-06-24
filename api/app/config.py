from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "LivePilot"
    timezone: str = "Asia/Shanghai"
    database_url: str = "sqlite:///./data/live_assistant.db"
    jwt_secret: str = Field(default="dev-secret-change-me", repr=False)
    jwt_algorithm: str = "HS256"
    upload_dir: str = "./data/uploads"
    invite_code: str = "BETA2026"
    registration_mode: str = "invite"
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    max_screenshot_upload_mb: int = 20
    max_media_upload_mb: int = 500
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    audio_chunk_seconds: int = 900
    platform_vision_api_base: str = ""
    platform_vision_api_key: str = Field(default="", repr=False)
    platform_vision_model: str = ""
    platform_text_api_base: str = ""
    platform_text_api_key: str = Field(default="", repr=False)
    platform_text_model: str = ""
    admin_phones: str = ""
    douyin_client_key: str = ""
    douyin_client_secret: str = Field(default="", repr=False)
    douyin_redirect_uri: str = ""
    douyin_platform_status: str = "未配置"
    sms_enabled: bool = False
    sms_provider: str = "mock"
    sms_access_key_id: str = Field(default="", repr=False)
    sms_access_key_secret: str = Field(default="", repr=False)
    sms_sign_name: str = ""
    sms_template_code: str = ""
    sms_region: str = ""
    sms_code_ttl_seconds: int = 300
    sms_send_interval_seconds: int = 60
    sms_hourly_limit_per_phone: int = 5
    sms_daily_limit_per_phone: int = 10
    sms_hourly_limit_per_ip: int = 30
    verification_max_attempts: int = 5
    login_fail_hourly_limit: int = 10
    register_hourly_limit_per_ip: int = 20

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_media_upload_bytes(self) -> int:
        return self.max_media_upload_mb * 1024 * 1024

    @property
    def max_screenshot_upload_bytes(self) -> int:
        return self.max_screenshot_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production and settings.jwt_secret == "dev-secret-change-me":
        raise RuntimeError("生产环境必须设置安全的 JWT_SECRET，不能使用默认开发密钥。")
    if settings.is_production and len(settings.jwt_secret) < 32:
        raise RuntimeError("生产环境 JWT_SECRET 长度至少需要 32 个字符。")
    if settings.is_production and not settings.allowed_cors_origins:
        raise RuntimeError("生产环境必须显式配置 CORS_ORIGINS。")
    if settings.is_production and settings.registration_mode not in {"closed", "invite", "open"}:
        raise RuntimeError("REGISTRATION_MODE 只能是 closed、invite 或 open。")
    if settings.is_production and settings.registration_mode == "open" and not settings.sms_enabled:
        raise RuntimeError("开放注册必须先配置可用短信服务。")
    if settings.is_production and settings.sms_enabled and settings.sms_provider == "mock":
        raise RuntimeError("生产环境不能使用 Mock 短信服务。")
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path("./data").mkdir(parents=True, exist_ok=True)
    return settings
