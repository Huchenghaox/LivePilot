"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, PageTitle, SecondaryButton, StatusMessage } from "@/components/ui";

type DashboardStatus = {
  model_status?: {
    text_model_configured?: boolean;
    image_model_configured?: boolean;
    text_model_name?: string;
    image_model_name?: string;
    image_model_message?: string;
  };
};

type Me = { user: { role?: string } };

export default function ModelSettingsPage() {
  const [data, setData] = useState<DashboardStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [dashboard, me] = await Promise.all([
        apiFetch<DashboardStatus>("/api/dashboard"),
        apiFetch<Me>("/api/me")
      ]);
      setData(dashboard);
      setIsAdmin(me.user.role === "admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型状态读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const status = data?.model_status;

  return (
    <>
      <PageTitle title="AI能力状态" desc="LivePilot 使用系统统一配置的文本模型和视觉模型。普通用户不需要填写 API Key。" />
      {loading ? <StatusMessage type="loading" text="正在读取AI能力状态..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {!loading && !error ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-50">文字分析模型</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">用于开播方案、复盘报告、标题、话术和总结分析。</p>
              </div>
              <StatusPill ok={Boolean(status?.text_model_configured)} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              {status?.text_model_configured ? (
                <>当前文本模型：<span className="font-semibold text-brand">{status.text_model_name || "已配置"}</span></>
              ) : (
                "当前未配置文字分析模型。开播方案和复盘报告暂时无法生成。"
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-50">视觉识别模型</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">用于识别直播后台截图。未配置时，手动录入和报告生成仍可使用。</p>
              </div>
              <StatusPill ok={Boolean(status?.image_model_configured)} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              {status?.image_model_configured ? (
                <>当前视觉模型：<span className="font-semibold text-brand">{status.image_model_name || "已配置"}</span></>
              ) : (
                status?.image_model_message || "当前视觉模型未配置。上传截图后可继续手动确认和填写关键数据。"
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-50">配置说明</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              模型由系统管理员统一配置。API Key 不会保存在浏览器，也不会向普通用户展示。
              当前如果没有视觉模型，请继续使用“直播复盘”的手动录入流程。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/review"><SecondaryButton>去直播复盘</SecondaryButton></Link>
              <Link href="/prepare"><SecondaryButton>去开播准备</SecondaryButton></Link>
              {isAdmin ? <Link href="/admin/models"><SecondaryButton>进入管理员模型配置</SecondaryButton></Link> : null}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-brand/15 text-brand" : "bg-amber-500/15 text-amber-200"}`}>
      {ok ? "可用" : "未配置"}
    </span>
  );
}
