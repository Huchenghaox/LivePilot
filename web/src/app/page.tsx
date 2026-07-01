"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, UploadCloud, Wand2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, StatusMessage } from "@/components/ui";

type Dashboard = {
  streamer_count: number;
  platform_account_count: number;
  prepare_plan_count: number;
  session_count: number;
  report_count: number;
  rule_reminder: string;
  model_status?: {
    text_model_configured: boolean;
    image_model_configured: boolean;
    text_model_name?: string;
    image_model_name?: string;
    image_model_message?: string;
  };
  latest_session: null | {
    id: number;
    title: string;
    created_at: string;
    status: string;
    summary: string;
    main_problem: string;
    strength: string;
    first_action: string;
  };
  recent_session?: null | { id: number; title: string; created_at: string; status: string };
  recent_report?: null | { id: number; summary: string; created_at: string };
  recent_plan?: null | { id: number; topic: string; created_at: string };
  tasks?: { id: number; action: string; status: string; improvement: string }[];
  task_execution_summary?: {
    total: number;
    summary: string;
    counts: Record<string, number>;
  };
  metric_changes?: {
    metric_key: string;
    label: string;
    current: number;
    previous: number;
    diff: number;
    trend: "上升" | "下降" | "稳定";
  }[];
};
type Streamer = { id: number; name: string; direction: string; is_default?: boolean };
type PlatformAccount = { id: number; display_name: string; account_handle: string; is_primary: boolean; anchor: null | { id: number; name: string } };

