from app.config import Settings
from app.media_processing import FFmpegProcessor, MediaProcessingError, ffmpeg_install_hint


def test_ffmpeg_processor_reports_clear_error_when_binary_missing():
    processor = FFmpegProcessor(
        Settings(
            ffmpeg_path="missing-ffmpeg-for-test",
            ffprobe_path="missing-ffprobe-for-test",
        )
    )

    try:
        processor.ensure_available()
    except MediaProcessingError as exc:
        assert exc.message == "音视频处理工具不可用，请安装 FFmpeg 后重试。"
        assert "brew install ffmpeg" in exc.install_hint
    else:
        raise AssertionError("expected MediaProcessingError")


def test_ffmpeg_install_hint_is_user_readable():
    assert "未检测到 FFmpeg" in ffmpeg_install_hint()
