"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type Issue = { title: string; evidence: string; reason: string; fix: string; script: string; target: string };
type NextPlan = {
  recommended_theme: string;
  titles: string[];
  opening_3_minutes: string;
  interaction_nodes: string[];
  follow_prompts: string[];
  new_traffic_script: string;
  goals: string[];
};
type Report = {
  report_id?: number;
  report_type?: "simple" | "professional" | "both";
  version_number?: number;
  source: string;
  summary: string;
  main_problem: string;
  strength: string;
  next_actions: string[];
  issues: Issue[];
  details: Record<string, string>;
  diagnostics?: { rule_name: string; matched_data: string; judgment: string; confidence: string }[];
  history_comparison?: {
    has_history: boolean;
    limitation?: string;
    improved_metrics?: string[];
    declined_metrics?: string[];
    stable_metrics?: string[];
  };
  analysis_limits?: string[];
  rule_snapshot?: { id: number; title: string; rule_type: string; source_name: string; reason_used: string; summary: string }[];
  rule_notes?: { type: string; title: string; usage: string }[];
  prompt_version?: string;
  model_name?: string;
  next_plan?: NextPlan;
  is_current_version?: boolean;
  version_created_at?: string;
};
type GrowthTask = { id: number; action: string; status: string; remark: string; improvement: string };
type ReportVersion = { id: number; version_number: number; report_type: string; model_name: string; source: string; is_current: boolean; created_at: string };