export default function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [streamerId, setStreamerId] = useState("");
  const [platformAccountId, setPlatformAccountId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (streamerId) query.set("streamer_id", streamerId);
      if (platformAccountId) query.set("platform_account_id", platformAccountId);
      const [dashboardResult, streamerResult, accountResult] = await Promise.all([
        apiFetch<Dashboard>(`/api/dashboard${query.toString() ? `?${query.toString()}` : ""}`),
        apiFetch<Streamer[]>("/api/streamers"),
        apiFetch<{ items: PlatformAccount[] }>("/api/platform-accounts")
      ]);
      setData(dashboardResult);
      setStreamers(streamerResult);
      setAccounts(accountResult.items);
      const savedStreamerId = window.localStorage.getItem("current_streamer_id") || "";
      const defaultStreamer = streamerResult.find((item) => item.is_default);
      const nextStreamerId = streamerId || savedStreamerId || (defaultStreamer ? String(defaultStreamer.id) : "") || (streamerResult[0] ? String(streamerResult[0].id) : "");
      if (!streamerId && nextStreamerId) setStreamerId(nextStreamerId);
      if (!platformAccountId && accountResult.items.length) {
        const matching = accountResult.items.filter((account) => !nextStreamerId || account.anchor?.id === Number(nextStreamerId));
        const preferredAccount = matching.find((account) => account.is_primary) ?? matching[0];
        if (preferredAccount) setPlatformAccountId(String(preferredAccount.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [streamerId, platformAccountId]);

  const visibleAccounts = accounts.filter((account) => !streamerId || account.anchor?.id === Number(streamerId));
  const tasks = data?.tasks ?? [];
  const latestSession = data?.latest_session ?? (data?.recent_session || data?.recent_report ? {
    id: data.recent_session?.id ?? data.recent_report?.id ?? 0,
    title: data.recent_session?.title || "最近一场直播",
    created_at: data.recent_report?.created_at || data.recent_session?.created_at || "",
    status: data.recent_session?.status || "reported",
    summary: data.recent_report?.summary || "报告已生成，请查看详情。",
    main_problem: "请进入报告查看本场最大问题和数据证据。",
    strength: "已经完成一场可复盘的数据记录。",
    first_action: data.recent_plan?.topic ? `按“${data.recent_plan.topic}”准备下一场直播。` : "根据报告创建下一场开播方案。"
  } : null);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="AI直播增长系统" desc="把每一场直播变成一次可验证的增长实验：准备、复盘、诊断、下一场执行。" />
        <div className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          LivePilot MVP
        </div>
      </div>
      {loading ? <StatusMessage type="loading" text="正在读取首页..." /> : null}
      {error ? <StatusMessage type="error" text={error} onRetry={load} /> : null}
      {!loading && !error && streamers.length ? (
        <div className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            <span className="mb-2 block text-slate-300">当前主播</span>
            <select className="input-dark w-full" value={streamerId} onChange={(event) => {
              setStreamerId(event.target.value);
              window.localStorage.setItem("current_streamer_id", event.target.value);
              const nextAccounts = accounts.filter((account) => account.anchor?.id === Number(event.target.value));
              const primary = nextAccounts.find((account) => account.is_primary) ?? nextAccounts[0];
              setPlatformAccountId(primary ? String(primary.id) : "");
            }}>
              {streamers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction}</option>)}
            </select>
          </label>
          {visibleAccounts.length > 1 ? (
            <label className="text-sm font-medium">
              <span className="mb-2 block text-slate-300">当前抖音账号</span>
              <select className="input-dark w-full" value={platformAccountId} onChange={(event) => setPlatformAccountId(event.target.value)}>
                {visibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}{account.is_primary ? " · 主要账号" : ""}</option>)}
              </select>
            </label>
          ) : visibleAccounts.length === 1 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
              当前抖音账号：{visibleAccounts[0].display_name}{visibleAccounts[0].account_handle ? `（${visibleAccounts[0].account_handle}）` : ""}
            </div>
          ) : (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">当前主播还没有绑定抖音账号，复盘仍可继续。</div>
          )}
        </div>
      ) : null}
      {!loading && !error && data?.rule_reminder ? (
        <div className="mb-5 rounded-[var(--radius-card)] border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {data.rule_reminder}
          <Link className="ml-2 font-semibold underline underline-offset-2" href="/rules">查看规则与提示</Link>
        </div>
      ) : null}
      {!loading && !error && data ? (
        <Card className="mb-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-brand">首次使用引导</div>
              <h2 className="mt-1 text-xl font-bold text-slate-50">按这 5 步把 LivePilot 用起来</h2>
            </div>
            <Link className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-sm font-semibold text-slate-100" href="/me">查看使用帮助</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <OnboardingStep done={data.streamer_count > 0} title="创建主播" text="让 AI 知道你的直播定位" href="/streamers" />
            <OnboardingStep done={data.platform_account_count > 0} title="记录账号" text="可选，不影响手动复盘" href="/platform-accounts" />
            <OnboardingStep done={Boolean(data.model_status?.text_model_configured)} title="配置文字AI" text="用于生成真实报告" href="/model-settings" />
            <OnboardingStep done={data.prepare_plan_count > 0} title="开播准备" text="先生成下一场方案" href="/prepare" />
            <OnboardingStep done={data.session_count > 0} title="完成复盘" text="录入数据生成报告" href="/review" />
          </div>
          {!data.model_status?.image_model_configured ? (
            <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              {data.model_status?.image_model_message || "当前图片识别模型未配置，不会影响手动录入复盘。上传截图后如无法识别，可继续确认和填写关键数据。"}
            </div>
          ) : null}
        </Card>
      ) : null}
      {!loading && !error && data?.streamer_count === 0 ? (
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            <div className="text-sm font-semibold text-brand">第一次使用</div>
            <h2 className="mt-2 text-2xl font-bold text-slate-50">先创建一个主播档案</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">只需要填写主播名称和主要方向，后面复盘会自动带入主播定位和历史表现。</p>
            <Link className="brand-gradient mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016]" href="/streamers">创建主播档案</Link>
          </div>
        </Card>
      ) : null}
      {!loading && !error && data && data.streamer_count > 0 && data.session_count === 0 ? (
        <Card>
          <div className="text-sm font-semibold text-brand">下一步</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-50">完成第一场直播复盘</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">截图识别未配置时也可以继续：上传截图留档，再手动填写关键数据生成增长诊断。</p>
          <Link className="brand-gradient mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016]" href="/review">开始第一场复盘</Link>
        </Card>
      ) : null}
      {!loading && !error && data && data.streamer_count > 0 && data.session_count > 0 ? (
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <GrowthMetric label="主播档案" value={data.streamer_count} />
          <GrowthMetric label="平台账号" value={data.platform_account_count} />
          <GrowthMetric label="开播方案" value={data.prepare_plan_count} />
          <GrowthMetric label="复盘报告" value={data.report_count ?? 0} />
        </div>
      ) : null}
      {!loading && !error && data && data.streamer_count > 0 && data.session_count > 0 ? (
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-coral/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-brand">下一步</div>
              <h2 className="mt-2 text-2xl font-bold text-slate-50">复盘新一场直播，更新下一场动作</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">先把新一场数据确认好，AI 会结合历史任务和规则，给出问题诊断、优先动作和下一场验证目标。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/review" className="brand-gradient inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016] shadow-glow">
                <UploadCloud size={18} />
                开始新复盘
              </Link>
              <Link href="/prepare" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-brand/60">
                <Wand2 size={18} />
                开播准备
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {data && data.streamer_count > 0 && data.session_count > 0 ? <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-bold">最近一场直播</h2>
          {!loading && !error && !latestSession ? <StatusMessage type="empty" text="还没有直播记录。先上传一场复盘，AI 会告诉你下一场怎么改。" /> : null}
          {latestSession ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">{latestSession.created_at ? new Date(latestSession.created_at).toLocaleString("zh-CN") : "最近记录"}</div>
              <div className="rounded-2xl border border-brand/20 bg-white/[0.045] p-4">
                <div className="text-xs font-semibold text-brand">一句话结论</div>
                <div className="mt-2 text-xl font-bold leading-8">{latestSession.summary}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-coral/20 bg-coral/10 p-4 text-sm">
                <div className="text-xs font-semibold text-coral">最大问题</div>
                  <div className="mt-2 font-bold text-slate-50">{latestSession.main_problem}</div>
                </div>
                <div className="rounded-2xl border border-brand/20 bg-brand/10 p-4 text-sm">
                  <div className="text-xs font-semibold text-brand">最大优势</div>
                  <div className="mt-2 font-bold text-slate-50">{latestSession.strength}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm">
                <div className="text-xs font-semibold text-slate-400">下一场首要任务</div>
                <div className="mt-2 font-bold text-slate-50">{latestSession.first_action}</div>
              </div>
              {data.metric_changes?.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-2 text-sm font-bold">最近指标变化</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {data.metric_changes.map((item) => (
                      <div key={item.metric_key} className="rounded-2xl bg-white/[0.045] p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 font-medium">
                          <span>{item.label}</span>
                  <span className={item.trend === "上升" ? "text-brand" : item.trend === "下降" ? "text-coral" : "text-slate-400"}>
                            {item.trend}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">本场 {formatMetricValue(item.current)} · 上场 {formatMetricValue(item.previous)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">最近指标变化：至少完成两场同范围复盘后显示。</div>
              )}
              <Link className="brand-gradient inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016]" href={`/report/${latestSession.id}`}>
                查看报告
                <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">本周成长任务</h2>
          {data.task_execution_summary?.summary ? (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{data.task_execution_summary.summary}</div>
          ) : null}
          {!tasks.length ? <StatusMessage type="empty" text="生成第一份复盘后，这里会出现最多三个本周任务。" /> : null}
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div key={task.id} className="grid grid-cols-[34px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <div className="brand-gradient flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-[#061016]">{index + 1}</div>
                <div>
                <div className="font-medium leading-6">{task.action}</div>
                <div className="mt-2 text-xs text-slate-500">{task.status} · {task.improvement}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div> : null}
    </>
  );
}

function OnboardingStep({ done, title, text, href }: { done: boolean; title: string; text: string; href: string }) {
  return (
    <Link className={`rounded-2xl border p-3 transition ${done ? "border-success/30 bg-success/10" : "border-white/10 bg-white/[0.045] hover:border-brand/40"}`} href={href}>
      <div className={`mb-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${done ? "bg-success/15 text-success" : "bg-brand/10 text-brand"}`}>
        {done ? "已完成" : "去完成"}
      </div>
      <div className="font-bold text-slate-50">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{text}</div>
    </Link>
  );
}

function GrowthMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-50">{value}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="brand-gradient h-full rounded-full" style={{ width: `${Math.min(100, Math.max(12, value ? 64 : 12))}%` }} />
      </div>
    </Card>
  );
}

function formatMetricValue(value: number) {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(Math.round(value));
}
