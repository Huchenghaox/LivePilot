"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type Section = "dashboard" | "models" | "users" | "rules" | "system";

const tabs: { key: Section; label: string; href: string }[] = [
  { key: "dashboard", label: "概览", href: "/admin/dashboard" },
  { key: "models", label: "模型", href: "/admin/models" },
  { key: "users", label: "用户", href: "/admin/users" },
  { key: "rules", label: "规则", href: "/admin/rules" },
  { key: "system", label: "系统", href: "/admin/system" }
];

export function AdminConsole({ section = "dashboard" }: { section?: Section }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ user: { role?: string } }>("/api/me")
      .then((res) => {
        if (res.user.role !== "admin") throw new Error("你没有系统管理权限。");
        setAllowed(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "无法进入系统管理"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StatusMessage type="loading" text="正在检查管理员权限..." />;
  if (error || !allowed) return <StatusMessage type="error" text={error || "你没有系统管理权限。"} />;

  return (
    <>
      <PageTitle title="系统管理" desc="管理LivePilot上线所需的模型、用户、规则和系统状态。" />
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${section === tab.key ? "brand-gradient text-[#061016]" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {section === "dashboard" ? <AdminDashboard /> : null}
      {section === "models" ? <AdminModels /> : null}
      {section === "users" ? <AdminUsers /> : null}
      {section === "rules" ? <AdminRules /> : null}
      {section === "system" ? <AdminSystem /> : null}
    </>
  );
}

function AdminDashboard() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Record<string, number>>("/api/admin/dashboard").then(setData).catch((err) => setError(err.message)); }, []);
  if (error) return <StatusMessage type="error" text={error} />;
  if (!data) return <StatusMessage type="loading" text="正在读取运营概览..." />;
  const labels: Record<string, string> = {
    total_users: "用户总数", new_users_today: "今日新增", active_users_today: "今日活跃", active_users: "启用用户",
    streamers: "主播档案", platform_accounts: "平台账号", preparation_plans: "开播方案", live_sessions: "直播复盘",
    reports: "复盘报告", screenshots: "截图上传", ai_generations: "AI生成次数", model_calls: "模型调用次数",
    model_errors: "模型错误", errors_today: "今日错误", recognition_success: "识别成功", recognition_failed: "识别失败"
  };
  return (
    <div className="grid gap-5">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-semibold text-brand">运营看板</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-50">LivePilot 增长系统运行概览</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">关注用户增长、直播复盘使用、AI生成和模型错误，先发现影响上线体验的问题。</p>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-4">{Object.entries(labels).map(([key, label]) => <Metric key={key} label={label} value={data[key] ?? 0} highlight={["new_users_today", "active_users_today", "ai_generations", "model_errors"].includes(key)} />)}</div>
    </div>
  );
}

