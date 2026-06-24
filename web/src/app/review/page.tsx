"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, uploadWithProgress } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, StatusMessage } from "@/components/ui";

type Streamer = { id: number; name: string; direction: string; is_default?: boolean };
type LiveSession = {
  id: number;
  streamer_id: number;
  title: string;
  status: string;
  created_at: string;
  live_date?: string;
  duration_minutes?: number | null;
  peak_online?: number | null;
  average_online?: number | null;
  new_followers?: number | null;
  main_problem?: string;
  platform_account?: { id: number; display_name: string; account_handle: string } | null;
};
type PreviousTask = { id: number; action: string; status: string; remark: string; improvement: string };
type PreviousTaskResult = { session: null | { id: number; title: string; created_at: string }; items: PreviousTask[] };
type PlatformAccount = {
  id: number;
  display_name: string;
  account_handle: string;
  is_primary: boolean;
  connection_status: string;
};
type PreparePlan = {
  id: number;
  topic: string;
  goal: string;
  duration_minutes: number;
  platform_account_id?: number | null;
  is_used: boolean;
  created_at: string;
};
type SelectedScreenshot = {
  id: string;
  file: File;
  previewUrl: string;
  error: string;
};

const reviewSteps = ["基础信息", "数据录入", "确认数据", "规则与方式", "AI报告"];

const statusText: Record<string, string> = {
  draft: "草稿",
  metrics_recognized: "待确认数据",
  metrics_confirmed: "待生成报告",
  reported: "已生成报告",
  archived: "已归档"
};

