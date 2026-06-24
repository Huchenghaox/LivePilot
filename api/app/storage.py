import re
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import get_settings

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".flv"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac"}
MEDIA_EXTENSIONS = VIDEO_EXTENSIONS | AUDIO_EXTENSIONS


@dataclass
class StoredFile:
    original_filename: str
    filename: str
    path: str
    content_type: str
    size_bytes: int
    kind: str


def media_kind_from_filename(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in VIDEO_EXTENSIONS:
        return "video"
    if suffix in AUDIO_EXTENSIONS:
        return "audio"
    raise HTTPException(status_code=400, detail="仅支持 MP4、MOV、MKV、FLV、MP3、WAV、M4A、AAC 文件")


def safe_storage_filename(original_filename: str) -> str:
    suffix = Path(original_filename).suffix.lower()
    stem = Path(original_filename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._") or "media"
    return f"{uuid.uuid4().hex}-{safe_stem[:48]}{suffix}"


class LocalStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)

    def save_upload(
        self,
        file: UploadFile,
        *,
        user_id: int,
        session_id: int,
        max_bytes: int,
    ) -> StoredFile:
        original_filename = file.filename or "media"
        kind = media_kind_from_filename(original_filename)
        filename = safe_storage_filename(original_filename)
        target_dir = self.base_dir / str(user_id) / str(session_id) / "media"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / filename
        size = 0

        try:
            with target.open("wb") as buffer:
                while True:
                    chunk = file.file.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        buffer.close()
                        target.unlink(missing_ok=True)
                        max_mb = max_bytes // 1024 // 1024
                        raise HTTPException(status_code=413, detail=f"文件过大，请上传 {max_mb}MB 以内的音视频")
                    buffer.write(chunk)
        except HTTPException:
            raise
        except OSError:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="文件保存失败，请稍后重试") from None
        finally:
            file.file.close()

        if size == 0:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="文件为空，请重新选择")

        return StoredFile(
            original_filename=original_filename,
            filename=filename,
            path=str(target),
            content_type=file.content_type or "",
            size_bytes=size,
            kind=kind,
        )

    def copy_existing(self, source: Path, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def get_storage() -> LocalStorage:
    return LocalStorage(get_settings().upload_dir)