function AdminModels() {
  type Provider = { id: number; name: string; base_url: string; api_key_masked?: string; api_key_last_four?: string; enabled: boolean; last_test_status?: string; last_test_message?: string; last_tested_at?: string; models?: { model_id: string; capability: string }[] };
  type Assignments = { default_text_provider_id: number | null; default_text_model_name: string; default_vision_provider_id: number | null; default_vision_model_name: string; report_provider_id?: number | null; report_model_name?: string; preparation_provider_id?: number | null; preparation_model_name?: string };
  const emptyProvider = { id: 0, name: "JintouAPI", base_url: "https://token.naitg.cn/v1", api_key: "", enabled: true };
  const [providers, setProviders] = useState<Provider[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({ default_text_provider_id: null, default_text_model_name: "", default_vision_provider_id: null, default_vision_model_name: "" });
  const [providerForm, setProviderForm] = useState(emptyProvider);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await apiFetch<{ providers: Provider[]; assignments: Assignments }>("/api/admin/models");
    setProviders(res.providers || []);
    setAssignments(res.assignments || { default_text_provider_id: null, default_text_model_name: "", default_vision_provider_id: null, default_vision_model_name: "" });
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function run(label: string, action: () => Promise<void>) {
    setError(""); setMessage("");
    setBusy(label);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy("");
    }
  }

  async function saveProvider() {
    await run("save-provider", async () => {
      const path = providerForm.id ? `/api/admin/model-providers/${providerForm.id}` : "/api/admin/model-providers";
      await apiFetch(path, { method: providerForm.id ? "PUT" : "POST", body: JSON.stringify(providerForm) });
      setProviderForm(emptyProvider);
      setMessage("模型源已保存。");
      await load();
    });
  }

  async function saveAssignments() {
    await run("save-assignments", async () => {
      await apiFetch("/api/admin/model-assignments", { method: "PUT", body: JSON.stringify(assignments) });
      setMessage("系统默认模型已保存。");
      await load();
    });
  }

  async function testProvider(id: number) {
    await run(`test-provider-${id}`, async () => {
      const res = await apiFetch<{ message: string }>(`/api/admin/model-providers/${id}/test`, { method: "POST", body: "{}" });
      setMessage(res.message);
      await load();
    });
  }

  async function syncModels(id: number) {
    await run(`sync-${id}`, async () => {
      const res = await apiFetch<{ message: string }>(`/api/admin/model-providers/${id}/sync-models`, { method: "POST", body: "{}" });
      setMessage(res.message);
      await load();
    });
  }

  async function disableProvider(id: number) {
    if (!window.confirm("确定停用这个模型源？停用后使用它的默认模型会失效。")) return;
    await run(`disable-${id}`, async () => {
      await apiFetch(`/api/admin/model-providers/${id}`, { method: "DELETE" });
      setMessage("模型源已停用。");
      await load();
    });
  }

  async function testAssigned(kind: "text" | "vision") {
    await run(`test-${kind}`, async () => {
      const res = await apiFetch<{ message: string }>(`/api/admin/model-assignments/test-${kind}`, { method: "POST", body: "{}" });
      setMessage(res.message);
    });
  }

  function modelsFor(providerId: number | null | undefined, capability?: string) {
    const provider = providers.find((item) => item.id === Number(providerId || 0));
    const models = provider?.models || [];
    return capability ? models.filter((item) => item.capability === capability || item.capability === "unknown") : models;
  }

  function editProvider(provider: Provider) {
    setProviderForm({ id: provider.id, name: provider.name, base_url: provider.base_url, api_key: "", enabled: provider.enabled });
    setMessage("正在编辑模型源，API Key 留空表示继续使用已保存的 Key。");
  }

  return (
    <div className="grid gap-4">
      {error ? <StatusMessage type="error" text={error} /> : null}
      {message ? <StatusMessage type="success" text={message} /> : null}
      <Card>
        <h2 className="mb-2 text-lg font-bold">模型源管理</h2>
        <p className="mb-4 text-sm leading-6 text-slate-400">先保存模型源，只验证 Base URL 和 API Key；再拉取模型列表。API Key 只显示后四位，不会回显明文。</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="模型源名称" value={providerForm.name} onChange={(v) => setProviderForm({ ...providerForm, name: v })} />
          <Input label="Base URL" value={providerForm.base_url} onChange={(v) => setProviderForm({ ...providerForm, base_url: v })} />
          <Input label="API Key" type="password" placeholder={providerForm.id ? "留空表示继续使用已保存的 Key" : "只会加密保存在服务端"} value={providerForm.api_key} onChange={(v) => setProviderForm({ ...providerForm, api_key: v })} />
          <label className="mt-7 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={providerForm.enabled} onChange={(e) => setProviderForm({ ...providerForm, enabled: e.target.checked })} /> 启用这个模型源</label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton disabled={Boolean(busy)} onClick={saveProvider}>{busy === "save-provider" ? "正在保存..." : providerForm.id ? "保存模型源" : "新增模型源"}</PrimaryButton>
          {providerForm.id ? <SecondaryButton disabled={Boolean(busy)} onClick={() => setProviderForm(emptyProvider)}>取消编辑</SecondaryButton> : null}
        </div>
        <div className="mt-5 grid gap-3">
          {providers.length ? providers.map((provider) => (
            <div key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-100">{provider.name} <span className="ml-2 text-xs text-slate-500">Key {provider.api_key_masked || "未保存"}</span></div>
                  <div className="mt-1 break-all text-xs text-slate-500">{provider.base_url}</div>
                  <div className="mt-2 text-xs text-slate-400">状态：{provider.enabled ? "启用" : "停用"} · 最近测试：{provider.last_test_message || "未测试"}</div>
                  {provider.models?.length ? <div className="mt-2 text-xs text-brand">已拉取 {provider.models.length} 个模型</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton disabled={Boolean(busy)} onClick={() => editProvider(provider)}>编辑</SecondaryButton>
                  <SecondaryButton disabled={Boolean(busy)} onClick={() => testProvider(provider.id)}>{busy === `test-provider-${provider.id}` ? "测试中..." : "测试连接"}</SecondaryButton>
                  <SecondaryButton disabled={Boolean(busy)} onClick={() => syncModels(provider.id)}>{busy === `sync-${provider.id}` ? "拉取中..." : "拉取模型"}</SecondaryButton>
                  <SecondaryButton disabled={Boolean(busy)} onClick={() => disableProvider(provider.id)}>停用</SecondaryButton>
                </div>
              </div>
            </div>
          )) : <StatusMessage type="empty" text="还没有模型源。先新增一个 Provider，再设置系统默认模型。" />}
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold">系统默认模型</h2>
        <p className="mb-4 text-sm leading-6 text-slate-400">文本模型用于开播方案、复盘报告、文案生成和总结分析。视觉模型只用于截图识别和图片分析；未配置视觉模型时，不影响文本功能。</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 text-sm font-bold text-brand">默认文本模型</div>
            <ModelProviderSelect value={assignments.default_text_provider_id} providers={providers} onChange={(id) => setAssignments({ ...assignments, default_text_provider_id: id, default_text_model_name: "" })} />
            <ModelNameSelect
              value={assignments.default_text_model_name}
              models={modelsFor(assignments.default_text_provider_id, "text")}
              placeholder="例如 glm-5.1"
              onChange={(value) => setAssignments({ ...assignments, default_text_model_name: value })}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton disabled={Boolean(busy)} onClick={() => testAssigned("text")}>{busy === "test-text" ? "测试中..." : "测试文本模型"}</SecondaryButton>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 text-sm font-bold text-brand">默认视觉模型</div>
            <ModelProviderSelect value={assignments.default_vision_provider_id} providers={providers} onChange={(id) => setAssignments({ ...assignments, default_vision_provider_id: id, default_vision_model_name: "" })} />
            <ModelNameSelect
              value={assignments.default_vision_model_name}
              models={modelsFor(assignments.default_vision_provider_id, "vision")}
              placeholder="例如 gpt-4o、qwen-vl-plus"
              onChange={(value) => setAssignments({ ...assignments, default_vision_model_name: value })}
            />
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
              如果当前 Provider 没有视觉模型，请保持为空。不要把 glm-5.1 填到视觉模型里。
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton disabled={Boolean(busy || !assignments.default_vision_model_name)} onClick={() => testAssigned("vision")}>{busy === "test-vision" ? "测试中..." : "测试视觉模型"}</SecondaryButton>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton disabled={Boolean(busy)} onClick={saveAssignments}>{busy === "save-assignments" ? "正在保存..." : "保存系统默认模型"}</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function ModelProviderSelect({ value, providers, onChange }: { value: number | null | undefined; providers: { id: number; name: string; enabled: boolean }[]; onChange: (id: number | null) => void }) {
  return (
    <label className="mb-3 grid gap-1 text-sm text-slate-400">
      <span>Provider</span>
      <select className="input-dark" value={value || ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
        <option value="">不配置</option>
        {providers.filter((item) => item.enabled).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
      </select>
    </label>
  );
}

function ModelNameSelect({ value, models, placeholder, onChange }: { value: string; models: { model_id: string; capability: string }[]; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm text-slate-400">
        <span>模型</span>
        <input className="input-dark" list={`models-${placeholder}`} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      <datalist id={`models-${placeholder}`}>
        {models.map((model) => <option key={model.model_id} value={model.model_id}>{model.model_id} · {model.capability}</option>)}
      </datalist>
      {models.length ? <div className="text-xs text-slate-500">可从下拉建议中选择，也可以手动输入模型名。</div> : <div className="text-xs text-slate-500">还没有模型列表，请先在模型源中“拉取模型”。</div>}
    </div>
  );
}

function AdminUsers() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  async function load() { const res = await apiFetch<{ items: Record<string, unknown>[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`); setItems(res.items); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function patch(id: unknown, path: string, body: unknown) { await apiFetch(`/api/admin/users/${id}/${path}`, { method: "PATCH", body: JSON.stringify(body) }); await load(); }
  return <Card>{error ? <StatusMessage type="error" text={error} /> : null}<div className="mb-4 flex gap-2"><input className="input-dark flex-1" placeholder="搜索用户名、昵称或手机号" value={q} onChange={(e) => setQ(e.target.value)} /><PrimaryButton onClick={load}>搜索</PrimaryButton></div><div className="grid gap-3">{items.map((u) => <div key={String(u.id)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="font-bold">{String(u.username)} <span className="text-xs text-slate-500">{String(u.phone_masked || "")}</span></div><div className="mt-1 text-sm text-slate-400">角色：{String(u.role)} · 状态：{String(u.status)} · 主播：{String(u.streamer_count || 0)} · 报告：{String(u.report_count || 0)}</div><div className="mt-3 flex flex-wrap gap-2"><SecondaryButton onClick={() => patch(u.id, "status", { status: u.status === "active" ? "disabled" : "active" })}>{u.status === "active" ? "禁用" : "启用"}</SecondaryButton><SecondaryButton onClick={() => patch(u.id, "role", { role: u.role === "admin" ? "user" : "admin" })}>{u.role === "admin" ? "取消管理员" : "设为管理员"}</SecondaryButton></div></div>)}</div></Card>;
}

function AdminRules() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ title: "", category: "运营经验", platform: "douyin", risk_level: "medium", content: "", source_name: "内部运营经验" });
  const [error, setError] = useState("");
  async function load() { const res = await apiFetch<{ items: Record<string, unknown>[] }>("/api/admin/rules"); setItems(res.items); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function create() { await apiFetch("/api/admin/rules", { method: "POST", body: JSON.stringify(form) }); setForm({ ...form, title: "", content: "" }); await load(); }
  async function status(id: unknown, value: string) { await apiFetch(`/api/admin/rules/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) }); await load(); }
  return <div className="grid gap-4">{error ? <StatusMessage type="error" text={error} /> : null}<Card><h2 className="mb-3 text-lg font-bold">新增系统规则</h2><div className="grid gap-3 md:grid-cols-2"><Input label="标题" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><Input label="来源" value={form.source_name} onChange={(v) => setForm({ ...form, source_name: v })} /></div><textarea className="input-dark mt-3 min-h-28 w-full" placeholder="规则内容" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /><PrimaryButton className="mt-3" onClick={create}>保存规则</PrimaryButton></Card><div className="grid gap-3">{items.map((rule) => <Card key={String(rule.id)}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{String(rule.title)}</div><div className="mt-1 text-sm text-slate-500">{String(rule.category)} · {String(rule.risk_level)} · {String(rule.source_name || "内部运营经验")}</div><p className="mt-3 text-sm leading-6 text-slate-300">{String(rule.content)}</p></div><SecondaryButton onClick={() => status(rule.id, rule.status === "active" ? "inactive" : "active")}>{rule.status === "active" ? "停用" : "启用"}</SecondaryButton></div></Card>)}</div></div>;
}

function AdminSystem() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { apiFetch<Record<string, unknown>>("/api/admin/system/status").then(setData).catch(() => setData({ error: "读取失败" })); }, []);
  if (!data) return <StatusMessage type="loading" text="正在读取系统状态..." />;
  return <Card><pre className="whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(data, null, 2)}</pre></Card>;
}

function Metric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-brand/25 bg-brand/5" : ""}>
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-50">{value}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="brand-gradient h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, value ? 56 : 8))}%` }} />
      </div>
    </Card>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-sm text-slate-400"><span>{label}</span><input className="input-dark" type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