export default function ReviewPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [streamerId, setStreamerId] = useState("");
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [platformAccountId, setPlatformAccountId] = useState("");
  const [preparePlans, setPreparePlans] = useState<PreparePlan[]>([]);
  const [preparationPlanId, setPreparationPlanId] = useState("");
  const [filterStreamerId, setFilterStreamerId] = useState("");
  const [filterPlatformAccountId, setFilterPlatformAccountId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [historyAccounts, setHistoryAccounts] = useState<PlatformAccount[]>([]);
  const [title, setTitle] = useState("我的直播复盘");
  const [liveDate, setLiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionTopic, setSessionTopic] = useState("");
  const [mainGoal, setMainGoal] = useState("留得更久");
  const [hasPaidPromotion, setHasPaidPromotion] = useState("unknown");
  const [hasCohost, setHasCohost] = useState("unknown");
  const [selfReview, setSelfReview] = useState("");
  const [screenshots, setScreenshots] = useState<SelectedScreenshot[]>([]);
  const screenshotsRef = useRef<SelectedScreenshot[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previousTaskResult, setPreviousTaskResult] = useState<PreviousTaskResult | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [createdWithScreenshots, setCreatedWithScreenshots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function historyPath() {
    const params = new URLSearchParams();
    if (filterStreamerId) params.set("streamer_id", filterStreamerId);
    if (filterPlatformAccountId) params.set("platform_account_id", filterPlatformAccountId);
    if (filterStatus) params.set("status", filterStatus);
    if (filterDateFrom) params.set("date_from", filterDateFrom);
    if (filterDateTo) params.set("date_to", filterDateTo);
    const query = params.toString();
    return query ? `/api/live-sessions?${query}` : "/api/live-sessions";
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [streamerRows, sessionRows] = await Promise.all([
        apiFetch<Streamer[]>("/api/streamers"),
        apiFetch<LiveSession[]>(historyPath())
      ]);
      setStreamers(streamerRows);
      setSessions(sessionRows);
      const savedStreamerId = typeof window !== "undefined" ? window.localStorage.getItem("current_streamer_id") || "" : "";
      const defaultStreamer = streamerRows.find((item) => item.is_default);
      const preferredId = filterStreamerId || savedStreamerId || (defaultStreamer ? String(defaultStreamer.id) : "") || (streamerRows[0] ? String(streamerRows[0].id) : "");
      if (streamerRows.some((item) => String(item.id) === preferredId)) {
        setStreamerId(preferredId);
      } else if (streamerRows[0]) {
        setStreamerId(String(streamerRows[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function createSession(uploadScreenshots: boolean) {
    setWorking(true);
    setError("");
    setUploadProgress(0);
    try {
      if (uploadScreenshots && !screenshots.length) {
        throw new Error("请至少上传一张抖音后台截图");
      }
      const invalid = screenshots.find((item) => item.error);
      if (uploadScreenshots && invalid) {
        throw new Error(invalid.error);
      }
      const session = await apiFetch<{ id: number }>("/api/live-sessions", {
        method: "POST",
        body: JSON.stringify({
          streamer_id: Number(streamerId),
          platform_account_id: platformAccountId ? Number(platformAccountId) : null,
          preparation_plan_id: preparationPlanId ? Number(preparationPlanId) : null,
          platform: "douyin",
          data_source: uploadScreenshots ? "screenshot_ai" : "manual_input",
          title
        })
      });
      await apiFetch(`/api/live-sessions/${session.id}/metrics`, {
        method: "PUT",
        body: JSON.stringify({
          live_date: liveDate,
          session_topic: sessionTopic || title,
          main_goal: mainGoal,
          has_paid_promotion: selectToBool(hasPaidPromotion),
          has_cohost: selectToBool(hasCohost),
          self_review: selfReview,
          traffic_sources: uploadScreenshots ? "等待截图识别" : "手动录入"
        })
      });
      if (uploadScreenshots && screenshots.length) {
        const form = new FormData();
        screenshots.forEach((item) => form.append("files", item.file));
        await uploadWithProgress(`/api/live-sessions/${session.id}/screenshots`, form, setUploadProgress);
      }
      setCreatedId(session.id);
      setCreatedWithScreenshots(uploadScreenshots);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setWorking(false);
    }
  }

  function selectScreenshots(fileList: FileList | null) {
    if (!fileList?.length) return;
    const accepted = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const maxSize = 20 * 1024 * 1024;
    const next = Array.from(fileList).map((file) => {
      let itemError = "";
      if (!accepted.includes(file.type)) itemError = "请上传 PNG、JPG、WEBP 或 GIF 格式的截图";
      if (file.size > maxSize) itemError = "截图过大，请上传 20MB 以内的图片";
      if (file.size === 0) itemError = "图片为空，请重新选择";
      return {
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        error: itemError
      };
    });
    setScreenshots((current) => [...current, ...next]);
  }

  function removeScreenshot(id: string) {
    setScreenshots((current) => {
      const item = current.find((row) => row.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((row) => row.id !== id);
    });
  }

  function moveScreenshot(id: string, direction: -1 | 1) {
    setScreenshots((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  async function archiveSession(item: LiveSession) {
    if (!window.confirm(item.status === "reported" ? "确定归档这场复盘？" : "确定删除这条未完成复盘？")) return;
    await apiFetch(`/api/live-sessions/${item.id}`, { method: "DELETE" });
    await load();
  }

  async function loadPreviousTasks(id: string) {
    if (!id) return;
    try {
      setPreviousTaskResult(await apiFetch<PreviousTaskResult>(`/api/streamers/${id}/latest-growth-tasks`));
    } catch {
      setPreviousTaskResult(null);
    }
  }

  async function loadPlatformAccounts(id: string) {
    if (!id) {
      setPlatformAccounts([]);
      setPlatformAccountId("");
      return;
    }
    try {
      const result = await apiFetch<{ items: PlatformAccount[] }>(`/api/streamers/${id}/platform-accounts`);
      setPlatformAccounts(result.items);
      const primary = result.items.find((item) => item.is_primary) ?? result.items[0];
      setPlatformAccountId(primary ? String(primary.id) : "");
    } catch {
      setPlatformAccounts([]);
      setPlatformAccountId("");
    }
  }

  async function loadHistoryAccounts(id: string) {
    setHistoryAccounts([]);
    setFilterPlatformAccountId("");
    if (!id) return;
    try {
      const result = await apiFetch<{ items: PlatformAccount[] }>(`/api/streamers/${id}/platform-accounts`);
      setHistoryAccounts(result.items);
    } catch {
      setHistoryAccounts([]);
    }
  }

  async function loadPreparePlans(id: string, accountId = platformAccountId) {
    if (!id) {
      setPreparePlans([]);
      setPreparationPlanId("");
      return;
    }
    try {
      const query = new URLSearchParams({ streamer_id: id });
      if (accountId) query.set("platform_account_id", accountId);
      const result = await apiFetch<{ items: PreparePlan[] }>(`/api/prepare-plans?${query.toString()}`);
      setPreparePlans(result.items);
      setPreparationPlanId((current) => result.items.some((item) => String(item.id) === current) ? current : "");
    } catch {
      setPreparePlans([]);
      setPreparationPlanId("");
    }
  }

  async function updatePreviousTask(task: PreviousTask, patch: Partial<PreviousTask>) {
    const updated = { ...task, ...patch };
    setPreviousTaskResult((result) => result ? { ...result, items: result.items.map((item) => item.id === task.id ? updated : item) } : result);
    await apiFetch(`/api/growth-tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: updated.status, remark: updated.remark })
    });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const streamerFromUrl = params.get("streamer_id");
    if (streamerFromUrl) {
      setFilterStreamerId(streamerFromUrl);
      setStreamerId(streamerFromUrl);
      window.localStorage.setItem("current_streamer_id", streamerFromUrl);
      return;
    }
    void load();
  }, []);

  useEffect(() => {
    void load();
  }, [filterStreamerId]);

  useEffect(() => {
    void load();
  }, [filterPlatformAccountId, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    void loadHistoryAccounts(filterStreamerId);
  }, [filterStreamerId]);

  useEffect(() => {
    void loadPreviousTasks(streamerId);
    void loadPlatformAccounts(streamerId);
  }, [streamerId]);

  useEffect(() => {
    void loadPreparePlans(streamerId, platformAccountId);
  }, [streamerId, platformAccountId]);

  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  useEffect(() => () => {
    screenshotsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  return (
    <>
      <PageTitle title="直播复盘" desc="上传抖音后台截图，AI 先识别关键数据，再生成下一场行动。" />
      <div className="mb-5 rounded-2xl border border-white/10 bg-panel/70 p-4 shadow-card backdrop-blur">
        <div className="hidden items-center gap-3 md:flex">
          {reviewSteps.map((step, index) => (
            <div key={step} className="flex min-w-0 flex-1 items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "brand-gradient text-ink shadow-glow" : "border border-white/10 bg-white/5 text-slate-400"}`}>
                {index + 1}
              </div>
              <div className={index === 0 ? "truncate text-sm font-semibold text-slate-100" : "truncate text-sm text-slate-500"}>{step}</div>
              {index < reviewSteps.length - 1 ? <div className="h-px flex-1 bg-white/10" /> : null}
            </div>
          ))}
        </div>
        <div className="md:hidden">
          <div className="text-xs text-brand">第 1 步，共 5 步</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">基础信息与数据来源</div>
        </div>
      </div>
      {loading ? <StatusMessage type="loading" text="正在准备复盘流程..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {!loading && !streamers.length ? (
        <Card>
          <StatusMessage type="empty" text="还没有主播档案。先创建一个主播，再上传复盘。" />
          <Link className="brand-gradient mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-ink shadow-glow" href="/streamers">去创建主播</Link>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-brand/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-coral/10 blur-3xl" />
            <div className="relative">
            <div className="mb-5">
              <div className="text-xs font-semibold text-brand">新一场直播数据</div>
              <h2 className="mt-1 text-xl font-bold text-slate-50">新建复盘</h2>
              <p className="mt-2 text-sm text-slate-400">先保存基础信息，再上传截图或直接手动填写关键数据。</p>
            </div>
            <label className="mb-2 block text-sm font-medium">选择主播</label>
            <select className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" value={streamerId} onChange={(event) => {
              setStreamerId(event.target.value);
              window.localStorage.setItem("current_streamer_id", event.target.value);
            }}>
              {streamers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction}</option>)}
            </select>
            <label className="mb-2 block text-sm font-medium">直播名称</label>
            <input className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
            {platformAccounts.length > 1 ? (
              <>
                <label className="mb-2 block text-sm font-medium">选择抖音账号</label>
                <select className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" value={platformAccountId} onChange={(event) => setPlatformAccountId(event.target.value)}>
                  {platformAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.display_name}{account.is_primary ? " · 主要账号" : ""}{account.account_handle ? ` · ${account.account_handle}` : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : platformAccounts.length === 1 ? (
              <div className="mb-4 rounded-2xl border border-brand/20 bg-brand/5 p-3 text-sm text-slate-300">
                当前抖音账号：{platformAccounts[0].display_name}{platformAccounts[0].account_handle ? `（${platformAccounts[0].account_handle}）` : ""}
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                这个主播还没有绑定抖音账号。本次复盘仍可继续，之后可在“我的-平台账号”补充。
              </div>
            )}
            {preparePlans.length ? (
              <>
                <label className="mb-2 block text-sm font-medium">关联开播方案，可选</label>
                <select className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" value={preparationPlanId} onChange={(event) => setPreparationPlanId(event.target.value)}>
                  <option value="">不关联开播方案</option>
                  {preparePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.topic} · {plan.goal} · {plan.duration_minutes}分钟{plan.is_used ? " · 已使用" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">还没有可关联的开播方案，可先直接复盘。</div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                <span className="mb-2 block">直播日期</span>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={liveDate} onChange={(event) => setLiveDate(event.target.value)} />
              </label>
              <label className="text-sm font-medium">
                <span className="mb-2 block">本场目标</span>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={mainGoal} onChange={(event) => setMainGoal(event.target.value)}>
                  {["更多人进入", "留得更久", "更多互动", "更多关注", "更多成交", "降低违规风险"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <label className="mb-2 mt-4 block text-sm font-medium">直播主题</label>
            <input className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="例如 新手开播留人" value={sessionTopic} onChange={(event) => setSessionTopic(event.target.value)} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                <span className="mb-2 block">是否投流</span>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={hasPaidPromotion} onChange={(event) => setHasPaidPromotion(event.target.value)}>
                  <option value="unknown">不确定</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className="mb-2 block">是否连麦</span>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2" value={hasCohost} onChange={(event) => setHasCohost(event.target.value)}>
                  <option value="unknown">不确定</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>
            </div>
            <label className="mb-2 mt-4 block text-sm font-medium">主播补充说明</label>
            <textarea className="mb-4 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="例如 开场有点慢，中途网络卡了一次" value={selfReview} onChange={(event) => setSelfReview(event.target.value)} />
            {previousTaskResult?.session && previousTaskResult.items.length ? (
              <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-3">
                <div className="text-sm font-semibold text-warning">上一场有 {previousTaskResult.items.length} 项行动计划，请先简单确认执行情况。</div>
                <div className="mt-1 text-xs text-warning/80">{previousTaskResult.session.title} · 可以跳过，系统会保留未填写状态。</div>
                <div className="mt-3 space-y-2">
                  {previousTaskResult.items.map((task) => (
                    <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <div className="font-medium text-slate-100">{task.action}</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[160px_1fr]">
                        <select className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" value={task.status} onChange={(event) => updatePreviousTask(task, { status: event.target.value })}>
                          {["未完成", "已执行", "部分执行", "未执行", "不适用"].map((item) => <option key={item}>{item}</option>)}
                        </select>
                        <input className="rounded-md border border-slate-300 px-2 py-1.5 text-xs" placeholder="一句备注，可不填" value={task.remark || ""} onChange={(event) => updatePreviousTask(task, { remark: event.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <label className="block text-sm font-medium">抖音后台截图</label>
                <p className="mt-1 text-xs text-slate-500">支持多张截图，当前无图片模型时仍可继续手动填写。</p>
              </div>
              <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">图片模型未配置可继续</span>
            </div>
            <label className="mb-3 block cursor-pointer rounded-2xl border border-dashed border-brand/35 bg-brand/5 px-4 py-8 text-center transition hover:border-brand hover:bg-brand/10">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-xl text-brand">+</span>
              <span className="mt-3 block text-sm font-semibold text-slate-100">选择或拖入抖音后台截图</span>
              <span className="mt-1 block text-xs text-slate-500">PNG、JPG、WEBP、GIF，单张不超过 20MB。可直接跳过进入手动录入。</span>
              <input className="sr-only" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
                selectScreenshots(event.target.files);
                event.currentTarget.value = "";
              }} />
            </label>
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
              正式使用时不会把模拟识别伪装成真实数据；如果没有可用图片模型，下一步会让你确认或手动补充关键指标。
            </div>
            {screenshots.length ? (
              <div className="mb-4 space-y-3">
                {screenshots.map((item, index) => (
                  <div key={item.id} className={`flex gap-3 rounded-2xl border p-2 ${item.error ? "border-danger/30 bg-danger/10" : "border-white/10 bg-black/20"}`}>
                    <div
                      aria-label={item.file.name}
                      className="h-16 w-20 rounded-xl bg-cover bg-center ring-1 ring-white/10"
                      role="img"
                      style={{ backgroundImage: `url(${item.previewUrl})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{index + 1}. {item.file.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{(item.file.size / 1024 / 1024).toFixed(2)}MB</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${item.error ? "bg-danger/15 text-danger" : working ? "bg-brand/15 text-brand" : "bg-violet-500/15 text-violet-300"}`}>
                          {item.error ? "格式异常" : working ? "上传中" : "待上传"}
                        </span>
                      </div>
                      {item.error ? <div className="mt-1 text-xs text-danger">{item.error}</div> : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 disabled:opacity-40" disabled={index === 0} onClick={() => moveScreenshot(item.id, -1)} type="button">上移</button>
                      <button className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 disabled:opacity-40" disabled={index === screenshots.length - 1} onClick={() => moveScreenshot(item.id, 1)} type="button">下移</button>
                      <button className="rounded-lg border border-danger/30 px-2 py-1 text-xs text-danger" onClick={() => removeScreenshot(item.id)} type="button">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {working && uploadProgress > 0 ? (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>上传进度</span><span>{uploadProgress}%</span></div>
                <div className="h-2 rounded-full bg-white/10"><div className="brand-gradient h-2 rounded-full" style={{ width: `${uploadProgress}%` }} /></div>
              </div>
            ) : null}
            <PrimaryButton disabled={!streamerId || working} onClick={() => createSession(Boolean(screenshots.length))}>
              {working ? "正在创建复盘..." : screenshots.length ? "上传截图并识别" : "直接手动填写"}
            </PrimaryButton>
            {createdId ? (
              <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                {createdWithScreenshots ? "截图识别完成。" : "复盘草稿已创建。"}请先确认关键数据，再生成报告。
                <Link className="ml-2 font-bold underline" href={`/review/${createdId}/confirm`}>去确认数据</Link>
              </div>
            ) : null}
            </div>
          </Card>
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-brand">历史直播</div>
                <h2 className="mt-1 text-xl font-bold text-slate-50">历史记录</h2>
              </div>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filterStreamerId} onChange={(event) => setFilterStreamerId(event.target.value)}>
                <option value="">全部主播</option>
                {streamers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" disabled={!filterStreamerId || !historyAccounts.length} value={filterPlatformAccountId} onChange={(event) => setFilterPlatformAccountId(event.target.value)}>
                <option value="">全部抖音账号</option>
                {historyAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.display_name}{account.account_handle ? ` · ${account.account_handle}` : ""}</option>
                ))}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="metrics_recognized">待确认数据</option>
                <option value="metrics_confirmed">待生成报告</option>
                <option value="reported">已生成报告</option>
              </select>
              <label className="text-xs text-slate-500">
                开始日期
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={filterDateFrom} onChange={(event) => setFilterDateFrom(event.target.value)} />
              </label>
              <label className="text-xs text-slate-500">
                结束日期
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={filterDateTo} onChange={(event) => setFilterDateTo(event.target.value)} />
              </label>
              {(filterStreamerId || filterPlatformAccountId || filterStatus || filterDateFrom || filterDateTo) ? (
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" type="button" onClick={() => {
                  setFilterStreamerId("");
                  setFilterPlatformAccountId("");
                  setFilterStatus("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}>清空筛选</button>
              ) : null}
            </div>
            {!sessions.length ? <StatusMessage type="empty" text="还没有历史复盘。上传完成后会出现在这里。" /> : null}
            <div className="space-y-3">
              {sessions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-brand/30">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-50">{item.title}</div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">{statusText[item.status] ?? item.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.live_date || new Date(item.created_at).toLocaleDateString("zh-CN")}
                      {item.platform_account ? ` · ${item.platform_account.display_name}` : " · 未关联抖音账号"}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                      <span className="rounded-xl bg-white/5 px-3 py-2">时长：{item.duration_minutes ?? "未填"}</span>
                      <span className="rounded-xl bg-white/5 px-3 py-2">最高在线：{item.peak_online ?? "未填"}</span>
                      <span className="rounded-xl bg-white/5 px-3 py-2">平均在线：{item.average_online ?? "未填"}</span>
                      <span className="rounded-xl bg-white/5 px-3 py-2">新增关注：{item.new_followers ?? "未填"}</span>
                    </div>
                    {item.main_problem ? <div className="mt-3 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2 text-sm text-coral">最大问题：{item.main_problem}</div> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand" href={item.status === "reported" ? `/report/${item.id}` : `/review/${item.id}/confirm`}>
                      {item.status === "reported" ? "看报告" : "继续编辑"}
                    </Link>
                    <button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300" onClick={() => archiveSession(item)}>
                      {item.status === "reported" ? "归档" : "删除草稿"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function selectToBool(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
