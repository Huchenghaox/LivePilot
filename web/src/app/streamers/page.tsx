"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, StatusMessage } from "@/components/ui";

type Streamer = {
  id: number;
  name: string;
  direction: string;
  live_forms: string[];
  average_online_range?: string;
  usual_live_time?: string;
  improvement_goal?: string;
  notes?: string;
  is_archived?: boolean;
  is_default?: boolean;
  session_count?: number;
};
const directions = ["内容分享", "情感陪伴", "才艺娱乐", "商品或服务销售"];
const forms = ["单人口播", "评论互动", "互动连麦", "商品或服务讲解"];
const onlineRanges = ["", "10人以下", "10-50人", "50-100人", "100-500人", "500人以上"];
const goals = ["", "更多人进入", "留得更久", "更多互动", "更多关注", "更多成交", "降低违规风险"];

export default function StreamersPage() {
  const [items, setItems] = useState<Streamer[]>([]);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState("内容分享");
  const [liveForms, setLiveForms] = useState<string[]>(["单人口播"]);
  const [averageOnlineRange, setAverageOnlineRange] = useState("");
  const [usualLiveTime, setUsualLiveTime] = useState("");
  const [improvementGoal, setImprovementGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentStreamerId, setCurrentStreamerId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await apiFetch<Streamer[]>("/api/streamers");
      setItems(rows);
      const savedId = window.localStorage.getItem("current_streamer_id") || "";
      const defaultStreamer = rows.find((item) => item.is_default && !item.is_archived);
      const currentId = savedId || (defaultStreamer ? String(defaultStreamer.id) : "");
      if (currentId) window.localStorage.setItem("current_streamer_id", currentId);
      setCurrentStreamerId(currentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setError("");
    setMessage("");
    try {
      const payload = { name, direction, live_forms: liveForms, average_online_range: averageOnlineRange, usual_live_time: usualLiveTime, improvement_goal: improvementGoal, notes };
      if (editingId) {
        await apiFetch(`/api/streamers/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("主播档案已更新。");
      } else {
        await apiFetch("/api/streamers", { method: "POST", body: JSON.stringify(payload) });
        setMessage("主播档案已保存。下一步可以开始复盘。");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  function resetForm() {
    setName("");
    setDirection("内容分享");
    setLiveForms(["单人口播"]);
    setAverageOnlineRange("");
    setUsualLiveTime("");
    setImprovementGoal("");
    setNotes("");
    setEditingId(null);
  }

  function edit(item: Streamer) {
    setEditingId(item.id);
    setName(item.name);
    setDirection(item.direction);
    setLiveForms(item.live_forms.length ? item.live_forms : ["单人口播"]);
    setAverageOnlineRange(item.average_online_range ?? "");
    setUsualLiveTime(item.usual_live_time ?? "");
    setImprovementGoal(item.improvement_goal ?? "");
    setNotes(item.notes ?? "");
  }

  async function archive(item: Streamer) {
    if (!window.confirm(item.session_count ? "这个主播已有直播记录，将归档而不是永久删除。确定继续？" : "确定删除这个主播？")) return;
    setError("");
    try {
      const result = await apiFetch<{ message: string }>(`/api/streamers/${item.id}`, { method: "DELETE" });
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function restore(item: Streamer) {
    setError("");
    try {
      const result = await apiFetch<{ message: string; streamer: Streamer }>(`/api/streamers/${item.id}/restore`, { method: "POST" });
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复失败");
    }
  }

  async function setCurrent(item: Streamer) {
    setError("");
    try {
      const result = await apiFetch<{ message: string; streamer: Streamer }>(`/api/streamers/${item.id}/set-default`, { method: "POST" });
      window.localStorage.setItem("current_streamer_id", String(item.id));
      setCurrentStreamerId(String(item.id));
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="主播档案" desc="只填写最少信息，更细标签后面交给 AI 判断。" />
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <h2 className="mb-4 text-lg font-bold">{editingId ? "编辑主播" : "创建主播"}</h2>
          <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="主播名称" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={direction} onChange={(event) => setDirection(event.target.value)}>
            {directions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {forms.map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={liveForms.includes(item)}
                  onChange={(event) => setLiveForms(event.target.checked ? [...liveForms, item] : liveForms.filter((form) => form !== item))}
                />
                {item}
              </label>
            ))}
          </div>
          <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={averageOnlineRange} onChange={(event) => setAverageOnlineRange(event.target.value)}>
            {onlineRanges.map((item) => <option key={item} value={item}>{item || "当前平均在线区间"}</option>)}
          </select>
          <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="常用直播时间，例如 每晚8点" value={usualLiveTime} onChange={(event) => setUsualLiveTime(event.target.value)} />
          <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={improvementGoal} onChange={(event) => setImprovementGoal(event.target.value)}>
            {goals.map((item) => <option key={item} value={item}>{item || "当前最想提升的问题"}</option>)}
          </select>
          <textarea className="mb-4 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="简单主播介绍，例如内容风格、注意事项" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <PrimaryButton disabled={!name} onClick={create}>{editingId ? "保存修改" : "保存主播"}</PrimaryButton>
            {editingId ? <button className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold" onClick={resetForm}>取消编辑</button> : null}
          </div>
          {error ? <div className="mt-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">已有主播</h2>
          {loading ? <StatusMessage type="loading" text="正在加载主播..." /> : null}
          {!loading && !items.length ? <StatusMessage type="empty" text="还没有主播。先创建一个主播，再开始复盘。" /> : null}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className={`rounded-md border p-4 ${item.is_archived ? "border-slate-200 bg-slate-50 opacity-70" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-bold">{item.name}{item.is_archived ? "（已归档）" : ""}</div>
                      {item.is_default || currentStreamerId === String(item.id) ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">当前主播</span> : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{item.direction} · {item.live_forms.join("、") || "未选择形式"}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.average_online_range || "在线区间未填写"} · {item.usual_live_time || "直播时间未填写"} · {item.improvement_goal || "提升目标未填写"}</div>
                    {item.notes ? <div className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</div> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {!item.is_archived ? <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setCurrent(item)}>设为当前</button> : null}
                    {item.is_archived ? <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => restore(item)}>恢复</button> : null}
                    <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm" href={`/review?streamer_id=${item.id}`}>历史直播</Link>
                    <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => edit(item)}>编辑</button>
                    <button className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600" onClick={() => archive(item)}>{item.session_count ? "归档" : "删除"}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
