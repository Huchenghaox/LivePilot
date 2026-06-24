from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "LivePilot"
    timezone: str = "Asia/Shanghai"
    database_url: str = "sqlite:///./data/live_assistant.db"
    jwt_secret: str = Field(default="dev-secret-change-me", repr=False)
    jwt_algorithm: str = "HS256"
    upload_dir: str = "./data/uploads"
    invite_code: str = "BETA2026"
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
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path("./data").mkdir(parents=True, exist_ok=True)
    return settings
