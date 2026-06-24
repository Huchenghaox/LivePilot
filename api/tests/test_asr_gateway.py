from app.ai_gateway import MockASRTranscriber


def test_mock_asr_transcriber_returns_timestamped_unknown_speaker_segments():
    segments = MockASRTranscriber().transcribe(
        [
            {
                "chunk_index": 0,
                "start_seconds": 0,
                "end_seconds": 120,
                "path": "/tmp/chunk.wav",
            }
        ]
    )

    assert len(segments) == 2
    assert segments[0]["start_seconds"] == 0
    assert segments[0]["end_seconds"] == 60
    assert segments[0]["speaker"] == "未知"
    assert segments[0]["source"] == "mock"
    assert segments[1]["start_seconds"] == 60
