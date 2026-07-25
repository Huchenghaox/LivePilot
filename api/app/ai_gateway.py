import base64
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.schemas import MetricsConfirm

SCREENSHOT_TYPES = ["直播概览", "流量趋势", "流量来源", "用户画像", "互动数据", "关注数据", "违规提示", "带货数据", "无法识别"]

METRIC_DEFINITIONS = {
    "live_date": {"label": "直播日期", "unit": "", "group": "核心数据"},
    "live_start_time": {"label": "直播开始时间", "unit": "", "group": "核心数据"},
    "duration_minutes": {"label": "直播时长", "unit": "分钟", "group": "核心数据"},
    "is_paid_traffic": {"label": "是否投流", "unit": "", "group": "核心数据"},
    "total_viewers": {"label": "累计观看人数", "unit": "人", "group": "流量"},
    "peak_online": {"label": "最高在线人数", "unit": "人", "group": "流量"},
    "average_online": {"label": "平均在线人数", "unit": "人", "group": "流量"},
    "impressions": {"label": "曝光人数", "unit": "人", "group": "流量"},
    "room_entries": {"label": "进入直播间人数", "unit": "人", "group": "流量"},
    "entry_rate": {"label": "曝光进入率", "unit": "%", "group": "流量"},
    "recommend_traffic_ratio": {"label": "推荐流量占比", "unit": "%", "group": "流量"},
    "follow_page_traffic_ratio": {"label": "关注页流量占比", "unit": "%", "group": "流量"},
    "fan_traffic_ratio": {"label": "粉丝流量占比", "unit": "%", "group": "流量"},
    "other_traffic_sources": {"label": "其他流量来源", "unit": "", "group": "流量"},
    "average_stay_seconds": {"label": "平均停留时长", "unit": "秒", "group": "停留"},
    "per_capita_watch_seconds": {"label": "人均观看时长", "unit": "秒", "group": "停留"},
    "one_minute_retention": {"label": "一分钟留存", "unit": "%", "group": "停留"},
    "comments": {"label": "评论数", "unit": "条", "group": "互动"},
    "likes": {"label": "点赞数", "unit": "次", "group": "互动"},
    "shares": {"label": "分享数", "unit": "次", "group": "互动"},
    "call_in_count": {"label": "连麦次数", "unit": "次", "group": "互动"},
    "fan_club_count": {"label": "粉丝团或灯牌数据", "unit": "", "group": "互动"},
    "new_followers": {"label": "新增关注", "unit": "人", "group": "关注"},
    "view_follow_rate": {"label": "观看关注率", "unit": "%", "group": "关注"},
    "new_fans": {"label": "新增粉丝", "unit": "人", "group": "关注"},
    "fan_growth": {"label": "粉丝增长", "unit": "人", "group": "关注"},
    "new_old_user_ratio": {"label": "新老用户比例", "unit": "", "group": "用户画像"},
    "fan_nonfan_ratio": {"label": "粉丝和非粉丝比例", "unit": "", "group": "用户画像"},
    "gender_distribution": {"label": "性别分布", "unit": "", "group": "用户画像"},
    "age_distribution": {"label": "年龄分布", "unit": "", "group": "用户画像"},
    "region_distribution": {"label": "地域分布", "unit": "", "group": "用户画像"},
    "product_impressions": {"label": "商品曝光", "unit": "次", "group": "成交"},
    "product_clicks": {"label": "商品点击", "unit": "次", "group": "成交"},
    "buyers": {"label": "成交人数", "unit": "人", "group": "成交"},
    "orders": {"label": "成交订单", "unit": "单", "group": "成交"},
    "gmv": {"label": "成交金额", "unit": "元", "group": "成交"},
    "click_rate": {"label": "点击率", "unit": "%", "group": "成交"},
    "conversion_rate": {"label": "成交转化率", "unit": "%", "group": "成交"},
    "has_violation": {"label": "是否出现违规提示", "unit": "", "group": "合规"},
    "violation_type": {"label": "违规类型", "unit": "", "group": "合规"},
    "violation_text": {"label": "违规原文", "unit": "", "group": "合规"},
    "violation_result": {"label": "处罚或提醒结果", "unit": "", "group": "合规"},
}


