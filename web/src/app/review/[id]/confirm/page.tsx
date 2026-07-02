"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, StatusMessage } from "@/components/ui";

type MetricField = {
  id?: number;
  metric_key: string;
  label: string;
  group: string;
  raw_value?: string;
  normalized_value?: string;
  unit: string;
  source_screenshot_id?: number;
  source_screenshot_type?: string;
  raw_text?: string;
  confidence?: number;
  is_manually_confirmed?: boolean;
  final_value: string | number | boolean | null;
  unreadable_reason?: string;
  has_conflict?: boolean;
  deleted?: boolean;
};

type Metrics = {
  impressions: number | null;
  room_entries: number | null;
  entry_rate: number | null;
  duration_minutes: number | null;
  total_viewers: number | null;
  peak_online: number | null;
  average_online: number | null;
  new_followers: number | null;
  comments: number | null;
  likes: number | null;
  shares: number | null;
  fan_club_joins: number | null;
  average_watch_seconds: number | null;
  yinlang: number | null;
  gift_users: number | null;
  gift_rate: number | null;
  member_income: number | null;
  guardian_income: number | null;
  estimated_income: number | null;
  traffic_sources: string;
  live_date?: string;
  has_paid_promotion?: boolean | null;
  has_violation?: boolean | null;
  violation_note?: string;
  session_topic?: string;
  main_goal?: string;
  has_cohost?: boolean | null;
  self_review?: string;
  abnormal_notes?: string;
  additional_metrics?: { metric_key: string; label: string; value: string | number | boolean | null; unit: string; group: string }[];
  source?: string;
  notice?: string;
  screenshot_types?: { filename: string; type: string; confidence: number; reason?: string }[];
  fields?: MetricField[];
};

const groupOrder = ["营收", "流量", "停留", "互动", "关注", "用户画像", "成交", "合规", "自定义"];

const legacyMap: Record<string, keyof Metrics> = {
  duration_minutes: "duration_minutes",
  impressions: "impressions",
  room_entries: "room_entries",
  entry_rate: "entry_rate",
  total_viewers: "total_viewers",
  peak_online: "peak_online",
  average_online: "average_online",
  new_followers: "new_followers",
  comments: "comments",
  likes: "likes",
  shares: "shares",
  fan_club_joins: "fan_club_joins",
  average_watch_seconds: "average_watch_seconds",
  yinlang: "yinlang",
  gift_users: "gift_users",
  gift_rate: "gift_rate",
  member_income: "member_income",
  guardian_income: "guardian_income",
  estimated_income: "estimated_income",
  other_traffic_sources: "traffic_sources"
};

const quickMetricOptions = [
  ["yinlang", "收获音浪", "营收", "音浪"],
  ["gift_users", "送礼人数", "营收", "人"],
  ["gift_rate", "送礼率", "营收", "%"],
  ["member_income", "会员收入", "营收", "元"],
  ["guardian_income", "星守护收入", "营收", "元"],
  ["estimated_income", "预计本场收入", "营收", "元"],
  ["impressions", "曝光人数", "流量", "人"],
  ["room_entries", "进房人数", "流量", "人"],
  ["entry_rate", "进房率", "流量", "%"],
  ["total_viewers", "累计观看人数", "流量", "人"],
  ["recommended_traffic_ratio", "推荐流量占比", "流量", "%"],
  ["fan_traffic_ratio", "粉丝流量占比", "流量", "%"],
  ["average_watch_seconds", "人均停留时长", "停留", "秒"],
  ["comments", "评论人数", "互动", "人"],
  ["shares", "分享数", "互动", "次"],
  ["new_followers", "新增关注", "关注", "人"],
  ["fan_club_joins", "加粉丝团人数", "关注", "人"],
  ["follow_rate", "观看关注率", "关注", "%"],
  ["new_vs_returning_users", "新老用户比例", "用户画像", ""],
  ["gender_distribution", "性别分布", "用户画像", ""],
  ["age_distribution", "年龄分布", "用户画像", ""],
  ["region_distribution", "地域分布", "用户画像", ""],
  ["product_clicks", "商品点击", "成交", "次"],
  ["buyers", "成交人数", "成交", "人"],
  ["revenue", "成交金额", "成交", "元"],
  ["orders", "成交订单", "成交", "单"],
  ["conversion_rate", "转化率", "成交", "%"],
  ["refunds", "退款情况", "成交", ""],
  ["has_violation", "是否出现违规提示", "合规", ""],
  ["violation_note", "违规提示内容", "合规", ""],
  ["custom_metric", "其他自定义指标", "自定义", ""]
];

