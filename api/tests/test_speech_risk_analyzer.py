from app.ai_gateway import MockSpeechRiskAnalyzer


def test_speech_risk_analyzer_outputs_required_fields():
    risks = MockSpeechRiskAnalyzer().analyze(
        [
            {
                "id": 12,
                "start_seconds": 90,
                "end_seconds": 120,
                "text": "这个方法百分百保你马上起号。",
            }
        ]
    )

    assert risks
    risk = risks[0]
    assert risk["transcript_segment_id"] == 12
    assert risk["time_seconds"] == 90
    assert risk["original_text"]
    assert risk["risk_type"] == "绝对化承诺"
    assert risk["risk_level"] == "建议修改"
    assert risk["reason"]
    assert risk["rewrite"]
    assert risk["needs_human_review"] is True
