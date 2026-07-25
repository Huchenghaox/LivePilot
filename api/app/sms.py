from __future__ import annotations

import random
from dataclasses import dataclass

from app.config import Settings
from app.security import mask_phone


@dataclass
class SmsDeliveryResult:
    ok: bool
    provider_message_id: str = ""
    message: str = ""


class SmsProvider:
    provider_name = "base"

    def send_verification_code(self, phone_normalized: str, code: str, purpose: str) -> SmsDeliveryResult:
        raise NotImplementedError


class MockSmsProvider(SmsProvider):
    provider_name = "mock"

    def send_verification_code(self, phone_normalized: str, code: str, purpose: str) -> SmsDeliveryResult:
        return SmsDeliveryResult(
            ok=True,
            provider_message_id=f"mock-{purpose}-{random.randint(100000, 999999)}",
            message=f"验证码已发送到 {mask_phone(phone_normalized)}。开发环境使用 Mock 短信，不会发送真实短信。",
        )


class DisabledSmsProvider(SmsProvider):
    provider_name = "disabled"

    def send_verification_code(self, phone_normalized: str, code: str, purpose: str) -> SmsDeliveryResult:
        return SmsDeliveryResult(ok=False, message="短信服务尚未配置，请稍后再试或联系管理员。")


def generate_sms_code() -> str:
    return f"{random.SystemRandom().randint(0, 999999):06d}"


def get_sms_provider(settings: Settings) -> SmsProvider:
    if settings.sms_provider == "mock" and not settings.is_production:
        return MockSmsProvider()
    if not settings.sms_enabled:
        return DisabledSmsProvider()
    # Real domestic SMS providers are intentionally not hard-coded into the
    # business routes. Add provider adapters here when credentials/templates are ready.
    return DisabledSmsProvider()