const fixedTemplateMetricOptions = [
  ["yinlang", "收获音浪", "营收", "音浪"],
  ["gift_users", "送礼人数", "营收", "人"],
  ["gift_rate", "送礼率", "营收", "%"],
  ["gift_income", "礼物收入", "营收", "元"],
  ["revenue", "成交金额 / GMV", "成交", "元"],
  ["orders", "成交订单", "成交", "单"],
  ["buyers", "成交人数", "成交", "人"],
  ["conversion_rate", "转化率", "成交", "%"],
  ["total_viewers", "累计观看", "流量", "人"]
];

const coreMetricOptions = [
  ["live_date", "直播日期", "核心数据", "", "例如 2026-06-24"],
  ["duration_minutes", "直播时长", "核心数据", "分钟", "例如 120、2小时"],
  ["impressions", "曝光人数", "核心数据", "人", "例如 2.3万"],
  ["room_entries", "进房人数", "核心数据", "人", "例如 5143"],
  ["entry_rate", "进房率", "核心数据", "%", "例如 22.1%"],
  ["peak_online", "最高在线", "核心数据", "人", "例如 320"],
  ["average_online", "平均在线", "核心数据", "人", "例如 86"],
  ["average_watch_seconds", "人均停留", "核心数据", "秒", "例如 45秒、2.2分钟"],
  ["new_followers", "新增关注", "核心数据", "人", "例如 120"],
  ["comments", "评论人数", "核心数据", "人", "例如 77"],
  ["likes", "点赞数", "核心数据", "次", "例如 3.5万"],
  ["shares", "分享次数", "核心数据", "次", "例如 5"],
  ["fan_club_joins", "加粉丝团人数", "核心数据", "人", "例如 19"],
  ["yinlang", "收获音浪", "核心数据", "音浪", "例如 447"],
  ["estimated_income", "预计本场收入", "核心数据", "元", "例如 19元"],
  ["has_paid_promotion", "是否投流", "核心数据", "", "选择即可"],
  ["has_violation", "是否收到违规提示", "核心数据", "", "选择即可"]
];

const metricMeta = new Map([...coreMetricOptions, ...quickMetricOptions, ...fixedTemplateMetricOptions].map(([key, label, group, unit]) => [key, { label, group, unit }]));

const textMetricKeys = new Set([
  "live_date",
  "other_traffic_sources",
  "new_vs_returning_users",
  "gender_distribution",
  "age_distribution",
  "region_distribution",
  "refunds",
  "violation_note"
]);

const generationSteps = ["整理数据", "基础诊断", "匹配规则", "AI分析", "生成方案"];