class ModelAdapterError(Exception):
    def __init__(self, message: str, error_type: str = "model_error"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


@dataclass
class VisionModelConfig:
    api_base: str
    api_key: str
    model_name: str
    timeout_seconds: int = 60
    max_retries: int = 1
    source: str = "openai_compatible"


@dataclass
class ChatModelConfig:
    api_base: str
    api_key: str
    model_name: str
    timeout_seconds: int = 60
    max_retries: int = 1
    source: str = "openai_compatible"


def normalize_metric_value(raw_value: Any, unit_hint: str = "") -> tuple[Any, str]:
    if raw_value is None:
        return None, unit_hint
    if isinstance(raw_value, bool):
        return raw_value, ""
    if isinstance(raw_value, (int, float)):
        return raw_value, unit_hint

    text = str(raw_value).strip().replace(",", "")
    if not text or text in {"-", "--", "无", "未显示", "无法识别"}:
        return None, unit_hint
    if text in {"是", "有", "已投流"}:
        return True, ""
    if text in {"否", "无", "未投流"}:
        return False, ""

    inferred_unit = unit_hint
    multiplier = 1.0
    if "万" in text:
        multiplier = 10000.0
    elif "千" in text:
        multiplier = 1000.0

    if "%" in text:
        inferred_unit = "%"
    elif "小时" in text:
        inferred_unit = "秒" if unit_hint == "秒" else "分钟"
    elif "分钟" in text or "分" in text:
        inferred_unit = "秒" if unit_hint == "秒" else "分钟"
    elif "秒" in text:
        inferred_unit = "秒"
    elif "元" in text or "¥" in text:
        inferred_unit = "元"

    number_text = "".join(char for char in text if char.isdigit() or char == ".")
    if not number_text:
        return text, inferred_unit
    value = float(number_text) * multiplier
    if "小时" in text and unit_hint == "秒":
        value *= 3600
    elif ("分钟" in text or "分" in text) and unit_hint == "秒":
        value *= 60
    if value.is_integer():
        value = int(value)
    return value, inferred_unit


def validate_vision_payload(
    payload: dict[str, Any],
    assets_by_filename: Optional[dict[str, dict]] = None,
    assets_in_order: Optional[list[dict]] = None,
) -> dict:
    assets_by_filename = assets_by_filename or {}
    assets_in_order = assets_in_order or []
    screenshots = []
    for index, item in enumerate(payload.get("screenshots", [])):
        filename = str(item.get("filename") or "")
        asset = assets_by_filename.get(filename, {}) or (assets_in_order[index] if index < len(assets_in_order) else {})
        asset_id = item.get("asset_id") or asset.get("id")
        screenshot_type = item.get("type") or item.get("screenshot_type") or "无法识别"
        if screenshot_type not in SCREENSHOT_TYPES:
            screenshot_type = "无法识别"
        screenshots.append(
            {
                "asset_id": asset_id,
                "filename": filename or asset.get("original_filename", ""),
                "type": screenshot_type,
                "reason": str(item.get("reason") or "模型未提供判断理由"),
                "confidence": int(item.get("confidence") or 0),
                "is_manually_confirmed": False,
                "user_corrected_type": "",
            }
        )

    screenshot_type_by_asset = {item["asset_id"]: item["type"] for item in screenshots}
    fields = []
    for item in payload.get("metrics", []):
        metric_key = str(item.get("metric_key") or "")
        if metric_key not in METRIC_DEFINITIONS:
            continue
        definition = METRIC_DEFINITIONS[metric_key]
        raw_value = item.get("raw_value")
        normalized_value, unit = normalize_metric_value(raw_value, definition["unit"])
        asset_id = item.get("source_screenshot_id") or item.get("asset_id") or (assets_in_order[0]["id"] if assets_in_order else None)
        final_value = normalized_value if normalized_value is not None else ""
        fields.append(
            {
                "metric_key": metric_key,
                "label": definition["label"],
                "group": definition["group"],
                "raw_value": "" if raw_value is None else str(raw_value),
                "normalized_value": normalized_value,
                "unit": unit,
                "source_screenshot_id": asset_id,
                "source_screenshot_type": item.get("source_screenshot_type") or screenshot_type_by_asset.get(asset_id, ""),
                "raw_text": str(item.get("raw_text") or ""),
                "confidence": int(item.get("confidence") or 0),
                "is_manually_confirmed": False,
                "manual_value": "",
                "final_value": final_value,
                "unreadable_reason": str(item.get("unreadable_reason") or "") if normalized_value is None else "",
                "recognized_at": datetime.utcnow().isoformat(),
            }
        )

    conflicts = detect_metric_conflicts(fields)
    conflict_keys = {conflict["metric_key"] for conflict in conflicts}
    for field in fields:
        field["has_conflict"] = field["metric_key"] in conflict_keys

    return {
        "screenshots": screenshots,
        "fields": fields,
        "conflicts": conflicts,
        "source": payload.get("source", "model"),
        "notice": payload.get("notice", "AI 已完成截图识别，请确认关键数据后再生成报告。"),
    }


def detect_metric_conflicts(fields: list[dict]) -> list[dict]:
    by_key: dict[str, list[dict]] = {}
    for field in fields:
        if field["normalized_value"] in (None, ""):
            continue
        by_key.setdefault(field["metric_key"], []).append(field)

    conflicts = []
    for metric_key, rows in by_key.items():
        values = {str(row["normalized_value"]) for row in rows}
        if len(values) > 1:
            conflicts.append(
                {
                    "metric_key": metric_key,
                    "label": rows[0]["label"],
                    "values": [
                        {
                            "value": row["normalized_value"],
                            "source_screenshot_id": row["source_screenshot_id"],
                            "source_screenshot_type": row["source_screenshot_type"],
                            "confidence": row["confidence"],
                        }
                        for row in rows
                    ],
                    "message": "同一指标在多张截图中识别出不同结果，请选择正确值。",
                }
            )
    return conflicts


def flatten_metrics_for_confirm(recognition: dict) -> dict:
    values: dict[str, Any] = {}
    for field in recognition["fields"]:
        if field.get("has_conflict"):
            continue
        current = values.get(field["metric_key"])
        candidate = field["final_value"]
        if candidate in (None, ""):
            continue
        if current is None or int(field.get("confidence") or 0) >= int(current.get("confidence") or 0):
            values[field["metric_key"]] = {"value": candidate, "confidence": field.get("confidence", 0)}
    return {
        "duration_minutes": int(values.get("duration_minutes", {}).get("value") or 0),
        "total_viewers": int(values.get("total_viewers", {}).get("value") or 0),
        "peak_online": int(values.get("peak_online", {}).get("value") or 0),
        "average_online": int(values.get("average_online", {}).get("value") or 0),
        "new_followers": int(values.get("new_followers", {}).get("value") or 0),
        "comments": int(values.get("comments", {}).get("value") or 0),
        "likes": int(values.get("likes", {}).get("value") or 0),
        "average_stay_seconds": int(values.get("average_stay_seconds", {}).get("value") or 0),
        "traffic_sources": str(values.get("other_traffic_sources", {}).get("value") or "暂未识别"),
    }


class OpenAICompatibleVisionAnalyzer:
    def __init__(self, config: VisionModelConfig):
        self.config = config
        self.source = config.source

    def recognize_assets(self, assets: list[dict]) -> dict:
        if not self.config.api_base or not self.config.api_key or not self.config.model_name:
            raise ModelAdapterError("请先选择平台模型，或在模型设置中添加自己的模型。", "missing_model_config")
        assets_by_filename = {asset["original_filename"]: asset for asset in assets}
        content = [{"type": "text", "text": self._prompt()}]
        for asset in assets:
            content.append(
                {
                    "type": "text",
                    "text": f"下一张截图的 asset_id={asset['id']}，filename={asset['original_filename']}。请在 JSON 中保留 asset_id。",
                }
            )
            mime = asset.get("content_type") or "image/png"
            data = base64.b64encode(Path(asset["path"]).read_bytes()).decode("ascii")
            content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}})

        response = self._request_chat_completion(content)
        payload = parse_json_response(response)
        payload["source"] = self.source
        return validate_vision_payload(payload, assets_by_filename, assets)

    def _request_chat_completion(self, content: list[dict]) -> dict:
        url = self.config.api_base.rstrip("/")
        if not url.endswith("/chat/completions"):
            url = f"{url}/chat/completions"
        body = {
            "model": self.config.model_name,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        data = json.dumps(body).encode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        last_error = None
        for _attempt in range(self.config.max_retries + 1):
            try:
                request = urllib.request.Request(url, data=data, headers=headers, method="POST")
                with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                last_error = exc
                if 400 <= exc.code < 500:
                    break
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
            time.sleep(0.2)
        raise ModelAdapterError(
            "图片识别模型连接异常，请检查模型设置后重试。",
            type(last_error).__name__ if last_error else "request_failed",
        )

    @staticmethod
    def _prompt() -> str:
        return (
            "你是直播运营数据截图识别器。请只根据截图中明确显示的内容提取数据，禁止猜测、补零或补全。"
            "返回严格 JSON，格式为："
            "{\"screenshots\":[{\"filename\":\"原文件名可为空\",\"type\":\"直播概览|流量趋势|流量来源|用户画像|互动数据|关注数据|违规提示|带货数据|无法识别\","
            "\"reason\":\"判断理由\",\"confidence\":0-100}],"
            "\"metrics\":[{\"metric_key\":\"字段英文key\",\"raw_value\":\"截图原值或null\",\"source_screenshot_id\":asset_id,"
            "\"source_screenshot_type\":\"截图类型\",\"raw_text\":\"周边原文\",\"confidence\":0-100,\"unreadable_reason\":\"无法读取原因\"}]}。"
            f"允许的 metric_key 只有：{', '.join(METRIC_DEFINITIONS.keys())}。"
            "百分比保留百分比数值，金额保留原始币种文字，无法读取时 raw_value 必须为 null。"
        )


class OpenAICompatibleChatClient:
    def __init__(self, config: ChatModelConfig):
        self.config = config

    def complete(self, prompt: str) -> dict:
        if not self.config.api_base or not self.config.api_key or not self.config.model_name:
            raise ModelAdapterError("请先选择平台模型，或在模型设置中添加自己的模型。", "missing_model_config")
        return request_openai_compatible_chat(
            api_base=self.config.api_base,
            api_key=self.config.api_key,
            model_name=self.config.model_name,
            messages=[{"role": "user", "content": prompt}],
            timeout_seconds=self.config.timeout_seconds,
            max_retries=self.config.max_retries,
        )


def manual_required_recognition(reason: str = "当前尚未配置图片识别模型，请手动录入关键数据，或稍后配置视觉模型。") -> dict:
    return {
        "screenshots": [],
        "fields": [],
        "conflicts": [],
        "source": "manual_required",
        "notice": reason,
    }


RULE_THRESHOLDS = {
    "online_gap_ratio": 2.0,
    "high_viewers": 1000,
    "low_average_online": 50,
    "low_stay_seconds": 45,
    "ok_stay_seconds": 60,
    "low_interaction_rate": 0.08,
    "high_interaction_rate": 0.12,
    "low_follow_rate": 0.02,
    "good_follow_rate": 0.03,
    "low_recommend_ratio": 30,
    "high_fan_ratio": 70,
}


def run_rule_diagnostics(metrics: MetricsConfirm, history: Optional[list[dict]] = None) -> list[dict]:
    history = history or []
    rules = []
    total_viewers = metrics.total_viewers or 0
    comments = metrics.comments or 0
    new_followers = metrics.new_followers or 0
    peak_online = metrics.peak_online or 0
    average_online_value = metrics.average_online or 0
    average_stay_seconds = metrics.average_stay_seconds or 0
    interaction_rate = comments / max(total_viewers, 1)
    follow_rate = new_followers / max(total_viewers, 1)
    average_online = max(average_online_value, 1)

    def add(name: str, matched_data: str, judgment: str, confidence: str, question: str) -> None:
        rules.append(
            {
                "rule_name": name,
                "matched_data": matched_data,
                "judgment": judgment,
                "confidence": confidence,
                "model_question": question,
            }
        )

    if peak_online and average_online_value and peak_online / average_online >= RULE_THRESHOLDS["online_gap_ratio"]:
        add(
            "最高在线与平均在线差距较大",
            f"最高在线 {peak_online}，平均在线 {average_online_value}",
            "可能存在流量峰值承接不足，但仅凭截图不能判断具体内容原因。",
            "中",
            "如何在不编造内容细节的前提下，给出流量峰值承接动作？",
        )
    if (
        total_viewers >= RULE_THRESHOLDS["high_viewers"]
        and average_online_value
        and average_online_value < RULE_THRESHOLDS["low_average_online"]
    ):
        add(
            "累计观看较高但平均在线较低",
            f"累计观看 {total_viewers}，平均在线 {average_online_value}",
            "进入人数有基础，但在线承接偏弱。",
            "中",
            "下一场应优先调整开场、主题复述还是互动节点？",
        )
    if average_stay_seconds and average_stay_seconds < RULE_THRESHOLDS["low_stay_seconds"]:
        add(
            "平均停留偏低",
            f"平均停留 {average_stay_seconds} 秒",
            "观众停留不足，需要强化进入后 30 秒的价值说明。",
            "高",
            "如何设计不依赖具体内容录像的停留提升动作？",
        )
    if (
        average_stay_seconds >= RULE_THRESHOLDS["ok_stay_seconds"]
        and total_viewers
        and interaction_rate < RULE_THRESHOLDS["low_interaction_rate"]
    ):
        add(
            "停留尚可但互动偏低",
            f"平均停留 {average_stay_seconds} 秒，互动率约 {interaction_rate:.1%}",
            "观众愿意看，但评论触发不足。",
            "中",
            "如何把开放问题改成低门槛互动？",
        )
    if total_viewers and interaction_rate >= RULE_THRESHOLDS["high_interaction_rate"] and follow_rate < RULE_THRESHOLDS["low_follow_rate"]:
        add(
            "互动较高但关注偏低",
            f"互动率约 {interaction_rate:.1%}，关注率约 {follow_rate:.1%}",
            "观众参与了，但关注理由不够具体。",
            "中",
            "如何把关注引导绑定到后续收益？",
        )
    if total_viewers and follow_rate >= RULE_THRESHOLDS["good_follow_rate"]:
        add(
            "关注转化较好",
            f"新增关注 {new_followers}，关注率约 {follow_rate:.1%}",
            "关注转化表现值得保留。",
            "中",
            "下一场如何保留关注引导方式并扩大触达？",
        )
    if total_viewers and interaction_rate >= RULE_THRESHOLDS["high_interaction_rate"]:
        add(
            "评论互动较好",
            f"评论 {comments}，互动率约 {interaction_rate:.1%}",
            "互动基础较好，下一场可复用互动形式。",
            "中",
            "如何把互动延伸到关注和停留？",
        )
    if metrics.has_violation:
        add(
            "有违规提示",
            metrics.violation_note or "用户确认本场出现违规提示",
            "合规风险会影响直播间承接，需要下一场先降低敏感表达。",
            "高",
            "如何给出不扩展事实的合规改写和开播提醒？",
        )
    if not any([total_viewers, average_online_value, average_stay_seconds, comments, new_followers]):
        add("数据不足", "关键指标为空", "当前材料不足以生成稳定判断。", "高", "应提示用户补充哪些关键数据？")

    if history:
        previous = history[0]
        previous_viewers = int(previous.get("total_viewers") or 0)
        if previous_viewers:
            delta = total_viewers - previous_viewers
            add(
                "上一场观看对比",
                f"本场累计观看 {total_viewers}，上一场 {previous_viewers}",
                "累计观看较上一场上升。" if delta > 0 else "累计观看较上一场下降。",
                "中",
                "如何结合上一场表现调整下一场目标？",
            )
    return rules


def request_openai_compatible_chat(
    *,
    api_base: str,
    api_key: str,
    model_name: str,
    messages: list[dict],
    timeout_seconds: int,
    max_retries: int,
    response_format: Optional[dict] = None,
) -> dict:
    url = api_base.rstrip("/")
    if not url.endswith("/chat/completions"):
        url = f"{url}/chat/completions"
    body: dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": 0,
    }
    if response_format:
        body["response_format"] = response_format
    data = json.dumps(body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    last_error = None
    for _attempt in range(max_retries + 1):
        try:
            request = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
                payload["_http_status"] = response.status
                payload["_request_url"] = url
                return payload
        except urllib.error.HTTPError as exc:
            last_error = exc
            if 400 <= exc.code < 500:
                break
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
        time.sleep(0.2)
    error_type = type(last_error).__name__ if last_error else "request_failed"
    raise ModelAdapterError("模型连接异常，请检查 API 地址、Key 和模型名称。", error_type)


def parse_json_response(response: dict) -> dict:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ModelAdapterError("模型返回格式异常，请稍后重试。", "invalid_model_response") from exc
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    content = str(content).strip()
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:].strip()
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ModelAdapterError("模型没有返回可用的结构化数据，请重新识别。", "invalid_json") from exc
    if not isinstance(payload, dict):
        raise ModelAdapterError("模型返回的数据结构不正确，请重新识别。", "invalid_json")
    return payload


