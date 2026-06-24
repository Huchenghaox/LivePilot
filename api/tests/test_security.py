import pytest

from app.security import (
    decrypt_secret,
    encrypt_secret,
    hash_password,
    mask_phone,
    mask_secret,
    normalize_phone,
    validate_username,
    verify_password,
)


def test_password_hash_round_trip():
    password_hash = hash_password("test123456")

    assert password_hash.startswith("pbkdf2_sha256$")
    assert verify_password("test123456", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_secret_encrypt_decrypt_and_mask():
    encrypted = encrypt_secret("sk-abcdef123456")

    assert encrypted != "sk-abcdef123456"
    assert decrypt_secret(encrypted) == "sk-abcdef123456"
    assert mask_secret(encrypted) == "sk-a****3456"


def test_username_and_phone_normalization_rules():
    assert validate_username("Anchor_01") == "anchor_01"
    assert normalize_phone("138 1234 5678") == "+8613812345678"
    assert mask_phone("+8613812345678") == "138****5678"

    for username in ["admin", "13812345678", "中文名", "a b c", "1anchor"]:
        with pytest.raises(ValueError):
            validate_username(username)
