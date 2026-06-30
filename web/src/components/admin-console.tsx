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
    total_users: "总用户", active_users: "启用用户", disabled_users: "禁用用户", streamers: "主播",
    platform_accounts: "平台账号", live_sessions: "直播复盘", screenshots: "截图上传", recognition_success: "识别成功",
    recognition_failed: "识别失败", reports: "报告", report_failed: "需检查报告", new_users_7d: "7天新用户", active_users_7d: "7天活跃"
  };
  return <div className="grid gap-3 md:grid-cols-4">{Object.entries(labels).map(([key, label]) => <Metric key={key} label={label} value={data[key] ?? 0} />)}</div>;
}

function AdminModels() {
  const [active, setActive] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ id: 0, provider_name: "openai-compatible", base_url: "", api_key: "", text_model_name: "", vision_model_name: "", timeout_ms: 30000, enabled: true });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const res = await apiFetch<{ active: Record<string, unknown> | null }>("/api/admin/models");
    setActive(res.active);
    if (res.active) setForm((old) => ({ ...old, id: Number(res.active?.id || 0), provider_name: String(res.active?.provider_name || old.provider_name), base_url: String(res.active?.base_url || ""), text_model_name: String(res.active?.text_model_name || ""), vision_model_name: String(res.active?.vision_model_name || ""), timeout_ms: Number(res.active?.timeout_ms || 30000), enabled: Boolean(res.active?.enabled) }));
  }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function save() {
    setError(""); setMessage("");
    try {
      const res = await apiFetch<Record<string, unknown>>("/api/admin/models", { method: "PUT", body: JSON.stringify(form) });
      setActive(res); setForm((old) => ({ ...old, api_key: "" })); setMessage("模型配置已保存。");
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败"); }
  }
  async function test(kind: "text" | "vision") {
    setError(""); setMessage("");
    try {
      const res = await apiFetch<{ message: string }>(`/api/admin/models/test-${kind}`, { method: "POST", body: "{}" });
      setMessage(res.message);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "测试失败"); }
  }
  return (
    <div className="grid gap-4">
      {error ? <StatusMessage type="error" text={error} /> : null}
      {message ? <StatusMessage type="success" text={message} /> : null}
      <Card>
        <h2 className="mb-4 text-lg font-bold">系统模型配置</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Provider" value={form.provider_name} onChange={(v) => setForm({ ...form, provider_name: v })} />
          <Input label="Base URL" value={form.base_url} onChange={(v) => setForm({ ...form, base_url: v })} />
          <Input label="API Key" type="password" placeholder={active?.api_key_masked ? String(active.api_key_masked) : "只在修改时填写"} value={form.api_key} onChange={(v) => setForm({ ...form, api_key: v })} />
          <Input label="文本模型" value={form.text_model_name} onChange={(v) => setForm({ ...form, text_model_name: v })} />
          <Input label="图片模型" value={form.vision_model_name} onChange={(v) => setForm({ ...form, vision_model_name: v })} />
          <Input label="超时毫秒" value={String(form.timeout_ms)} onChange={(v) => setForm({ ...form, timeout_ms: Number(v) || 30000 })} />
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
          <div>文本模型用于开播方案和复盘报告，当前可使用 <span className="text-slate-200">glm-5.1</span>。</div>
          <div>图片模型必须是支持图片输入的多模态/视觉模型；不要把 <span className="text-slate-200">glm-5.1</span> 填到图片模型里。</div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 启用为系统默认模型</label>
        <div className="mt-4 flex flex-wrap gap-2"><PrimaryButton onClick={save}>保存配置</PrimaryButton><SecondaryButton onClick={() => test("text")}>测试文本模型</SecondaryButton><SecondaryButton onClick={() => test("vision")}>测试图片模型</SecondaryButton></div>
      </Card>
      {active ? <Card><pre className="whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(active, null, 2)}</pre></Card> : null}
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

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-ink">{value}</div></Card>;
}

function Input({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-sm text-slate-400"><span>{label}</span><input className="input-dark" type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