class MockASRTranscriber:
    source = "mock"

    def transcribe(self, chunks: list[dict]) -> list[dict]:
        segments = []
        for chunk in chunks:
            start = int(chunk["start_seconds"])
            end = int(chunk["end_seconds"])
            midpoint = start + max(1, (end - start) // 2)
            segments.append(
                {
                    "chunk_index": int(chunk["chunk_index"]),
                    "start_seconds": start,
                    "end_seconds": midpoint,
                    "text": "欢迎刚进来的朋友，今天这场直播主要聊新手开播怎样留住人。",
                    "speaker": "未知",
                    "confidence": 82,
                    "source_file": chunk["path"],
                    "source": self.source,
                }
            )
            segments.append(
                {
                    "chunk_index": int(chunk["chunk_index"]),
                    "start_seconds": midpoint,
                    "end_seconds": end,
                    "text": "如果你也遇到开播没人互动，可以在评论区扣 1，我会按最多的问题继续讲。",
                    "speaker": "未知",
                    "confidence": 82,
                    "source_file": chunk["path"],
                    "source": self.source,
                }
            )
        return segments


RISK_KEYWORDS = {
    "极端判断": ["必须", "一定", "绝对"],
    "婚恋煽动": ["分手", "离婚"],
    "男女对立": ["男人都", "女人都"],
    "群体攻击": ["这类人都"],
    "人身攻击": ["废物", "蠢"],
    "医疗或心理诊断": ["抑郁症", "焦虑症", "诊断"],
    "法律定性": ["违法", "犯罪"],
    "政治敏感": ["政治"],
    "未成年人": ["未成年"],
    "色情低俗": ["色情", "低俗"],
    "暴力和自伤": ["自杀", "打死"],
    "隐私泄露": ["手机号", "身份证"],
    "诱导打赏": ["刷礼物", "打赏"],
    "站外引流": ["加微信", "私信我微信"],
    "虚假宣传": ["保证赚钱", "稳赚"],
    "绝对化承诺": ["百分百", "保你"],
}


class MockContentAnalyzer:
    source = "mock"

    def analyze(self, segments: list[dict]) -> dict:
        combined_text = " ".join(segment["text"] for segment in segments)
        risks = MockSpeechRiskAnalyzer().analyze(segments)
        interaction_segments = [segment for segment in segments if any(word in segment["text"] for word in ["扣", "评论区", "回复"])]
        follow_segments = [segment for segment in segments if "关注" in segment["text"]]
        highlights = [
            {
                "start_seconds": segment["start_seconds"],
                "end_seconds": segment["end_seconds"],
                "theme": "可复用直播话术",
                "reason": "这段内容表达具体，适合剪成短视频或保留为下一场话术。",
                "title": "新手开播留人的一句话",
                "cover_text": "刚进来的人怎么留住",
                "topics": ["直播复盘", "新手主播", "开播话术"],
            }
            for segment in segments[:3]
        ]

        issues = []
        if not follow_segments:
            issues.append("关注引导不够明确")
        if not interaction_segments:
            issues.append("互动问题不够具体")
        if len(combined_text) > 80 and len(interaction_segments) <= 1:
            issues.append("单向输出时间偏长")
        if risks:
            issues.append("存在需要人工确认的风险表达")

        return {
            "source": self.source,
            "summary": "本场内容已经有可复用话术基础，但需要更稳定地承接新用户，并减少长时间单向输出。",
            "opening_structure": "有主题介绍" if segments else "未识别到开场内容",
            "topic_sections": self._topic_sections(segments),
            "repetition": "暂未发现明显重复" if len(set(segment["text"] for segment in segments)) == len(segments) else "存在重复表达",
            "one_way_output": "需要增加互动节点" if len(interaction_segments) <= 1 else "互动节点基本充足",
            "interaction_questions": [segment["text"] for segment in interaction_segments],
            "follow_prompts": [segment["text"] for segment in follow_segments],
            "new_user_onboarding": [segment["text"] for segment in segments if "刚进来" in segment["text"] or "欢迎" in segment["text"]],
            "cold_moments": [] if interaction_segments else [{"start_seconds": 0, "reason": "长时间未识别到互动问题"}],
            "call_in_segments": [segment for segment in segments if "连麦" in segment["text"]],
            "high_value_points": [segment["text"] for segment in segments[:3]],
            "highlights": highlights,
            "risks": risks,
            "top_issues": issues[:3],
            "strength": "有可直接复用的口播表达，适合作为下一场开场素材。",
        }

    @staticmethod
    def _topic_sections(segments: list[dict]) -> list[dict]:
        return [
            {
                "start_seconds": segment["start_seconds"],
                "end_seconds": segment["end_seconds"],
                "title": f"内容段落 {index + 1}",
                "summary": segment["text"],
            }
            for index, segment in enumerate(segments[:6])
        ]


class MockSpeechRiskAnalyzer:
    source = "mock"

    def analyze(self, segments: list[dict]) -> list[dict]:
        risks = []
        for segment in segments:
            for category, keywords in RISK_KEYWORDS.items():
                if any(keyword in segment["text"] for keyword in keywords):
                    risks.append(
                        {
                            "transcript_segment_id": segment.get("id"),
                            "time_seconds": segment["start_seconds"],
                            "original_text": segment["text"],
                            "risk_type": category,
                            "risk_level": "建议修改",
                            "reason": "这句话可能被平台或观众理解为过度判断或敏感表达。",
                            "rewrite": "换成更温和、具体、可讨论的表达，避免绝对化和攻击性判断。",
                            "needs_human_review": True,
                            "source": self.source,
                        }
                    )
        return risks


class MockVisionAnalyzer:
    source = "mock"

    def recognize(self, filenames: list[str]) -> dict:
        assets = [
            {"id": index + 1, "original_filename": filename, "path": "", "content_type": "image/png"}
            for index, filename in enumerate(filenames)
        ]
        recognition = self.recognize_assets(assets)
        return {**flatten_metrics_for_confirm(recognition), **recognition, "screenshot_types": recognition["screenshots"]}

    def recognize_assets(self, assets: list[dict]) -> dict:
        payload = {
            "screenshots": [
                {
                    "asset_id": asset["id"],
                    "filename": asset["original_filename"],
                    "type": self._detect_screenshot_type(asset["original_filename"], index),
                    "reason": "根据文件名和截图顺序进行 Mock 类型判断，真实环境会由视觉模型读取画面内容。",
                    "confidence": 88 if self._has_type_keyword(asset["original_filename"]) else 78,
                }
                for index, asset in enumerate(assets)
            ],
            "metrics": self._mock_metrics(assets),
            "source": self.source,
            "notice": "AI 已自动判断截图类型并提取关键指标。当前为 Mock 图片识别结果，请在数据确认页按真实后台数据修正。",
        }
        assets_by_filename = {asset["original_filename"]: asset for asset in assets}
        return validate_vision_payload(payload, assets_by_filename, assets)

    @staticmethod
    def _detect_screenshot_type(filename: str, index: int) -> str:
        fallback_types = ["直播概览", "流量趋势", "用户画像", "互动数据", "关注数据", "流量来源", "违规提示", "带货数据"]
        keyword_types = {
            "overview": "直播概览",
            "概览": "直播概览",
            "traffic": "流量趋势",
            "流量": "流量趋势",
            "user": "用户画像",
            "用户": "用户画像",
            "互动": "互动数据",
            "comment": "互动数据",
            "粉丝": "关注数据",
            "关注": "关注数据",
            "follower": "关注数据",
            "source": "流量来源",
            "来源": "流量来源",
            "违规": "违规提示",
            "risk": "违规提示",
            "带货": "带货数据",
            "sale": "带货数据",
        }
        lower_name = filename.lower()
        return next((value for key, value in keyword_types.items() if key in lower_name), fallback_types[index % len(fallback_types)])

    @staticmethod
    def _has_type_keyword(filename: str) -> bool:
        keywords = ["overview", "概览", "traffic", "流量", "用户", "互动", "粉丝", "关注", "违规", "带货"]
        return any(keyword in filename.lower() for keyword in keywords)

    def _mock_metrics(self, assets: list[dict]) -> list[dict]:
        file_count = max(len(assets), 1)
        first_asset_id = assets[0]["id"] if assets else None
        second_asset_id = assets[1]["id"] if len(assets) > 1 else first_asset_id
        return [
            {
                "metric_key": "duration_minutes",
                "raw_value": "96分钟",
                "source_screenshot_id": first_asset_id,
                "source_screenshot_type": "直播概览",
                "raw_text": "直播时长 96分钟",
                "confidence": 86,
            },
            {
                "metric_key": "total_viewers",
                "raw_value": str(1200 + file_count * 80),
                "source_screenshot_id": first_asset_id,
                "source_screenshot_type": "直播概览",
                "raw_text": "累计观看",
                "confidence": 84,
            },
            {
                "metric_key": "peak_online",
                "raw_value": "86",
                "source_screenshot_id": first_asset_id,
                "source_screenshot_type": "直播概览",
                "raw_text": "最高在线",
                "confidence": 82,
            },
            {
                "metric_key": "average_online",
                "raw_value": "38",
                "source_screenshot_id": first_asset_id,
                "source_screenshot_type": "直播概览",
                "raw_text": "平均在线",
                "confidence": 82,
            },
            {
                "metric_key": "average_stay_seconds",
                "raw_value": "42秒",
                "source_screenshot_id": second_asset_id,
                "source_screenshot_type": "流量趋势",
                "raw_text": "平均停留 42秒",
                "confidence": 80,
            },
            {
                "metric_key": "new_followers",
                "raw_value": "24",
                "source_screenshot_id": first_asset_id,
                "source_screenshot_type": "关注数据",
                "raw_text": "新增关注",
                "confidence": 80,
            },
            {
                "metric_key": "comments",
                "raw_value": "158",
                "source_screenshot_id": second_asset_id,
                "source_screenshot_type": "互动数据",
                "raw_text": "评论数",
                "confidence": 78,
            },
            {
                "metric_key": "likes",
                "raw_value": "4200",
                "source_screenshot_id": second_asset_id,
                "source_screenshot_type": "互动数据",
                "raw_text": "点赞数",
                "confidence": 78,
            },
            {
                "metric_key": "other_traffic_sources",
                "raw_value": "推荐流量、关注页、同城",
                "source_screenshot_id": second_asset_id,
                "source_screenshot_type": "流量来源",
                "raw_text": "流量来源",
                "confidence": 74,
            },
        ]


class MockReviewCoach:
    source = "mock"

    def build_report(self, metrics: MetricsConfirm) -> dict:
        total_viewers = metrics.total_viewers or 0
        comments = metrics.comments or 0
        new_followers = metrics.new_followers or 0
        stay = metrics.average_stay_seconds or 0
        interaction_rate = comments / max(total_viewers, 1)
        follow_rate = new_followers / max(total_viewers, 1)

        main_problem = "新进入用户承接不足"
        if stay < 30:
            main_problem = "用户停留时间偏短"
        elif interaction_rate < 0.08:
            main_problem = "互动问题出现得太晚"
        elif follow_rate < 0.02:
            main_problem = "关注引导不够明确"

        return {
            "source": self.source,
            "summary": f"这场直播整体有基础流量，但{main_problem}，下一场应先改开场和每 15 分钟的承接话术。",
            "main_problem": main_problem,
            "strength": "直播中段内容能持续获得点赞，说明主题本身有吸引力，值得保留并前置。",
            "next_actions": [
                "开场 3 分钟先讲清今天能帮观众解决什么问题。",
                "每 15 分钟安排一次新用户承接和互动问题。",
                "把关注引导改成具体收益，不要只说“点点关注”。",
            ],
            "issues": [
                {
                    "title": main_problem,
                    "evidence": f"平均停留 {stay or '未填写'} 秒，累计观看 {total_viewers or '未填写'}。",
                    "reason": "新用户进入后没有立刻听到直播主题、适合谁、继续听的理由。",
                    "fix": "每轮内容开始前用 20 秒重申主题，并给出下一段看点。",
                    "script": "刚进来的朋友，我今天主要讲新手开播最容易卡住的三个地方，先听完这一段，你就知道下一场怎么调整。",
                    "target": "下一场平均停留提升到 60 秒以上。",
                },
                {
                    "title": "互动集中在后半段",
                    "evidence": f"评论 {comments or '未填写'} 条，互动率约 {interaction_rate:.1%}。",
                    "reason": "互动问题不够具体，观众不知道该怎么回复。",
                    "fix": "把开放式问题改成二选一或数字回复。",
                    "script": "如果你也遇到开播没人说话，扣 1；如果是有人来但留不住，扣 2。",
                    "target": "下一场评论数提升 30%。",
                },
                {
                    "title": "关注理由不够具体",
                    "evidence": f"新增关注 {new_followers or '未填写'}，关注率约 {follow_rate:.1%}。",
                    "reason": "观众没有感知到关注后的持续价值。",
                    "fix": "在内容小结后绑定关注收益。",
                    "script": "关注我，后面几场我会继续拆开播话术、留人方法和冷场救援，照着用就行。",
                    "target": "下一场新增关注率提升到 3%。",
                },
            ],
            "details": {
                "流量": f"累计观看 {total_viewers or '未填写'}，最高在线 {metrics.peak_online or '未填写'}。",
                "停留": f"平均停留 {stay or '未填写'} 秒。",
                "互动": f"评论 {comments or '未填写'}，点赞 {metrics.likes or '未填写'}。",
                "关注": f"新增关注 {new_followers or '未填写'}。",
                "流量来源": metrics.traffic_sources,
            },
            "next_plan": {
                "recommended_theme": "新手开播如何在前 3 分钟留住第一批观众",
                "titles": [
                    "新手开播没人留？先改这 3 句话",
                    "直播间刚进人，怎么让他愿意听下去",
                    "开播前 3 分钟这样讲，停留会更稳",
                    "别急着讲干货，先把新用户接住",
                    "下一场照着播：新手留人开场模板",
                ],
                "opening_3_minutes": (
                    "大家好，刚进来的朋友先别急着划走。今天这场我只讲一件事：新手开播时，"
                    "怎么在前 3 分钟让观众知道你在讲什么、适不适合他、为什么值得继续听。"
                    "你如果是开播有人进来但很快走，先在评论区扣 1，我会按这个问题一步一步拆。"
                ),
                "interaction_nodes": [
                    "第 5 分钟：让观众用 1/2 选择“没人进来”还是“来了留不住”。",
                    "第 18 分钟：请观众把最常卡住的一句话发到评论区。",
                    "第 35 分钟：让观众投票选择下一段先讲开场、互动还是关注引导。",
                ],
                "follow_prompts": [
                    "如果你想要下一场直接能用的开场模板，先点关注，后面我会继续拆。",
                    "关注我，接下来几场会把留人、互动、冷场救援分别讲清楚。",
                ],
                "new_traffic_script": (
                    "刚进来的朋友，我现在讲的是开播留人的第二步：观众进来后 20 秒内，"
                    "你要让他听懂这场和他有什么关系。前面没听到也没关系，从这里开始正好能接上。"
                ),
                "goals": [
                    "平均停留提升到 60 秒以上",
                    "评论数比本场提升 30%",
                    "新增关注率提升到 3%",
                ],
            },
        }
