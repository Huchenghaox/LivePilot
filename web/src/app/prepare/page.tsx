"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, StatusMessage } from "@/components/ui";

type Streamer = { id: number; name: string; direction: string; is_archived?: boolean; is_default?: boolean };
type Plan = {
  recommended_theme: string;
  backup_themes: string[];
  titles: string[];
  opening_3_minutes: string;
  interaction_nodes: string[];
  follow_prompts: string[];
  new_traffic_script: string;
  outline: string[];
  risk_notes: string[];
  target_metrics?: string[];
};
type PreparePlan = {
  id: number;
  streamer_id: number;
  platform_account_id?: number | null;
  topic: string;
  duration_minutes: number;
  goal: string;
  live_form: string;
  has_cohost: boolean;
  has_ecommerce: boolean;
  special_notes: string;
  plan: Plan;
  is_used: boolean;
  used_at: string;
  created_at: string;
};
type PlatformAccount = { id: number; display_name: string; account_handle: string; is_primary: boolean };

const goals = ["更多人进入", "留得更久", "更多互动", "更多关注", "更多成交", "降低违规风险"];
const liveForms = ["单人口播", "评论互动", "互动连麦", "商品或服务讲解"];

export default function PreparePage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [streamerId, setStreamerId] = useState("");
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [platformAccountId, setPlatformAccountId] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [goal, setGoal] = useState("留得更久");
  const [liveForm, setLiveForm] = useState("评论互动");
  const [hasCohost, setHasCohost] = useState(false);
  const [hasEcommerce, setHasEcommerce] = useState(false);
  const [specialNotes, setSpecialNotes] = useState("");
  const [plans, setPlans] = useState<PreparePlan[]>([]);
  const [current, setCurrent] = useState<PreparePlan | null>(null);
  const [draftPlan, setDraftPlan] = useState<Plan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [streamerRows, planRows] = await Promise.all([
        apiFetch<Streamer[]>("/api/streamers"),
        apiFetch<{ items: PreparePlan[] }>("/api/prepare-plans")
      ]);
      const activeStreamers = streamerRows.filter((item) => !item.is_archived);
      setStreamers(activeStreamers);
      const savedStreamerId = window.localStorage.getItem("current_streamer_id") || "";
      const defaultStreamer = activeStreamers.find((item) => item.is_default);
      const preferredId = savedStreamerId || (defaultStreamer ? String(defaultStreamer.id) : "") || (activeStreamers[0] ? String(activeStreamers[0].id) : "");
      if (activeStreamers.some((item) => String(item.id) === preferredId)) {
        setStreamerId(preferredId);
      } else if (activeStreamers[0] && !streamerId) {
        setStreamerId(String(activeStreamers[0].id));
      }
      setPlans(planRows.items);
      const firstPlan = planRows.items[0] ?? null;
      setCurrent(firstPlan);
      setDraftPlan(firstPlan?.plan ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function generate(sectionName = "") {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<PreparePlan>("/api/prepare-plans", {
        method: "POST",
        body: JSON.stringify({
          streamer_id: Number(streamerId),
          platform_account_id: platformAccountId ? Number(platformAccountId) : null,
          topic,
          duration_minutes: durationMinutes,
          goal,
          live_form: liveForm,
          has_cohost: hasCohost,
          has_ecommerce: hasEcommerce,
          special_notes: specialNotes
        })
      });
      setCurrent(result);
      setDraftPlan(result.plan);
      setPlans((items) => [result, ...items]);
      setMessage(sectionName ? `${sectionName}已按当前信息换了一版，并保存为新的开播方案。` : "开播方案已生成，并保存为下一场计划。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setWorking(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制。");
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

  async function markUsed(plan: PreparePlan) {
    await apiFetch(`/api/prepare-plans/${plan.id}/mark-used`, { method: "POST" });
    setMessage("已标记为使用过。创建复盘时可以关联这份开播方案。");
    await load();
  }

  async function savePlanEdits() {
    if (!current || !draftPlan) return;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<PreparePlan>(`/api/prepare-plans/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ topic: current.topic, plan: draftPlan })
      });
      setCurrent(result);
      setDraftPlan(result.plan);
      setPlans((items) => items.map((item) => item.id === result.id ? result : item));
      setMessage("开播方案修改已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存修改失败");
    } finally {
      setWorking(false);
    }
  }

  function updateDraft(partial: Partial<Plan>) {
    setDraftPlan((plan) => plan ? { ...plan, ...partial } : plan);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadPlatformAccounts(streamerId);
  }, [streamerId]);

  return (
    <>
      <PageTitle title="开播准备" desc="输入下一场方向，生成可直接使用的标题、开场、互动和风险提醒。" />
      {loading ? <StatusMessage type="loading" text="正在读取开播准备..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      {!loading && !streamers.length ? (
        <Card>
          <StatusMessage type="empty" text="还没有可用主播。先创建主播档案，再生成开播方案。" />
        </Card>
      ) : null}
      {streamers.length ? (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="mb-4 text-lg font-bold">告诉AI下一场播什么</h2>
            <label className="mb-2 block text-sm font-medium">选择主播</label>
            <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={streamerId} onChange={(event) => {
              setStreamerId(event.target.value);
              window.localStorage.setItem("current_streamer_id", event.target.value);
            }}>
              {streamers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.direction}</option>)}
            </select>
            {platformAccounts.length > 1 ? (
              <>
                <label className="mb-2 block text-sm font-medium">抖音账号，可选</label>
                <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={platformAccountId} onChange={(event) => setPlatformAccountId(event.target.value)}>
                  <option value="">不绑定具体账号</option>
                  {platformAccounts.map((item) => <option key={item.id} value={item.id}>{item.display_name}{item.is_primary ? " · 主要账号" : ""}</option>)}
                </select>
              </>
            ) : platformAccounts.length === 1 ? (
              <div className="mb-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">当前抖音账号：{platformAccounts[0].display_name}</div>
            ) : (
              <div className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">当前主播未绑定抖音账号，仍可生成通用开播方案。</div>
            )}
            <label className="mb-2 block text-sm font-medium">下一场大致主题</label>
            <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="例如 新手主播怎么留人" value={topic} onChange={(event) => setTopic(event.target.value)} />
            <label className="mb-2 block text-sm font-medium">预计时长（分钟）</label>
            <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" type="number" min={10} max={480} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} />
            <label className="mb-2 block text-sm font-medium">本场目标</label>
            <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={goal} onChange={(event) => setGoal(event.target.value)}>
              {goals.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="mb-2 block text-sm font-medium">直播形式</label>
            <select className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" value={liveForm} onChange={(event) => setLiveForm(event.target.value)}>
              {liveForms.map((item) => <option key={item}>{item}</option>)}
            </select>
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={hasCohost} onChange={(event) => setHasCohost(event.target.checked)} />
                本场可能连麦
              </label>
              <label className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm">
                <input type="checkbox" checked={hasEcommerce} onChange={(event) => setHasEcommerce(event.target.checked)} />
                有带货或服务转化
              </label>
            </div>
            <label className="mb-2 block text-sm font-medium">本次特别注意事项</label>
            <textarea className="mb-4 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="例如 最近不要提诱导打赏，表达更温和" value={specialNotes} onChange={(event) => setSpecialNotes(event.target.value)} />
            <PrimaryButton disabled={!streamerId || !topic || working} onClick={() => void generate()}>
              {working ? "正在生成..." : current ? "换一批" : "生成开播方案"}
            </PrimaryButton>
          </Card>

          <div className="space-y-5">
            <Card>
              <h2 className="mb-4 text-lg font-bold">开播方案</h2>
              {!current ? <StatusMessage type="empty" text="填写主题后生成方案。完整长稿后续开放。" /> : null}
              {current && draftPlan ? (
                <PlanView
                  plan={draftPlan}
                  working={working}
                  onCopy={copy}
                  onChange={updateDraft}
                  onSave={savePlanEdits}
                  onRegenerate={generate}
                  onMarkUsed={() => markUsed(current)}
                  isUsed={current.is_used}
                />
              ) : null}
            </Card>
            <Card>
              <h2 className="mb-3 text-lg font-bold">最近保存的方案</h2>
              {!plans.length ? <StatusMessage type="empty" text="还没有保存过开播方案。" /> : null}
              <div className="space-y-2">
                {plans.slice(0, 5).map((item) => (
                  <button key={item.id} className="w-full rounded-md border border-slate-200 p-3 text-left" onClick={() => {
                    setCurrent(item);
                    setDraftPlan(item.plan);
                  }}>
                    <div className="font-semibold">{item.topic}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.goal} · {item.live_form || "直播形式未标注"} · {item.duration_minutes}分钟 · {item.is_used ? "已使用" : "未使用"} · {new Date(item.created_at).toLocaleString("zh-CN")}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PlanView({
  plan,
  working,
  onCopy,
  onChange,
  onSave,
  onRegenerate,
  onMarkUsed,
  isUsed
}: {
  plan: Plan;
  working: boolean;
  onCopy: (text: string) => void;
  onChange: (partial: Partial<Plan>) => void;
  onSave: () => void;
  onRegenerate: (sectionName: string) => void;
  onMarkUsed: () => void;
  isUsed: boolean;
}) {
  return (
    <div className="space-y-4">
      <Info title="首选主题" text={plan.recommended_theme} working={working} onCopy={onCopy} onChange={(value) => onChange({ recommended_theme: value })} onRegenerate={onRegenerate} />
      <PlanList title="备选主题" items={plan.backup_themes} working={working} onCopy={onCopy} onChange={(items) => onChange({ backup_themes: items })} onRegenerate={onRegenerate} />
      <PlanList title="5条标题" items={plan.titles} working={working} onCopy={onCopy} onChange={(items) => onChange({ titles: items })} onRegenerate={onRegenerate} />
      <Info title="开场3分钟" text={plan.opening_3_minutes} working={working} onCopy={onCopy} onChange={(value) => onChange({ opening_3_minutes: value })} onRegenerate={onRegenerate} />
      <PlanList title="3个互动节点" items={plan.interaction_nodes} working={working} onCopy={onCopy} onChange={(items) => onChange({ interaction_nodes: items })} onRegenerate={onRegenerate} />
      <PlanList title="2个关注引导" items={plan.follow_prompts} working={working} onCopy={onCopy} onChange={(items) => onChange({ follow_prompts: items })} onRegenerate={onRegenerate} />
      <Info title="新流量承接话术" text={plan.new_traffic_script} working={working} onCopy={onCopy} onChange={(value) => onChange({ new_traffic_script: value })} onRegenerate={onRegenerate} />
      <PlanList title="简版直播提纲" items={plan.outline} working={working} onCopy={onCopy} onChange={(items) => onChange({ outline: items })} onRegenerate={onRegenerate} />
      <PlanList title="合规注意事项" items={plan.risk_notes} working={working} onCopy={onCopy} onChange={(items) => onChange({ risk_notes: items })} onRegenerate={onRegenerate} />
      <PlanList title="下一场目标指标" items={plan.target_metrics ?? []} working={working} onCopy={onCopy} onChange={(items) => onChange({ target_metrics: items })} onRegenerate={onRegenerate} />
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={working} onClick={onSave}>
          {working ? "正在保存..." : "保存修改"}
        </button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={isUsed} onClick={onMarkUsed}>
        {isUsed ? "已标记使用" : "标记为已使用"}
        </button>
      </div>
    </div>
  );
}

function Info({
  title,
  text,
  working,
  onCopy,
  onChange,
  onRegenerate
}: {
  title: string;
  text: string;
  working: boolean;
  onCopy: (text: string) => void;
  onChange: (value: string) => void;
  onRegenerate: (sectionName: string) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 font-semibold">{title}</div>
      <textarea className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-600" value={text} onChange={(event) => onChange(event.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold" onClick={() => onCopy(text)}>复制</button>
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50" disabled={working} onClick={() => onRegenerate(title)}>
          {working ? "生成中..." : "按当前信息换一版"}
        </button>
      </div>
    </div>
  );
}

function PlanList({
  title,
  items,
  working,
  onCopy,
  onChange,
  onRegenerate
}: {
  title: string;
  items: string[];
  working: boolean;
  onCopy: (text: string) => void;
  onChange: (items: string[]) => void;
  onRegenerate: (sectionName: string) => void;
}) {
  const text = items.join("\n");
  const updateItems = (value: string) => onChange(value.split("\n").map((item) => item.trim()).filter(Boolean));
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 font-semibold">{title}</div>
      <textarea className="min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-600" value={text} onChange={(event) => updateItems(event.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold" onClick={() => onCopy(text)}>复制全部</button>
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50" disabled={working} onClick={() => onRegenerate(title)}>
          {working ? "生成中..." : "按当前信息换一版"}
        </button>
      </div>
    </div>
  );
}
