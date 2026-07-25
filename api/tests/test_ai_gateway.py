import json

from app.ai_gateway import (
    MockReviewCoach,
    MockVisionAnalyzer,
    OpenAICompatibleVisionAnalyzer,
    VisionModelConfig,
    detect_metric_conflicts,
    normalize_metric_value,
    run_rule_diagnostics,
    validate_vision_payload,
)
from app.schemas import MetricsConfirm


def test_mock_vision_marks_source():
    result = MockVisionAnalyzer().recognize_assets(
        [
            {"id": 1, "original_filename": "overview.png", "path": "", "content_type": "image/png"},
            {"id": 2, "original_filename": "流量趋势.jpg", "path": "", "content_type": "image/png"},
        ]
    )

    assert result["source"] == "mock"
    assert result["screenshots"][0]["type"] == "直播概览"
    assert result["screenshots"][1]["type"] == "流量趋势"
    assert result["fields"][0]["metric_key"] == "duration_minutes"


def test_metric_value_normalization_handles_chinese_units():
    assert normalize_metric_value("1.2万", "人") == (12000, "人")
    assert normalize_metric_value("3分钟", "秒") == (180, "秒")
    assert normalize_metric_value("45.6%", "%") == (45.6, "%")
    assert normalize_metric_value("¥128.50", "元") == (128.5, "元")


def test_conflict_detection_keeps_duplicate_values_separate():
    payload = validate_vision_payload(
        {
            "screenshots": [
                {"asset_id": 1, "filename": "a.png", "type": "直播概览", "reason": "概览页", "confidence": 90},
                {"asset_id": 2, "filename": "b.png", "type": "流量趋势", "reason": "趋势页", "confidence": 90},
            ],
            "metrics": [
                {"metric_key": "total_viewers", "raw_value": "1000", "source_screenshot_id": 1, "confidence": 90},
                {"metric_key": "total_viewers", "raw_value": "1200", "source_screenshot_id": 2, "confidence": 82},
            ],
        }
    )

    conflicts = detect_metric_conflicts(payload["fields"])

    assert conflicts[0]["metric_key"] == "total_viewers"
    assert all(field["has_conflict"] for field in payload["fields"])


def test_openai_compatible_vision_adapter_parses_json(monkeypatch, tmp_path):
    image = tmp_path / "overview.png"
    image.write_bytes(b"png")
    response_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps(
                        {
                            "screenshots": [
                                {
                                    "asset_id": 7,
                                    "filename": "overview.png",
                                    "type": "直播概览",
                                    "reason": "出现直播概览",
                                    "confidence": 91,
                                }
                            ],
                            "metrics": [{"metric_key": "total_viewers", "raw_value": "1.5万", "source_screenshot_id": 7, "confidence": 88}],
                        },
                        ensure_ascii=False,
                    )
                }
            }
        ]
    }

    class FakeHTTPResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return json.dumps(response_payload).encode("utf-8")

    def fake_urlopen(request, timeout):
        assert request.headers["Authorization"].startswith("Bearer ")
        assert timeout == 9
        return FakeHTTPResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    analyzer = OpenAICompatibleVisionAnalyzer(
        VisionModelConfig(api_base="https://example.test/v1", api_key="sk-test", model_name="vision-test", timeout_seconds=9)
    )

    result = analyzer.recognize_assets(
        [{"id": 7, "original_filename": "overview.png", "path": str(image), "content_type": "image/png"}]
    )

    assert result["source"] == "openai_compatible"
    assert result["screenshots"][0]["type"] == "直播概览"
    assert result["fields"][0]["normalized_value"] == 15000


def test_review_report_has_three_issues_and_actions():
    metrics = MetricsConfirm(
        duration_minutes=90,
        total_viewers=1000,
        peak_online=80,
        average_online=35,
        new_followers=10,
        comments=50,
        likes=3000,
        average_stay_seconds=25,
        traffic_sources="推荐流量",
    )

    report = MockReviewCoach().build_report(metrics)

    assert report["source"] == "mock"
    assert len(report["issues"]) == 3
    assert len(report["next_actions"]) == 3
    assert report["main_problem"] == "用户停留时间偏短"
    assert report["next_plan"]["recommended_theme"]
    assert len(report["next_plan"]["titles"]) == 5
    assert len(report["next_plan"]["interaction_nodes"]) == 3
    assert len(report["next_plan"]["follow_prompts"]) == 2
    assert len(report["next_plan"]["goals"]) == 3


def test_rule_diagnostics_find_core_data_issues():
    metrics = MetricsConfirm(
        duration_minutes=90,
        total_viewers=1500,
        peak_online=120,
        average_online=30,
        new_followers=10,
        comments=40,
        likes=2000,
        average_stay_seconds=30,
        traffic_sources="暂未识别",
    )

    diagnostics = run_rule_diagnostics(metrics)
    names = {item["rule_name"] for item in diagnostics}

    assert "最高在线与平均在线差距较大" in names
    assert "累计观看较高但平均在线较低" in names
    assert "平均停留偏低" in names
