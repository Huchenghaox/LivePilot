"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, UploadCloud, Wand2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, StatusMessage } from "@/components/ui";

type Dashboard = {
  streamer_count: number;
  session_count: number;
  rule_reminder: string;
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
  tasks: { id: number; action: string; status: string; improvement: string }[];
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

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="首页" desc="先看下一步该做什么，再看最近一场哪里要改。" />
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          截图复盘 Beta
        </div>
      </div>
      {loading ? <StatusMessage type="loading" text="正在读取首页..." /> : null}
      {error ? <StatusMessage type="error" text={error} onRetry={load} /> : null}
      {!loading && !error && streamers.length ? (
        <div className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            <span className="mb-2 block">当前主播</span>
            <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={streamerId} onChange={(event) => {
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
              <span className="mb-2 block">当前抖音账号</span>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={platformAccountId} onChange={(event) => setPlatformAccountId(event.target.value)}>
                {visibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}{account.is_primary ? " · 主要账号" : ""}</option>)}
              </select>
            </label>
          ) : visibleAccounts.length === 1 ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              当前抖音账号：{visibleAccounts[0].display_name}{visibleAccounts[0].account_handle ? `（${visibleAccounts[0].account_handle}）` : ""}
            </div>
          ) : (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">当前主播还没有绑定抖音账号，复盘仍可继续。</div>
          )}
        </div>
      ) : null}
      {!loading && !error && data?.rule_reminder ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {data.rule_reminder}
          <Link className="ml-2 font-semibold underline underline-offset-2" href="/rules">查看规则与提示</Link>
        </div>
      ) : null}
      {!loading && !error && data?.streamer_count === 0 ? (
        <Card>
          <div className="text-sm text-slate-500">第一次使用</div>
          <h2 className="mt-2 text-2xl font-bold">先创建一个主播档案</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">只需要填写主播名称和主要方向，后面复盘会自动带入主播类型。</p>
          <Link className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" href="/streamers">创建主播档案</Link>
        </Card>
      ) : null}
      {!loading && !error && data && data.streamer_count > 0 && data.session_count === 0 ? (
        <Card>
          <div className="text-sm text-slate-500">下一步</div>
          <h2 className="mt-2 text-2xl font-bold">上传第一场直播数据</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">当前没有图片识别模型也可以测试：上传抖音后台截图后，手动填写关键数据即可生成复盘。</p>
          <Link className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" href="/review">上传第一场直播数据</Link>
        </Card>
      ) : null}
      {!loading && !error && data && data.streamer_count > 0 && data.session_count > 0 ? (
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-coral/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-brand">下一步</div>
              <h2 className="mt-2 text-2xl font-bold text-ink">复盘新一场直播，更新下一场动作</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">当前 Beta 聚焦截图复盘。先把新一场数据确认好，AI 会结合历史任务和规则给出下一场方案。</p>
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
          {!loading && !error && !data?.latest_session ? <StatusMessage type="empty" text="还没有直播记录。先上传一场复盘，AI 会告诉你下一场怎么改。" /> : null}
          {data?.latest_session ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-500">{new Date(data.latest_session.created_at).toLocaleString("zh-CN")}</div>
              <div className="rounded-2xl border border-brand/20 bg-white/[0.045] p-4">
                <div className="text-xs font-semibold text-brand">一句话结论</div>
                <div className="mt-2 text-xl font-bold leading-8">{data.latest_session.summary}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-coral/20 bg-coral/10 p-4 text-sm">
                  <div className="text-xs font-semibold text-red-700">最大问题</div>
                  <div className="mt-2 font-bold text-ink">{data.latest_session.main_problem}</div>
                </div>
                <div className="rounded-2xl border border-brand/20 bg-brand/10 p-4 text-sm">
                  <div className="text-xs font-semibold text-brand">最大优势</div>
                  <div className="mt-2 font-bold text-ink">{data.latest_session.strength}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm">
                <div className="text-xs font-semibold text-slate-400">下一场首要任务</div>
                <div className="mt-2 font-bold text-ink">{data.latest_session.first_action}</div>
              </div>
              {data.metric_changes?.length ? (
                <div className="rounded-md border border-slate-200 p-4">
                  <div className="mb-2 text-sm font-bold">最近指标变化</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {data.metric_changes.map((item) => (
                      <div key={item.metric_key} className="rounded-2xl bg-white/[0.045] p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 font-medium">
                          <span>{item.label}</span>
                          <span className={item.trend === "上升" ? "text-brand" : item.trend === "下降" ? "text-red-700" : "text-slate-400"}>
                            {item.trend}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">本场 {formatMetricValue(item.current)} · 上场 {formatMetricValue(item.previous)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-500">最近指标变化：至少完成两场同范围复盘后显示。</div>
              )}
              <Link className="brand-gradient inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016]" href={`/report/${data.latest_session.id}`}>
                查看报告
                <ArrowUpRight size={16} />
              </Link>
            </div>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">本周成长任务</h2>
          {data.task_execution_summary?.summary ? (
            <div className="mb-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{data.task_execution_summary.summary}</div>
          ) : null}
          {!data?.tasks?.length ? <StatusMessage type="empty" text="生成第一份复盘后，这里会出现最多三个本周任务。" /> : null}
          <div className="space-y-3">
            {data?.tasks.map((task, index) => (
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

function formatMetricValue(value: number) {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(Math.round(value));
}
