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
      <PageTitle title="AI 助手状态" desc="查看 LivePilot 是否可以生成方案、读取截图和输出报告。普通用户不需要配置技术参数。" />
      {loading ? <StatusMessage type="loading" text="正在读取AI能力状态..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {!loading && !error ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-50">方案与报告生成</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">用于开播方案、复盘报告、标题、话术和总结分析。</p>
              </div>
              <StatusPill ok={Boolean(status?.text_model_configured)} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              {status?.text_model_configured ? (
                <>当前可用：<span className="font-semibold text-brand">{status.text_model_name || "已配置"}</span></>
              ) : (
                "当前暂时不能生成开播方案和复盘报告，请联系管理员检查 AI 助手。"
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-50">截图自动读取</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">用于读取直播后台截图。暂不可用时，手动补充数据和生成报告仍可继续。</p>
              </div>
              <StatusPill ok={Boolean(status?.image_model_configured)} />
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              {status?.image_model_configured ? (
                <>当前可用：<span className="font-semibold text-brand">{status.image_model_name || "已配置"}</span></>
              ) : (
                status?.image_model_message || "截图自动读取暂不可用。上传截图后可继续手动确认和填写关键数据。"
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-50">使用说明</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              AI 能力由系统管理员维护。你只需要正常上传截图、补充数据和生成报告。
              如果截图自动读取暂不可用，请继续使用“直播复盘”的手动补充流程。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/review"><SecondaryButton>去直播复盘</SecondaryButton></Link>
              <Link href="/prepare"><SecondaryButton>去开播准备</SecondaryButton></Link>
              {isAdmin ? <Link href="/admin/models"><SecondaryButton>进入系统管理</SecondaryButton></Link> : null}
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
