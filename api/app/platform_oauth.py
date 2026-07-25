from dataclasses import dataclass
from urllib.parse import urlencode

from app.config import get_settings


@dataclass
class OAuthStatus:
    configured: bool
    message: str
    authorization_url: str = ""


class PlatformOAuthProvider:
    provider = "base"

    def get_authorization_url(self, state: str) -> OAuthStatus:
        raise NotImplementedError

    def exchange_code(self, code: str) -> dict:
        raise NotImplementedError

    def refresh_token(self, refresh_token: str) -> dict:
        raise NotImplementedError

    def revoke_authorization(self, access_token: str) -> dict:
        raise NotImplementedError

    def get_user_profile(self, access_token: str) -> dict:
        raise NotImplementedError

    def get_granted_scopes(self, access_token: str) -> list[str]:
        raise NotImplementedError

    def test_connection(self) -> OAuthStatus:
        raise NotImplementedError


class DouyinOAuthProvider(PlatformOAuthProvider):
    provider = "douyin"
    auth_base = "https://open.douyin.com/platform/oauth/connect/"

    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.douyin_client_key and self.settings.douyin_client_secret and self.settings.douyin_redirect_uri)

    def get_authorization_url(self, state: str) -> OAuthStatus:
        if not self.is_configured():
            return OAuthStatus(
                configured=False,
                message="抖音官方授权能力尚未配置，你可以先手动记录账号并继续使用截图复盘。",
            )
        query = urlencode(
            {
                "client_key": self.settings.douyin_client_key,
                "response_type": "code",
                "scope": "user_info",
                "redirect_uri": self.settings.douyin_redirect_uri,
                "state": state,
            }
        )
        return OAuthStatus(configured=True, message="请前往抖音官方页面完成授权。", authorization_url=f"{self.auth_base}?{query}")

    def exchange_code(self, code: str) -> dict:
        if not self.is_configured():
            return {"status": "unsupported", "message": "抖音开放平台应用尚未配置。"}
        return {"status": "unsupported", "message": "真实授权换取 Token 将在接入抖音开放平台后启用。", "code": code}

    def refresh_token(self, refresh_token: str) -> dict:
        return {"status": "unsupported", "message": "当前尚未启用抖音 Token 刷新。"}

    def revoke_authorization(self, access_token: str) -> dict:
        return {"status": "unsupported", "message": "当前尚未启用抖音授权撤销。"}

    def get_user_profile(self, access_token: str) -> dict:
        return {"status": "unsupported", "message": "当前尚未启用抖音账号资料同步。"}

    def get_granted_scopes(self, access_token: str) -> list[str]:
        return []

    def test_connection(self) -> OAuthStatus:
        if not self.is_configured():
            return OAuthStatus(False, "账号记录可用，官方授权待配置。")
        return OAuthStatus(True, "抖音开放平台配置已填写，可进入真实授权联调。")
