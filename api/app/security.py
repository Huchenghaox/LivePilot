import base64
import hashlib
import hmac
import os
import re
from datetime import datetime, timedelta
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User

HASH_ITERATIONS = 210_000
SALT_BYTES = 16
RESERVED_USERNAMES = {"admin", "administrator", "root", "system", "support", "livepilot", "api", "null", "undefined"}
USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{3,31}$")


def hash_password(password: str) -> str:
    salt = os.urandom(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, HASH_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        HASH_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(digest_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def create_token(user: User) -> str:
    settings = get_settings()
    payload = {"sub": str(user.id), "ver": user.token_version, "exp": datetime.utcnow() + timedelta(days=7)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_user_from_token(db: Session, token: str) -> Optional[User]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
        token_version = int(payload.get("ver", 0))
    except (JWTError, KeyError, ValueError):
        return None
    user = db.get(User, user_id)
    if not user or token_version != user.token_version:
        return None
    return user


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    normalized = normalize_username(username)
    if not USERNAME_PATTERN.match(username.strip()):
        raise ValueError("用户名需为4至32位，首位为英文字母，只能包含字母、数字和下划线。")
    if normalized in RESERVED_USERNAMES:
        raise ValueError("该用户名不可使用，请更换一个。")
    if re.fullmatch(r"\+?\d{8,16}", username.strip()):
        raise ValueError("用户名不能使用手机号。")
    return normalized


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone.strip())
    if digits.startswith("86") and len(digits) == 13:
        digits = digits[2:]
    if len(digits) != 11 or not digits.startswith("1"):
        raise ValueError("请输入正确的中国大陆手机号。")
    return f"+86{digits}"


def mask_phone(phone: str) -> str:
    normalized = normalize_phone(phone) if not phone.startswith("+86") else phone
    digits = normalized[-11:]
    return f"{digits[:3]}****{digits[-4:]}"


def hash_verification_code(phone_normalized: str, purpose: str, code: str) -> str:
    settings = get_settings()
    message = f"{phone_normalized}:{purpose}:{code}".encode()
    return hmac.new(settings.jwt_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def hash_invite_code(code: str) -> str:
    settings = get_settings()
    return hmac.new(settings.jwt_secret.encode("utf-8"), code.strip().upper().encode("utf-8"), hashlib.sha256).hexdigest()


def hash_phone(phone_normalized: str) -> str:
    settings = get_settings()
    return hmac.new(settings.jwt_secret.encode("utf-8"), phone_normalized.encode("utf-8"), hashlib.sha256).hexdigest()


def mask_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}****{api_key[-4:]}"


def _fernet() -> Fernet:
    settings = get_settings()
    digest = hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError, ValueError):
        # 兼容早期开发数据：旧版本曾直接保存明文 API Key。
        return value


def mask_secret(value: str) -> str:
    return mask_key(decrypt_secret(value))
