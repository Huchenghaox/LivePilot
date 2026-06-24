"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type Setting = {
  id: number;
  name: string;
  mode: string;
  api_base: string;
  api_key_masked: string;
  model_name: string;
  purpose: string;
  timeout_seconds: number;
  max_retries: number;
  is_default: boolean;
  test_status: string;
  last_tested_at: string;
  last_error: string;
};

type Purpose = "文字分析" | "图片识别";
type Mode = "platform" | "custom" | "mock";

const emptyForm = {
  name: "",
  mode: "platform" as Mode,
  apiBase: "",
  apiKey: "",
  modelName: "",
  purpose: "文字分析" as Purpose,
  timeoutSeconds: 60,
  maxRetries: 1,
  isDefault: true
};

function modeLabel(mode: string) {
  if (mode === "platform") return "平台模型";
  if (mode === "mock") return "Mock 演示";
  return "自定义模型";
}

export default function ModelSettingsPage() {
  const [items, setItems] = useState<Setting[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);

  const defaultTextModel = useMemo(
    () => items.find((item) => item.purpose === "文字分析" && item.is_default && item.mode !== "mock"),
    [items]
  );
  const defaultImageModel = useMemo(
    () => items.find((item) => item.purpose === "图片识别" && item.is_default && item.mode !== "mock"),
    [items]
  );
  const mockImageModel = useMemo(
    () => items.find((item) => item.purpose === "图片识别" && item.mode === "mock" && item.is_default),
    [items]
  );

  async function load() {
    setError("");
    try {
      setItems(await apiFetch<Setting[]>("/api/model-settings"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  function startAdd(purpose: Purpose, mode: Mode = "platform") {
    setEditingId(null);
    setForm({
      ...emptyForm,
      purpose,
      mode,
      name: purpose === "文字分析" ? "文字分析模型" : mode === "mock" ? "Mock图片识别演示" : "图片识别模型",
      modelName: mode === "mock" ? "mock-vision" : ""
    });
    setAdvanced(mode !== "mock");
    setMessage("");
    setError("");
  }

  function startEdit(item: Setting) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      mode: item.mode as Mode,
      apiBase: item.api_base,
      apiKey: "",
      modelName: item.model_name,
      purpose: item.purpose as Purpose,
      timeoutSeconds: item.timeout_seconds,
      maxRetries: item.max_retries,
      isDefault: item.is_default
    });
    setAdvanced(true);
    setMessage("正在编辑配置。API Key 留空则保持原值。");
    setError("");
  }

  async function save() {
    setMessage("");
    setError("");
    try {
      await apiFetch(editingId ? `/api/model-settings/${editingId}` : "/api/model-settings", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name,
          mode: form.mode,
          api_base: form.apiBase,
          api_key: form.apiKey,
          model_name: form.modelName,
          purpose: form.purpose,
          timeout_seconds: form.timeoutSeconds,
          max_retries: form.maxRetries,
          is_default: form.isDefault
        })
      });
      setMessage(editingId ? "模型配置已更新。" : form.mode === "mock" ? "Mock 图片识别演示已开启。" : "模型配置已保存。请使用测试连接确认可用。");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function testSetting(item: Setting) {
    setTestingId(item.id);
    setMessage("");
    setError("");
    try {
      const result = await apiFetch<{ message: string; model?: string }>(`/api/model-settings/${item.id}/test`, { method: "POST" });
      setMessage(`${item.name}：${result.message}${result.model ? ` · ${result.model}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试失败");
    } finally {
      setTestingId(null);
    }
  }

  async function remove(item: Setting) {
    if (!window.confirm(`确定删除“${item.name}”？删除后不会保留 API Key。`)) return;
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/model-settings/${item.id}`, { method: "DELETE" });
      setMessage("模型配置已删除。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function setDefault(item: Setting) {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/model-settings/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_default: true })
      });
      setMessage("默认模型已切换。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置默认失败");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="模型设置" desc="文字分析和图片识别分开配置。没有图片模型时，可以手动录入数据或开启 Mock 演示。" />
      {message ? <div className="mb-4"><StatusMessage type="success" text={message} /></div> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">文字分析模型</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">用于生成复盘报告、下一场方案、标题和话术。</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${defaultTextModel ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {defaultTextModel ? "已配置" : "未配置"}
            </span>
          </div>
          <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            {defaultTextModel ? (
              <>
                <div className="font-semibold text-slate-800">{defaultTextModel.model_name || defaultTextModel.name}</div>
                <div className="mt-1">{modeLabel(defaultTextModel.mode)} · {defaultTextModel.api_key_masked || "未填写 Key"}</div>
              </>
            ) : "请添加一个文字分析模型，或确认平台默认模型已经配置。"}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => startAdd("文字分析", "platform")}>更换文字模型</PrimaryButton>
            {defaultTextModel ? <SecondaryButton onClick={() => void testSetting(defaultTextModel)} disabled={testingId === defaultTextModel.id}>{testingId === defaultTextModel.id ? "测试中..." : "测试连接"}</SecondaryButton> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">图片识别模型</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">用于读取抖音后台截图。当前未配置时，正式测试走手动录入。</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${defaultImageModel ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {defaultImageModel ? "已配置" : "未配置"}
            </span>
          </div>
          <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            {defaultImageModel ? (
              <>
                <div className="font-semibold text-slate-800">{defaultImageModel.model_name || defaultImageModel.name}</div>
                <div className="mt-1">{modeLabel(defaultImageModel.mode)} · {defaultImageModel.api_key_masked || "未填写 Key"}</div>
              </>
            ) : "当前尚未配置图片识别模型。上传截图后可手动录入关键数据。"}
          </div>
          {mockImageModel ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              当前使用模拟识别结果，仅用于功能演示。
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => startAdd("图片识别", "platform")}>添加图片模型</PrimaryButton>
            <SecondaryButton onClick={() => void startAdd("图片识别", "mock")}>开启 Mock 演示</SecondaryButton>
            {defaultImageModel ? <SecondaryButton onClick={() => void testSetting(defaultImageModel)} disabled={testingId === defaultImageModel.id}>{testingId === defaultImageModel.id ? "测试中..." : "测试连接"}</SecondaryButton> : null}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-bold">{editingId ? "编辑模型配置" : "添加或更换配置"}</h2>
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(["文字分析", "图片识别"] as Purpose[]).map((purpose) => (
                <button key={purpose} className={`rounded-md border p-3 text-sm font-semibold ${form.purpose === purpose ? "border-brand bg-emerald-50 text-brand" : "border-slate-200"}`} onClick={() => startAdd(purpose, form.mode)}>
                  {purpose}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["platform", "使用平台模型"],
                ["custom", "使用自己的模型"],
                ["mock", "Mock 演示"]
              ].map(([mode, label]) => (
                <button key={mode} className={`rounded-md border p-3 text-sm ${form.mode === mode ? "border-brand bg-emerald-50 text-brand" : "border-slate-200"}`} onClick={() => setForm({ ...form, mode: mode as Mode, name: mode === "mock" ? "Mock图片识别演示" : form.name, modelName: mode === "mock" ? "mock-vision" : form.modelName })}>
                  {label}
                </button>
              ))}
            </div>
            {form.mode === "mock" ? (
              <StatusMessage type="empty" text="Mock 只用于演示截图识别流程，正式分析请手动录入或配置真实图片模型。" />
            ) : null}
            <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="配置名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            {form.mode !== "mock" ? (
              <>
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="API Base URL，例如 https://api.example.com/v1" value={form.apiBase} onChange={(event) => setForm({ ...form, apiBase: event.target.value })} />
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="API Key" type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} />
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="模型名称" value={form.modelName} onChange={(event) => setForm({ ...form, modelName: event.target.value })} />
              </>
            ) : null}
            <button className="text-left text-sm font-semibold text-brand" onClick={() => setAdvanced(!advanced)}>{advanced ? "收起高级设置" : "展开高级设置"}</button>
            {advanced ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">请求超时时间（秒）</span>
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="number" min={5} max={180} value={form.timeoutSeconds} onChange={(event) => setForm({ ...form, timeoutSeconds: Number(event.target.value) })} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">最大重试次数</span>
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2" type="number" min={0} max={3} value={form.maxRetries} onChange={(event) => setForm({ ...form, maxRetries: Number(event.target.value) })} />
                </label>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
              设为默认{form.purpose}模型
            </label>
            <PrimaryButton disabled={!form.name || (form.mode !== "mock" && (!form.apiBase || (!editingId && !form.apiKey) || !form.modelName))} onClick={save}>
              {editingId ? "保存修改" : "保存设置"}
            </PrimaryButton>
            {editingId ? <SecondaryButton onClick={() => startAdd(form.purpose, form.mode)}>取消编辑</SecondaryButton> : null}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold">已保存配置</h2>
          {!items.length ? <StatusMessage type="empty" text="还没有模型配置。文字报告需要配置文字模型；图片识别可先用手动录入。" /> : null}
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{item.name}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.purpose}{item.is_default ? " · 默认" : ""}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {modeLabel(item.mode)} · {item.model_name || "未填写模型名"} · {item.api_key_masked || "无 API Key"}
                </div>
                <div className="mt-1 text-xs text-slate-500">超时 {item.timeout_seconds} 秒 · 重试 {item.max_retries} 次</div>
                <div className="mt-1 text-xs text-slate-500">
                  测试状态：{item.test_status || "未测试"}
                  {item.last_tested_at ? ` · ${new Date(item.last_tested_at).toLocaleString("zh-CN")}` : ""}
                  {item.last_error ? ` · ${item.last_error}` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => void testSetting(item)} disabled={testingId === item.id}>{testingId === item.id ? "测试中..." : "测试连接"}</SecondaryButton>
                  <SecondaryButton onClick={() => startEdit(item)}>编辑</SecondaryButton>
                  {!item.is_default ? <SecondaryButton onClick={() => setDefault(item)}>设为默认</SecondaryButton> : null}
                  <SecondaryButton onClick={() => void remove(item)}>删除</SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
