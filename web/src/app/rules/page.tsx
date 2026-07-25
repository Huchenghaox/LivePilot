"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, StatusMessage } from "@/components/ui";

type RuleItem = {
  id: number;
  title: string;
  raw_content?: string;
  rule_type: string;
  scope_type: string;
  scope_value: string;
  source_name: string;
  source_url: string;
  published_at: string;
  effective_at: string;
  expires_at: string;
  status: string;
  risk_level: string;
  version_number: number;
  interpretation?: {
    summary: string;
    risky_behaviors: string[];
    recommended_actions: string[];
    keywords: string[];
    possible_conflicts: { title: string; conflict: string }[];
  } | null;
};

type RuleResponse = { items: RuleItem[]; is_admin: boolean };
type RuleVersion = { id: number; version_number: number; change_reason: string; raw_content: string; created_at: string };

const emptyForm = {
  title: "",
  raw_content: "",
  rule_type: "主播个人提醒",
  scope_type: "某个主播",
  scope_value: "",
  source_name: "",
  source_url: "",
  published_at: "",
  effective_at: "",
  expires_at: ""
};

export default function RulesPage() {
  const [items, setItems] = useState<RuleItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<RuleItem | null>(null);
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (keyword) query.set("keyword", keyword);
      if (typeFilter) query.set("rule_type", typeFilter);
      const result = await apiFetch<RuleResponse>(`/api/rules?${query.toString()}`);
      setItems(result.items);
      setIsAdmin(result.is_admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<RuleItem>("/api/rules", { method: "POST", body: JSON.stringify(form) });
      setSelected(result);
      setForm(emptyForm);
      setMessage("规则已保存，AI 已完成理解，请确认后生效。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function confirmRule(rule: RuleItem, status = "已生效") {
    setWorking(true);
    setError("");
    try {
      const updated = await apiFetch<RuleItem>(`/api/rules/${rule.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ structured_content: rule.interpretation ?? {}, status })
      });
      setSelected(updated);
      setMessage(status === "已生效" ? "规则已生效。" : "规则已保存为草稿。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorking(false);
    }
  }

  async function selectRule(rule: RuleItem) {
    setSelected(rule);
    setEditTitle(rule.title);
    setEditContent(rule.raw_content ?? "");
    const result = await apiFetch<{ items: RuleVersion[] }>(`/api/rules/${rule.id}/versions`);
    setVersions(result.items);
  }

  async function saveEdit(rule: RuleItem) {
    setWorking(true);
    setError("");
    try {
      const updated = await apiFetch<RuleItem>(`/api/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle, raw_content: editContent, change_reason: "人工编辑后重新理解" })
      });
      setSelected(updated);
      setMessage("规则已更新，AI 已重新理解，请确认后生效。");
      const result = await apiFetch<{ items: RuleVersion[] }>(`/api/rules/${rule.id}/versions`);
      setVersions(result.items);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function disableRule(rule: RuleItem) {
    setWorking(true);
    setError("");
    try {
      await apiFetch(`/api/rules/${rule.id}/disable`, { method: "POST" });
      setMessage("规则已停用。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "停用失败");
    } finally {
      setWorking(false);
    }
  }

  const personalRules = useMemo(() => items.filter((item) => item.rule_type === "主播个人提醒"), [items]);
  const publicRules = useMemo(() => items.filter((item) => item.rule_type !== "主播个人提醒"), [items]);

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="规则与提示" desc="维护最新规则、运营经验和主播提醒。AI 只会使用已生效的相关规则。" />
      {loading ? <StatusMessage type="loading" text="正在读取规则..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <h2 className="mb-3 text-lg font-bold">添加规则或提醒</h2>
          <div className="grid gap-3">
            <Input label="规则标题" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
            <label>
              <span className="mb-1 block text-sm font-medium">规则内容</span>
              <textarea className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.raw_content} onChange={(event) => setForm({ ...form, raw_content: event.target.value })} />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="规则类型" value={form.rule_type} options={isAdmin ? ["平台官方规则", "运营经验", "主播个人提醒", "系统提示"] : ["主播个人提醒"]} onChange={(value) => setForm({ ...form, rule_type: value })} />
              <Select label="适用范围" value={form.scope_type} options={["全部主播", "某类主播", "某个主播", "某种直播形式"]} onChange={(value) => setForm({ ...form, scope_type: value })} />
              <Input label="范围说明" value={form.scope_value} placeholder="例如 情感陪伴、评论互动、主播ID" onChange={(value) => setForm({ ...form, scope_value: value })} />
              <Input label="来源名称" value={form.source_name} placeholder="官方公告、团队经验、本人提醒" onChange={(value) => setForm({ ...form, source_name: value })} />
              <Input label="来源链接" value={form.source_url} onChange={(value) => setForm({ ...form, source_url: value })} />
              <Input label="发布时间" value={form.published_at} placeholder="2026-06-24" onChange={(value) => setForm({ ...form, published_at: value })} />
              <Input label="生效日期" value={form.effective_at} placeholder="留空表示立即可用" onChange={(value) => setForm({ ...form, effective_at: value })} />
              <Input label="失效日期" value={form.expires_at} placeholder="留空表示长期有效" onChange={(value) => setForm({ ...form, expires_at: value })} />
            </div>
            <PrimaryButton disabled={working || !form.title || !form.raw_content} onClick={submit}>
              {working ? "正在让AI理解..." : "保存并让AI理解"}
            </PrimaryButton>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="mb-3 flex flex-wrap gap-2">
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="搜索规则" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">全部类型</option>
                {["平台官方规则", "运营经验", "主播个人提醒", "系统提示"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={load}>搜索</button>
            </div>
            <RuleSection title="我的主播规则" items={personalRules} onSelect={selectRule} />
            <RuleSection title="平台公共规则" items={publicRules} onSelect={selectRule} />
          </Card>

          {selected ? (
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">{selected.rule_type} · {selected.status} · v{selected.version_number}</div>
                  <h2 className="mt-1 text-xl font-bold">{selected.title}</h2>
                </div>
                <button className="text-sm font-semibold text-slate-500" onClick={() => setSelected(null)}>关闭</button>
              </div>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6">{selected.raw_content}</div>
              <details className="mt-4 rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold">编辑规则</summary>
                <div className="mt-3 grid gap-3">
                  <Input label="规则标题" value={editTitle} onChange={setEditTitle} />
                  <label>
                    <span className="mb-1 block text-sm font-medium">规则内容</span>
                    <textarea className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={editContent} onChange={(event) => setEditContent(event.target.value)} />
                  </label>
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" disabled={working || !editTitle || !editContent} onClick={() => saveEdit(selected)}>保存并重新理解</button>
                </div>
              </details>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info label="AI理解摘要" value={selected.interpretation?.summary || "暂无"} />
                <Info label="关键词" value={(selected.interpretation?.keywords ?? []).join("、") || "暂无"} />
                <Info label="谨慎行为" value={(selected.interpretation?.risky_behaviors ?? []).join("；") || "暂无"} />
                <Info label="建议动作" value={(selected.interpretation?.recommended_actions ?? []).join("；") || "暂无"} />
              </div>
              {selected.interpretation?.possible_conflicts?.length ? (
                <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  发现潜在冲突：{selected.interpretation.possible_conflicts.map((item) => `${item.title}：${item.conflict}`).join("；")}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white" disabled={working} onClick={() => confirmRule(selected)}>确认生效</button>
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" disabled={working} onClick={() => confirmRule(selected, "草稿")}>保存为草稿</button>
                <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600" disabled={working} onClick={() => disableRule(selected)}>停用</button>
              </div>
              <details className="mt-4 rounded-md border border-slate-200 p-3">
                <summary className="cursor-pointer font-semibold">查看版本</summary>
                <div className="mt-3 space-y-2">
                  {versions.map((item) => (
                    <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm">
                      <div className="font-semibold">v{item.version_number} · {item.change_reason || "规则更新"}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("zh-CN")}</div>
                      <div className="mt-2 line-clamp-2 text-slate-600">{item.raw_content}</div>
                    </div>
                  ))}
                </div>
              </details>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function RuleSection({ title, items, onSelect }: { title: string; items: RuleItem[]; onSelect: (item: RuleItem) => void }) {
  return (
    <div className="mb-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {!items.length ? <StatusMessage type="empty" text="暂无规则。" /> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <button key={item.id} className="w-full rounded-md border border-slate-200 p-3 text-left" onClick={() => onSelect(item)}>
            <div className="font-semibold">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">{item.rule_type} · {item.scope_type} · {item.status} · {item.effective_at || "立即生效"}</div>
            <div className="mt-1 text-xs text-slate-500">来源：{item.source_name || "未填写"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Input({ label, value, placeholder = "", onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  );
}
