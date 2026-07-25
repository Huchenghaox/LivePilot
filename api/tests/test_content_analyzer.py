from app.ai_gateway import MockContentAnalyzer


def test_content_analyzer_detects_interaction_and_risk():
    analysis = MockContentAnalyzer().analyze(
        [
            {
                "start_seconds": 0,
                "end_seconds": 30,
                "text": "欢迎刚进来的朋友，今天讲开播留人。",
            },
            {
                "start_seconds": 30,
                "end_seconds": 60,
                "text": "如果你也遇到没人互动，在评论区扣 1。",
            },
            {
                "start_seconds": 60,
                "end_seconds": 90,
                "text": "这个方法百分百保你马上起号。",
            },
        ]
    )

    assert analysis["source"] == "mock"
    assert analysis["interaction_questions"]
    assert analysis["new_user_onboarding"]
    assert analysis["risks"][0]["risk_type"] == "绝对化承诺"
    assert analysis["risks"][0]["needs_human_review"] is True