const emptyNextPlan: NextPlan = {
  recommended_theme: "请重新生成报告以获得下一场方案",
  titles: [],
  opening_3_minutes: "旧版报告暂未保存开场话术。",
  interaction_nodes: [],
  follow_prompts: [],
  new_traffic_script: "旧版报告暂未保存新流量承接话术。",
  goals: []
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [tasks, setTasks] = useState<GrowthTask[]>([]);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [reportType, setReportType] = useState<"simple" | "professional" | "both">("simple");
  const [feedbackType, setFeedbackType] = useState("报告有帮助");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [message, setMessage] = useState("");
  const [viewingOldVersion, setViewingOldVersion] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [reportResult, taskResult] = await Promise.all([
        apiFetch<Report>(`/api/live-sessions/${params.id}/report`),
        apiFetch<{ items: GrowthTask[] }>(`/api/growth-tasks?live_session_id=${params.id}`)
      ]);
      setReport(reportResult);
      setViewingOldVersion(false);
      setReportType(reportResult.report_type ?? "simple");
      setTasks(taskResult.items.reverse());
      const versionResult = await apiFetch<{ items: ReportVersion[] }>(`/api/live-sessions/${params.id}/report-versions`);
      setVersions(versionResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function updateTask(task: GrowthTask, patch: Partial<GrowthTask>) {
    const updated = { ...task, ...patch };
    setTasks((items) => items.map((item) => item.id === task.id ? updated : item));
    await apiFetch(`/api/growth-tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: updated.status, remark: updated.remark })
    });
    setMessage("执行状态已保存。");
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制。");
  }

  async function submitFeedback() {
    await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ live_session_id: Number(params.id), feedback_type: feedbackType, content: feedbackContent })
    });
    setFeedbackContent("");
    setMessage("反馈已提交。");
  }

  async function regenerate() {
    setWorking(true);
    setError("");
    try {
      const metrics = await apiFetch<Record<string, unknown>>(`/api/live-sessions/${params.id}/metrics`);
      await apiFetch(`/api/live-sessions/${params.id}/report`, {
        method: "POST",
        body: JSON.stringify({ report_type: reportType, metrics })
      });
      setMessage("报告已重新生成。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新生成失败");
    } finally {
      setWorking(false);
    }
  }

  async function openVersion(version: ReportVersion) {
    setWorking(true);
    setError("");
    try {
      const result = await apiFetch<Report>(`/api/live-sessions/${params.id}/report-versions/${version.id}`);
      setReport(result);
      setReportType(result.report_type ?? "simple");
      setViewingOldVersion(!result.is_current_version);
      setMessage(`已打开报告版本 v${result.version_number ?? version.version_number}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开历史版本失败");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="直播报告" desc="先看最大问题和下一场动作，数据详情默认放在后面。" />
      {loading ? <StatusMessage type="loading" text="正在打开复盘报告..." /> : null}
      {error ? <StatusMessage type="error" text={error} onRetry={load} /> : null}
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      {report ? (
        <div className="space-y-5">
          {report.source === "mock" ? <StatusMessage type="success" text="当前报告由 Mock AI 适配层生成，用于 Beta 流程验证。接入模型 Key 后可替换为真实分析。" /> : null}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-brand/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-coral/10 blur-3xl" />
            <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-brand">一句话总结</div>
              <div className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs text-slate-400">当前版本：v{report.version_number ?? 1}</div>
            </div>
            {viewingOldVersion ? (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-800">
                正在查看历史版本。执行状态和重新生成仍以当前最新报告为准。
                <button className="ml-2 font-semibold underline" onClick={load}>返回当前版本</button>
              </div>
            ) : null}
            <h2 className="mt-4 text-2xl font-bold leading-9 md:text-3xl">{report.summary}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-coral/25 bg-coral/10 p-4">
                <div className="inline-flex rounded-full bg-coral/15 px-2 py-1 text-xs font-semibold text-red-700">本场最大问题</div>
                <div className="mt-3 font-bold text-ink">{report.main_problem}</div>
              </div>
              <div className="rounded-2xl border border-brand/25 bg-brand/10 p-4">
                <div className="inline-flex rounded-full bg-brand/15 px-2 py-1 text-xs font-semibold text-brand">本场最大优势</div>
                <div className="mt-3 font-bold text-ink">{report.strength}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-3 font-bold">下一场最重要的三个动作</div>
              <div className="grid gap-3 md:grid-cols-3">
                {report.next_actions.map((item, index) => (
                  <ActionCard
                    key={`${item}-${index}`}
                    action={item}
                    index={index}
                    report={report}
                    task={tasks[index]}
                    onTaskChange={updateTask}
                    onCopy={copyText}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <SecondaryButton onClick={() => copyText(report.next_actions.join("\n"))}>复制下一场任务</SecondaryButton>
              <SecondaryButton onClick={() => window.print()}>打印 / 保存PDF</SecondaryButton>
              <Link className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm font-semibold text-slate-100" href={`/review/${params.id}/confirm`}>返回修改数据</Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select className="rounded-[var(--radius-control)] border border-slate-300 px-3 py-2.5 text-sm" value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)}>
                <option value="simple">直接告诉我怎么改</option>
                <option value="professional">给我专业分析</option>
                <option value="both">两种都要</option>
              </select>
              <PrimaryButton disabled={working} onClick={regenerate}>{working ? "正在重新生成..." : "重新生成"}</PrimaryButton>
              <Link className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm font-semibold text-slate-100" href="/model-settings">更换模型</Link>
            </div>
            </div>
          </Card>
          <div className="grid gap-4">
            {report.issues.map((issue, index) => (
              <Card key={issue.title}>
                <div className="mb-3 text-sm font-semibold text-brand">核心问题 {index + 1}</div>
                <h3 className="text-xl font-bold">{issue.title}</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="判断依据" value={issue.evidence || report.history_comparison?.limitation || "当前缺少历史场次，本次主要根据单场数据分析。"} />
                  <Info label="可能原因" value={issue.reason} />
                  <Info label="下一场怎么改" value={issue.fix} />
                  <Info label="验证指标" value={issue.target} />
                </div>
                <div className="mt-4 rounded-md bg-slate-50 p-4">
                  <div className="mb-2 text-sm font-bold">推荐话术</div>
                  <p className="text-sm leading-6">{issue.script}</p>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <details>
              <summary className="cursor-pointer font-bold">查看专业分析和依据</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Object.entries(report.details).map(([key, value]) => <Info key={key} label={key} value={value} />)}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="历史对比" value={historyText(report)} />
                <Info label="结论限制" value={(report.analysis_limits ?? ["当前仅根据后台数据进行分析，具体内容原因需要结合主播当场情况判断。"]).join(" ")} />
              </div>
              {report.diagnostics?.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {report.diagnostics.map((item) => <Info key={item.rule_name} label={item.rule_name} value={`${item.matched_data}。${item.judgment}`} />)}
                </div>
              ) : null}
              <div className="mt-4">
                <div className="mb-2 text-sm font-bold">规则依据</div>
                {report.rule_snapshot?.length ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {report.rule_snapshot.map((rule) => (
                      <Info key={`${rule.id}-${rule.title}`} label={`${rule.rule_type}：${rule.title}`} value={`${rule.summary}。使用原因：${rule.reason_used || "与本场分析相关"}。来源：${rule.source_name || rule.rule_type}`} />
                    ))}
                  </div>
                ) : (
                  <Info label="规则依据" value="本次没有匹配到已生效的相关规则，报告主要依据已确认数据、主播补充说明和系统诊断。" />
                )}
              </div>
              <div className="mt-4 text-xs text-slate-400">模型：{report.model_name || "未记录"} · Prompt：{report.prompt_version || "未记录"}</div>
            </details>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">下一场方案</h2>
            <div className="grid gap-4">
              <Info label="推荐主题" value={(report.next_plan ?? emptyNextPlan).recommended_theme} />
              <div className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 text-xs text-slate-500">5条标题</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {(report.next_plan ?? emptyNextPlan).titles.map((title) => <div key={title} className="rounded-md bg-slate-50 p-3 text-sm">{title}</div>)}
                </div>
              </div>
              <Info label="开场3分钟" value={(report.next_plan ?? emptyNextPlan).opening_3_minutes} />
              <PlanList title="3个互动节点" items={(report.next_plan ?? emptyNextPlan).interaction_nodes} />
              <PlanList title="2个关注引导" items={(report.next_plan ?? emptyNextPlan).follow_prompts} />
              <Info label="新流量承接话术" value={(report.next_plan ?? emptyNextPlan).new_traffic_script} />
              <PlanList title="下一场三个目标" items={(report.next_plan ?? emptyNextPlan).goals} />
              <div className="flex flex-wrap gap-2">
                <Link href="/prepare" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">开始准备下一场</Link>
                <SecondaryButton onClick={() => copyText((report.next_plan ?? emptyNextPlan).opening_3_minutes)}>复制开场话术</SecondaryButton>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">提交反馈</h2>
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}>
                {["报告有帮助", "数据判断不准确", "建议太空泛", "建议不适合我的直播", "规则依据有问题", "操作遇到问题", "其他"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="补充说明，可不填" value={feedbackContent} onChange={(event) => setFeedbackContent(event.target.value)} />
              <PrimaryButton onClick={submitFeedback}>提交反馈</PrimaryButton>
            </div>
          </Card>
          <Card>
            <details>
              <summary className="cursor-pointer font-bold">查看历史版本</summary>
              {!versions.length ? <StatusMessage type="empty" text="暂无历史版本。" /> : null}
              <div className="mt-4 space-y-2">
                {versions.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="font-semibold">v{item.version_number}{item.is_current ? " · 当前版本" : ""}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.report_type} · {item.model_name || item.source} · {new Date(item.created_at).toLocaleString("zh-CN")}</div>
                    <button className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold" onClick={() => openVersion(item)}>查看这个版本</button>
                  </div>
                ))}
              </div>
            </details>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function ActionCard({
  action,
  index,
  report,
  task,
  onTaskChange,
  onCopy
}: {
  action: string;
  index: number;
  report: Report;
  task?: GrowthTask;
  onTaskChange: (task: GrowthTask, patch: Partial<GrowthTask>) => void;
  onCopy: (text: string) => void;
}) {
  const issue = report.issues[index];
  const statusClass = task?.status === "已执行"
    ? "border-success/30 bg-success/10 text-success"
    : task?.status === "部分执行"
      ? "border-warning/30 bg-warning/10 text-amber-800"
      : task?.status === "不适用"
        ? "border-white/10 bg-white/[0.04] text-slate-500"
        : task?.status === "未执行"
          ? "border-white/10 bg-white/[0.04] text-slate-400"
          : "border-white/10 bg-transparent text-slate-400";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-[#061016]">{index + 1}</div>
        <div className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass}`}>{task?.status || "未填写"}</div>
      </div>
      <div className="font-bold leading-6 text-ink">{action}</div>
      <div className="mt-4 grid gap-3 text-xs text-slate-500">
        <div><span className="text-slate-400">执行时间：</span>{extractTime(action, index)}</div>
        <div><span className="text-slate-400">可以直接说：</span>{issue?.script || report.next_plan?.opening_3_minutes || "按本场主题先讲清楚今天适合谁、能解决什么。"}</div>
        <div><span className="text-slate-400">观察指标：</span>{issue?.target || report.next_plan?.goals?.[index] || "观察平均停留、评论和新增关注。"}</div>
      </div>
      <button className="mt-4 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-slate-100" onClick={() => onCopy(issue?.script || action)}>复制话术</button>
      {task ? (
        <div className="mt-3 grid gap-2">
          <select className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" value={task.status} onChange={(event) => onTaskChange(task, { status: event.target.value })}>
            {["未完成", "已执行", "部分执行", "未执行", "不适用"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" placeholder="执行备注" value={task.remark || ""} onChange={(event) => onTaskChange(task, { remark: event.target.value })} />
        </div>
      ) : null}
    </div>
  );
}

function extractTime(action: string, index: number) {
  const match = action.match(/开播前?\d+分钟|第\s?\d+\s?分钟|每\s?\d+\s?分钟|开场\s?\d+\s?分钟/);
  if (match) return match[0];
  return ["开场前 3 分钟", "直播中段", "下播前 10 分钟"][index] ?? "下一场直播中";
}

function historyText(report: Report) {
  const comparison = report.history_comparison;
  if (!comparison?.has_history) return comparison?.limitation || "当前缺少历史场次，本次主要根据单场数据分析。";
  return [
    comparison.improved_metrics?.length ? `提升：${comparison.improved_metrics.join("、")}` : "",
    comparison.declined_metrics?.length ? `下降：${comparison.declined_metrics.join("、")}` : "",
    comparison.stable_metrics?.length ? `稳定：${comparison.stable_metrics.join("、")}` : ""
  ].filter(Boolean).join("；") || "有历史场次，但可直接比较的数据较少。";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 text-xs text-slate-500">{title}</div>
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6">{item}</div>)}
      </div>
    </div>
  );
}
