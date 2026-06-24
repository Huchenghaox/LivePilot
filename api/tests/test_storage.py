from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.storage import LocalStorage, media_kind_from_filename, safe_storage_filename


def make_upload(filename: str, content: bytes) -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content))


def test_media_kind_from_supported_extensions():
    assert media_kind_from_filename("live.MP4") == "video"
    assert media_kind_from_filename("voice.m4a") == "audio"


def test_media_kind_rejects_unsupported_extension():
    with pytest.raises(HTTPException) as exc:
        media_kind_from_filename("script.exe")

    assert exc.value.status_code == 400
    assert "仅支持" in exc.value.detail


def test_safe_storage_filename_keeps_extension_and_removes_unsafe_chars():
    filename = safe_storage_filename("../危险 文件.mp3")

    assert filename.endswith(".mp3")
    assert "/" not in filename
    assert " " not in filename


def test_local_storage_saves_upload(tmp_path):
    storage = LocalStorage(str(tmp_path))
    stored = storage.save_upload(
        make_upload("直播录音.mp3", b"audio-bytes"),
        user_id=1,
        session_id=2,
        max_bytes=1024,
    )

    assert stored.kind == "audio"
    assert stored.original_filename == "直播录音.mp3"
    assert stored.size_bytes == len(b"audio-bytes")


def test_local_storage_rejects_large_file(tmp_path):
    storage = LocalStorage(str(tmp_path))

    with pytest.raises(HTTPException) as exc:
        storage.save_upload(
            make_upload("long.mp4", b"x" * 12),
            user_id=1,
            session_id=2,
            max_bytes=8,
        )

    assert exc.value.status_code == 413
