import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import Settings
from app.models import UploadedAsset


class MediaProcessingError(Exception):
    def __init__(self, message: str, install_hint: str = ""):
        self.message = message
        self.install_hint = install_hint
        super().__init__(message)


@dataclass
class AudioChunkPlan:
    chunk_index: int
    start_seconds: int
    end_seconds: int
    path: str


def ffmpeg_install_hint() -> str:
    return "未检测到 FFmpeg。macOS 可执行：brew install ffmpeg；服务器可使用系统包管理器安装 ffmpeg。"


class FFmpegProcessor:
    def __init__(self, settings: Settings):
        self.settings = settings

    def ensure_available(self) -> None:
        if not shutil.which(self.settings.ffmpeg_path) or not shutil.which(self.settings.ffprobe_path):
            raise MediaProcessingError("音视频处理工具不可用，请安装 FFmpeg 后重试。", ffmpeg_install_hint())

    def process_asset(self, asset: UploadedAsset, *, job_id: int) -> list[AudioChunkPlan]:
        self.ensure_available()
        source = Path(asset.path)
        if not source.exists():
            raise MediaProcessingError("找不到已上传的音视频文件，请重新上传。")

        target_dir = source.parent / "processed" / str(job_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        normalized_audio = target_dir / "normalized.wav"

        self._run(
            [
                self.settings.ffmpeg_path,
                "-y",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(normalized_audio),
            ],
            "音频提取失败，请确认文件可以正常播放后重试。",
        )

        duration = self._probe_duration(normalized_audio)
        return self._split_audio(normalized_audio, target_dir, duration)

    def _probe_duration(self, path: Path) -> int:
        result = self._run(
            [
                self.settings.ffprobe_path,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            "读取音频时长失败，请重新上传文件后重试。",
        )
        try:
            duration = float(json.loads(result.stdout)["format"]["duration"])
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            raise MediaProcessingError("读取音频时长失败，请重新上传文件后重试。") from None
        return max(1, math.ceil(duration))

    def _split_audio(self, source: Path, target_dir: Path, duration: int) -> list[AudioChunkPlan]:
        chunk_seconds = max(60, self.settings.audio_chunk_seconds)
        chunks: list[AudioChunkPlan] = []
        for index, start in enumerate(range(0, duration, chunk_seconds)):
            end = min(start + chunk_seconds, duration)
            target = target_dir / f"chunk-{index:04d}-{start}-{end}.wav"
            self._run(
                [
                    self.settings.ffmpeg_path,
                    "-y",
                    "-ss",
                    str(start),
                    "-t",
                    str(end - start),
                    "-i",
                    str(source),
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    "-c:a",
                    "pcm_s16le",
                    str(target),
                ],
                "音频切片失败，请稍后重试。",
            )
            chunks.append(
                AudioChunkPlan(
                    chunk_index=index,
                    start_seconds=start,
                    end_seconds=end,
                    path=str(target),
                )
            )
        return chunks

    @staticmethod
    def _run(command: list[str], user_message: str) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            raise MediaProcessingError("音视频处理工具不可用，请安装 FFmpeg 后重试。", ffmpeg_install_hint()) from None
        except subprocess.CalledProcessError:
            raise MediaProcessingError(user_message) from None