export default function ConfirmPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricFields, setMetricFields] = useState<MetricField[]>([]);
  const [reportType, setReportType] = useState<"simple" | "professional" | "both">("simple");
  const [temporaryInstruction, setTemporaryInstruction] = useState("");
  const [saveTemporaryAsRule, setSaveTemporaryAsRule] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generationStep, setGenerationStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const generationRunningRef = useRef(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<Metrics>(`/api/live-sessions/${params.id}/metrics`);
      const fields = mergeTemplateFields(mergeCoreFields(result.fields?.length ? result.fields.map(normalizeField) : legacyFields(result), result));
      setMetrics(result);
      setMetricFields(fields);
      console.info("LivePilot screenshot pipeline frontend rendered fields count", {
        liveSessionId: params.id,
        fieldCount: fields.filter((field) => !field.deleted).length,
        fieldKeys: fields.filter((field) => !field.deleted).map((field) => field.metric_key)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (generationRunningRef.current) return;
    if (!metrics) return;
    generationRunningRef.current = true;
    setWorking(true);
    setError("");
    setFieldErrors({});
    try {
      const validation = validateFields(metricFields);
      if (Object.keys(validation).length) {
        setFieldErrors(validation);
        throw new Error("请先修改标红的数据，再生成报告。");
      }
      const activeFields = metricFields.filter((field) => !field.deleted);
      setGenerationStep("正在整理直播数据");
      await apiFetch(`/api/live-sessions/${params.id}/recognized-fields`, {
        method: "POST",
        body: JSON.stringify({ fields: metricFields.map(fieldPayload) })
      });
      const payload = buildLegacyMetrics(metrics, activeFields);
      setGenerationStep("正在进行基础诊断");
      await apiFetch(`/api/live-sessions/${params.id}/metrics`, { method: "PUT", body: JSON.stringify(payload) });
      setGenerationStep("正在匹配规则与特别提示");
      await new Promise((resolve) => setTimeout(resolve, 150));
      setGenerationStep("正在调用AI分析");
      await apiFetch(`/api/live-sessions/${params.id}/report`, {
        method: "POST",
        body: JSON.stringify({
          report_type: reportType,
          metrics: payload,
          temporary_instruction: temporaryInstruction,
          save_temporary_as_rule: saveTemporaryAsRule
        })
      });
      setGenerationStep("正在检查报告质量");
      await new Promise((resolve) => setTimeout(resolve, 250));
      setGenerationStep("正在生成下一场方案");
      router.push(`/report/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setWorking(false);
      setGenerationStep("");
      generationRunningRef.current = false;
    }
  }

  function updateField(index: number, patch: Partial<MetricField>) {
    setMetricFields((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function addField() {
    const [metric_key, label, group, unit] = quickMetricOptions[0];
    setMetricFields((items) => [
      ...items,
      { metric_key, label, group, unit, final_value: "", confidence: 100, is_manually_confirmed: true, source_screenshot_type: "手动补充" }
    ]);
  }

  function addCustomField() {
    setMetricFields((items) => [
      ...items,
      {
        metric_key: `custom_${Date.now()}`,
        label: "",
        group: "自定义",
        unit: "",
        final_value: "",
        confidence: 100,
        is_manually_confirmed: true,
        source_screenshot_type: "手动补充"
      }
    ]);
  }

  const groupedFields = useMemo(() => {
    return groupOrder.map((group) => ({
      group,
      fields: metricFields.map((field, index) => ({ field, index })).filter((item) => item.field.group === group && !item.field.deleted && !isPendingManualField(item.field))
    }));
  }, [metricFields]);

  const coreFields = useMemo(() => metricFields.map((field, index) => ({ field, index })).filter((item) => item.field.group === "核心数据" && !item.field.deleted), [metricFields]);
  const filledCoreCount = useMemo(() => coreFields.filter(({ field }) => hasFieldValue(field)).length, [coreFields]);
  const missingCoreFields = useMemo(() => coreFields.filter(({ field }) => !hasFieldValue(field)).map(({ field }) => field.label).slice(0, 6), [coreFields]);

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="确认识别数据" desc="先确认关键数据，再生成复盘。低置信度和冲突数据会突出显示。" />
      <div className="mb-5 rounded-2xl border border-white/10 bg-panel/70 p-4 shadow-card backdrop-blur">
        <div className="hidden items-center gap-3 md:flex">
          {["基础信息", "数据录入", "确认数据", "规则与方式", "AI报告"].map((step, index) => (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < 2 ? "border border-success/30 bg-success/10 text-success" : index === 2 ? "brand-gradient text-ink shadow-glow" : "border border-white/10 bg-white/5 text-slate-400"}`}>
                {index + 1}
              </div>
              <div className={index === 2 ? "truncate text-sm font-semibold text-slate-100" : "truncate text-sm text-slate-500"}>{step}</div>
              {index < 4 ? <div className="h-px flex-1 bg-white/10" /> : null}
            </div>
          ))}
        </div>
        <div className="md:hidden">
          <div className="text-xs text-brand">第 3 步，共 5 步</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">确认数据并选择报告方式</div>
        </div>
      </div>
      {loading ? <StatusMessage type="loading" text="正在读取 AI 识别结果..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {metrics ? (
        <div className="space-y-5">
          <Card>
            {metrics.notice ? <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{metrics.notice}</div> : null}
            {metrics.screenshot_types?.length ? (
              <div>
                <div className="mb-3 text-sm font-bold text-slate-100">AI 自动识别的截图类型</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {metrics.screenshot_types.map((item) => (
                    <div key={`${item.filename}-${item.type}`} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                      <div className="font-medium text-slate-100">{item.type}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.filename}</div>
                      {item.reason ? <div className="mt-1 text-xs text-slate-500">{item.reason}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="mb-5">
              <div className="text-xs font-semibold text-brand">正式分析前的关键一步</div>
              <h2 className="mt-1 text-xl font-bold text-slate-50">AI 已先读一遍，你只需要补缺口</h2>
              <p className="mt-2 text-sm text-slate-500">
                已识别 {filledCoreCount} 项核心信息。空字段可以留空，系统会按“数据不足”处理，不会自动当成 0。
              </p>
              {missingCoreFields.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">建议补充</span>
                  {missingCoreFields.map((label) => (
                    <span key={label} className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-slate-500">{label}</span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 inline-flex rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">核心信息已基本完整</div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {coreFields.map(({ field, index }) => (
                <MetricInput key={`${field.metric_key}-${index}`} field={field} index={index} error={fieldErrors[field.metric_key]} onUpdate={updateField} />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-xl font-bold text-slate-50">主播补充说明</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="本场直播主题" value={metrics.session_topic ?? ""} placeholder="例如 新手开播留人方法" onChange={(value) => setMetrics({ ...metrics, session_topic: value })} />
              <TextInput label="本场最想解决的问题" value={metrics.main_goal ?? ""} placeholder="例如 进来的人留不住" onChange={(value) => setMetrics({ ...metrics, main_goal: value })} />
              <SelectInput label="是否投流" value={boolToSelect(metrics.has_paid_promotion)} onChange={(value) => setMetrics({ ...metrics, has_paid_promotion: selectToBool(value) })} />
              <SelectInput label="是否连麦" value={boolToSelect(metrics.has_cohost)} onChange={(value) => setMetrics({ ...metrics, has_cohost: selectToBool(value) })} />
              <TextInput label="自己感觉哪里不好" value={metrics.self_review ?? ""} placeholder="例如 开场讲得太慢，互动少" onChange={(value) => setMetrics({ ...metrics, self_review: value })} />
              <TextInput label="设备、网络或其他异常" value={metrics.abnormal_notes ?? ""} placeholder="例如 中途断网 2 分钟" onChange={(value) => setMetrics({ ...metrics, abnormal_notes: value })} />
            </div>
          </Card>

          <details className="rounded-2xl border border-white/10 bg-panel/80 p-5 shadow-card backdrop-blur">
            <summary className="cursor-pointer text-lg font-bold text-slate-50">补充更多数据</summary>
            <div className="mt-5 space-y-5">
              {groupedFields.map(({ group, fields }) => (
            <div key={group} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-50">{group}</h2>
                {!fields.length ? <span className="text-xs text-slate-400">暂无识别数据</span> : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {fields.map(({ field, index }) => (
                  <div key={`${field.id ?? "new"}-${index}`} className={`rounded-2xl border p-3 ${field.has_conflict ? "border-danger/30 bg-danger/10" : (field.confidence ?? 100) < 70 ? "border-warning/30 bg-warning/10" : "border-white/10 bg-white/5"}`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-100">{field.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          来源：{field.source_screenshot_type || "未标明"}{field.source_screenshot_id ? ` #${field.source_screenshot_id}` : ""}
                        </div>
                      </div>
                      <button className="text-xs font-semibold text-danger" onClick={() => updateField(index, { deleted: true })}>删除</button>
                    </div>
                    {field.has_conflict ? <div className="mb-2 text-xs text-danger">多张截图识别结果冲突，请确认正确值。</div> : null}
                    {(field.confidence ?? 100) < 70 ? <div className="mb-2 text-xs text-warning">置信度较低，建议人工核对。</div> : null}
                    {field.unreadable_reason ? <div className="mb-2 text-xs text-slate-500">{field.unreadable_reason}</div> : null}
                    <MetricValueInput field={field} index={index} error={fieldErrors[field.metric_key]} onUpdate={updateField} />
                    {field.raw_text ? <div className="mt-2 text-xs text-slate-500">原文：{field.raw_text}</div> : null}
                  </div>
                ))}
              </div>
            </div>
              ))}
            </div>
          </details>

          <Card>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand" onClick={addField}>添加常用指标</button>
              <button className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300" onClick={addCustomField}>添加自定义指标</button>
            </div>
            {metricFields.some((field) => isPendingManualField(field) && !field.deleted) ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {metricFields.map((field, index) => isPendingManualField(field) && !field.deleted ? (
                  <div key={`new-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <select className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={quickMetricOptions.some((item) => item[0] === field.metric_key) ? field.metric_key : "custom_metric"} onChange={(event) => {
                      const selected = quickMetricOptions.find((item) => item[0] === event.target.value) ?? quickMetricOptions[0];
                      if (selected[0] === "custom_metric") {
                        updateField(index, { metric_key: `custom_${Date.now()}`, label: "", group: "自定义", unit: "" });
                      } else {
                        updateField(index, { metric_key: selected[0], label: selected[1], group: selected[2], unit: selected[3] });
                      }
                    }}>
                      {quickMetricOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    {field.group === "自定义" ? (
                      <input className="mb-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="指标名称，例如 退款订单数" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                    ) : null}
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="填写数值" value={String(field.final_value ?? "")} onChange={(event) => updateField(index, { final_value: event.target.value })} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="单位，可不填" value={field.unit} onChange={(event) => updateField(index, { unit: event.target.value })} />
                      <button className="rounded-md border border-danger/30 px-3 py-2 text-sm text-danger" onClick={() => updateField(index, { deleted: true })}>删除</button>
                    </div>
                  </div>
                ) : null)}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="mb-2 text-sm font-medium text-slate-100">报告方式</div>
            <div className="grid gap-2 md:grid-cols-3">
              {[
                ["simple", "直接告诉我怎么改"],
                ["professional", "给我专业分析"],
                ["both", "两种都要"]
              ].map(([value, label]) => (
                <button key={value} className={`rounded-2xl border p-3 text-sm font-semibold transition ${reportType === value ? "border-brand bg-brand/10 text-brand shadow-glow" : "border-white/10 bg-white/5 text-slate-300 hover:border-brand/30"}`} onClick={() => setReportType(value as typeof reportType)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium">这次分析还有什么需要AI特别注意？</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="例如：最近平台对诱导打赏查得严，下一场话术要更温和。"
                value={temporaryInstruction}
                onChange={(event) => setTemporaryInstruction(event.target.value)}
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" checked={saveTemporaryAsRule} onChange={(event) => setSaveTemporaryAsRule(event.target.checked)} />
                保存为该主播的长期提醒，稍后在规则与提示中确认生效
              </label>
            </div>
            <PrimaryButton className="mt-5" disabled={working} onClick={generate}>
              {working ? generationStep || "正在生成报告..." : "确认并生成报告"}
            </PrimaryButton>
            {working ? (
              <div className="mt-4 rounded-2xl border border-brand/25 bg-brand/10 p-4">
                <div className="mb-3 text-sm font-semibold text-brand">{generationStep}</div>
                <div className="grid gap-2 md:grid-cols-5">
                  {generationSteps.map((step) => (
                    <div key={step} className={`rounded-xl border px-3 py-2 text-xs ${generationStep.includes(step.slice(0, 2)) ? "border-brand/40 bg-brand/15 text-brand" : "border-white/10 bg-white/5 text-slate-500"}`}>{step}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
          <div className="sticky bottom-4 z-10 rounded-2xl border border-white/10 bg-panel/90 p-3 shadow-card backdrop-blur">
            <PrimaryButton className="w-full" disabled={working} onClick={generate}>
              {working ? generationStep || "正在生成报告..." : "确认并生成报告"}
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalizeField(field: MetricField): MetricField {
  const meta = metricMeta.get(field.metric_key);
  return {
    ...field,
    label: field.label && field.label !== field.metric_key ? field.label : (meta?.label ?? field.label),
    group: field.group || meta?.group || "核心数据",
    unit: field.unit || meta?.unit || "",
    final_value: field.final_value ?? field.normalized_value ?? field.raw_value ?? ""
  };
}

function mergeCoreFields(fields: MetricField[], metrics: Metrics): MetricField[] {
  const merged = [...fields];
  for (const [metric_key, label, group, unit] of coreMetricOptions) {
    const existingIndex = merged.findIndex((item) => item.metric_key === metric_key);
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        label,
        group,
        unit: merged[existingIndex].unit || unit
      };
    } else {
      merged.unshift({
        metric_key,
        label,
        group,
        unit,
        final_value: (metrics as unknown as Record<string, string | number | boolean | null | undefined>)[metric_key] ?? "",
        confidence: 100,
        is_manually_confirmed: true,
        source_screenshot_type: "手动录入"
      });
    }
  }
  return merged.sort((a, b) => coreSort(a.metric_key) - coreSort(b.metric_key));
}

function mergeTemplateFields(fields: MetricField[]): MetricField[] {
  const merged = [...fields];
  for (const [metric_key, label, group, unit] of fixedTemplateMetricOptions) {
    if (merged.some((item) => item.metric_key === metric_key)) continue;
    merged.push({
      metric_key,
      label,
      group,
      unit,
      final_value: "",
      confidence: 100,
      is_manually_confirmed: true,
      source_screenshot_type: "待补充"
    });
  }
  return merged;
}

function coreSort(key: string) {
  const index = coreMetricOptions.findIndex((item) => item[0] === key);
  return index === -1 ? 100 : index;
}

function legacyFields(metrics: Metrics): MetricField[] {
  return Object.entries(legacyMap).map(([metric_key, key]) => ({
    metric_key,
    label: metricMeta.get(metric_key)?.label ?? (metric_key === "other_traffic_sources" ? "流量来源" : String(key)),
    group: metricMeta.get(metric_key)?.group ?? (metric_key === "other_traffic_sources" ? "流量" : "核心数据"),
    unit: metricMeta.get(metric_key)?.unit ?? "",
    final_value: metrics[key] as string | number | boolean,
    confidence: 100,
    source_screenshot_type: "旧版识别"
  }));
}

function isPendingManualField(field: MetricField) {
  return !field.id && field.source_screenshot_type === "手动补充";
}

function fieldPayload(field: MetricField) {
  return {
    id: field.id,
    metric_key: field.metric_key,
    label: field.label,
    group: field.group,
    final_value: field.final_value === null ? "" : String(field.final_value ?? ""),
    unit: field.unit,
    source_screenshot_id: field.source_screenshot_id,
    source_screenshot_type: field.source_screenshot_type ?? "",
    deleted: Boolean(field.deleted)
  };
}

function buildLegacyMetrics(metrics: Metrics, fields: MetricField[]) {
  const result: Record<string, unknown> = { ...metrics };
  delete result.source;
  delete result.notice;
  delete result.screenshot_types;
  delete result.fields;
  for (const [metricKey, targetKey] of Object.entries(legacyMap)) {
    const field = fields.find((item) => item.metric_key === metricKey && !item.has_conflict);
    if (!field) continue;
    const value = String(field.final_value ?? "");
    result[targetKey] = targetKey === "traffic_sources" ? value : normalizeClientValue(value);
  }
  for (const key of ["live_date", "has_paid_promotion", "has_violation"]) {
    const field = fields.find((item) => item.metric_key === key);
    if (field) result[key] = field.final_value === "" ? null : field.final_value;
  }
  const legacyKeys = new Set([...Object.keys(legacyMap), "live_date", "has_paid_promotion", "has_violation"]);
  result.additional_metrics = fields
    .filter((item) => !legacyKeys.has(item.metric_key) && item.final_value !== "" && item.final_value !== null)
    .map((item) => ({
      metric_key: item.metric_key,
      label: item.label || "自定义指标",
      value: item.final_value,
      unit: item.unit,
      group: item.group
    }));
  return result;
}

function normalizeClientValue(value: string) {
  const text = value.trim();
  if (!text) return null;
  const cleaned = text.replace(/,/g, "").replace(/，/g, "");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return text;
  let number = Number(match[0]);
  if (cleaned.includes("万")) number *= 10000;
  if (cleaned.includes("千")) number *= 1000;
  if (cleaned.includes("小时")) number *= 3600;
  else if (cleaned.includes("分钟") || cleaned.includes("分")) number *= 60;
  return Number.isInteger(number) ? number : Number(number.toFixed(2));
}

function MetricInput({ field, index, error, onUpdate }: { field: MetricField; index: number; error?: string; onUpdate: (index: number, patch: Partial<MetricField>) => void }) {
  const hasValue = hasFieldValue(field);
  if (field.metric_key === "has_paid_promotion" || field.metric_key === "has_violation") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-100">{field.label}</label>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${hasValue ? "bg-brand/10 text-brand" : "bg-warning/10 text-warning"}`}>{hasValue ? "已识别" : "待补充"}</span>
        </div>
        <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={boolToSelect(field.final_value as boolean | null)} onChange={(event) => onUpdate(index, { final_value: selectToBool(event.target.value) })}>
          <option value="">未填写</option>
          <option value="no">否</option>
          <option value="yes">是</option>
        </select>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border p-3 ${error ? "border-danger/30 bg-danger/10" : "border-white/10 bg-white/5"}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-slate-100">{field.label}{field.unit ? <span className="ml-1 text-xs text-slate-500">单位：{field.unit}</span> : null}</label>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${hasValue ? "bg-brand/10 text-brand" : "bg-warning/10 text-warning"}`}>{hasValue ? "已识别" : "待补充"}</span>
      </div>
      <MetricValueInput field={field} index={index} error={error} onUpdate={onUpdate} />
      <div className="mt-1 text-xs text-slate-400">{coreMetricOptions.find((item) => item[0] === field.metric_key)?.[4] ?? "可留空"}</div>
    </div>
  );
}

function hasFieldValue(field: MetricField) {
  return field.final_value !== "" && field.final_value !== null && field.final_value !== undefined;
}

function MetricValueInput({ field, index, error, onUpdate }: { field: MetricField; index: number; error?: string; onUpdate: (index: number, patch: Partial<MetricField>) => void }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <input className={`rounded-md border px-3 py-2 text-sm ${error ? "border-danger/40" : "border-slate-300"}`} value={String(field.final_value ?? "")} onChange={(event) => onUpdate(index, { final_value: event.target.value })} />
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={field.unit} onChange={(event) => onUpdate(index, { unit: event.target.value })} />
      </div>
      {error ? <div className="mt-1 text-xs text-danger">{error}</div> : null}
    </>
  );
}

function TextInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-100">{label}</span>
      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-100">{label}</span>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">未填写</option>
        <option value="no">否</option>
        <option value="yes">是</option>
      </select>
    </label>
  );
}

function validateFields(fields: MetricField[]) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.deleted || field.final_value === "" || field.final_value === null || typeof field.final_value === "boolean") continue;
    const text = String(field.final_value).trim();
    if (field.group === "自定义" && !field.label.trim()) {
      errors[field.metric_key] = "请填写指标名称。";
      continue;
    }
    if (textMetricKeys.has(field.metric_key) || field.group === "自定义") continue;
    if (!/-?\d+(\.\d+)?/.test(text)) errors[field.metric_key] = "请输入数字，支持 1.2万、3分钟、45秒。";
  }
  return errors;
}

function boolToSelect(value: boolean | null | undefined) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function selectToBool(value: string) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}
