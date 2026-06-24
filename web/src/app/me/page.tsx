"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageTitle, PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";
import { apiFetch, clearAuth } from "@/lib/api";

type Me = { id: number; name: string; phone: string; deletion_requested_at?: string };
type FeedbackItem = {
  id: number;
  streamer_id?: number | null;
  platform_account_id?: number | null;
  live_session_id?: number | null;
  report_id?: number | null;
  report_version_id?: number | null;
  model_name?: string;
  rule_snapshot?: unknown[];
  feedback_type: string;
  content: string;
  created_at: string;
};

export default function MePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isAdminFeedbackView, setIsAdminFeedbackView] = useState(false);
  const [feedbackType, setFeedbackType] = useState("操作遇到问题");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [meResult, feedbackResult] = await Promise.all([
        apiFetch<Me>("/api/me"),
        apiFetch<{ items: FeedbackItem[]; is_admin: boolean }>("/api/feedback")
      ]);
      setMe(meResult);
      setFeedbackItems(feedbackResult.items);
      setIsAdminFeedbackView(feedbackResult.is_admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback() {
    setError("");
    const result = await apiFetch<{ message: string }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ feedback_type: feedbackType, content: feedbackContent })
    });
    setFeedbackContent("");
    setMessage(result.message);
    await load();
  }

  async function changePassword() {
    setError("");
    const result = await apiFetch<{ message: string }>("/api/account/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
    setOldPassword("");
    setNewPassword("");
    setMessage(result.message);
  }

  async function exportData() {
    const data = await apiFetch<Record<string, unknown>>("/api/account/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "livepilot-data.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("个人数据已导出。");
  }

  async function requestDeletion() {
    if (!window.confirm("确定提交注销申请？Beta 阶段会先记录申请，由管理员处理。")) return;
    const result = await apiFetch<{ message: string }>("/api/account/deletion-request", {
      method: "POST",
      body: JSON.stringify({ reason: deletionReason })
    });
    setMessage(result.message);
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageTitle title="我的" desc="管理主播、模型、规则、反馈和账号数据。" />
      {loading ? <StatusMessage type="loading" text="正在读取账号信息..." /> : null}
      {error ? <div className="mb-4"><StatusMessage type="error" text={error} onRetry={load} /></div> : null}
      {message ? <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/streamers">
          <Card>
            <h2 className="text-lg font-bold">主播管理</h2>
            <p className="mt-2 text-sm text-slate-500">用于AI了解你的主播定位和历史表现。</p>
          </Card>
        </Link>
        <Link href="/platform-accounts">
          <Card>
            <h2 className="text-lg font-bold">平台账号</h2>
            <p className="mt-2 text-sm text-slate-500">记录或连接实际使用的抖音直播账号。</p>
          </Card>
        </Link>
        <Link href="/model-settings">
          <Card>
            <h2 className="text-lg font-bold">模型设置</h2>
            <p className="mt-2 text-sm text-slate-500">配置文字分析模型、图片识别模型和 Mock 演示。</p>
          </Card>
        </Link>
        <Link href="/rules">
          <Card>
            <h2 className="text-lg font-bold">规则与提示</h2>
            <p className="mt-2 text-sm text-slate-500">维护主播提醒、查看公共规则，让报告按最新注意事项分析。</p>
          </Card>
        </Link>
        <Card>
          <h2 className="text-lg font-bold">Beta版本说明</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">当前版本聚焦抖音后台截图复盘。音视频、实时助手、自动场控和高光剪辑为后续开放能力。</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Beta反馈</h2>
          <div className="grid gap-3">
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}>
              {["报告有帮助", "数据判断不准确", "建议太空泛", "建议不适合我的直播", "规则依据有问题", "操作遇到问题", "其他"].map((item) => <option key={item}>{item}</option>)}
            </select>
            <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="补充说明" value={feedbackContent} onChange={(event) => setFeedbackContent(event.target.value)} />
            <PrimaryButton onClick={submitFeedback}>提交反馈</PrimaryButton>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">{isAdminFeedbackView ? "最近用户反馈" : "我的反馈记录"}</h2>
          {!feedbackItems.length ? <StatusMessage type="empty" text="还没有反馈记录。" /> : null}
          <div className="space-y-2">
            {feedbackItems.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{item.feedback_type}</div>
                  <div className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString("zh-CN")}</div>
                </div>
                {item.content ? <div className="mt-2 leading-6 text-slate-600">{item.content}</div> : <div className="mt-2 text-slate-400">未填写补充说明</div>}
                <div className="mt-2 text-xs text-slate-500">
                  直播：{item.live_session_id || "无"} · 报告版本：{item.report_version_id || "无"} · 模型：{item.model_name || "未关联"}
                  {item.rule_snapshot?.length ? ` · 规则依据：${item.rule_snapshot.length}条` : ""}
                </div>
                {isAdminFeedbackView ? (
                  <div className="mt-1 text-xs text-slate-500">
                    主播：{item.streamer_id || "无"} · 平台账号：{item.platform_account_id || "无"} · 报告：{item.report_id || "无"}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">账户信息</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <div>昵称：{me?.name || "未读取"}</div>
            <div>手机号：{me?.phone || "未读取"}</div>
            {me?.deletion_requested_at ? <div className="text-amber-700">已提交注销申请：{new Date(me.deletion_requested_at).toLocaleString("zh-CN")}</div> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SecondaryButton onClick={() => { clearAuth(); window.location.href = "/login"; }}>退出登录</SecondaryButton>
            <SecondaryButton onClick={exportData}>导出个人数据</SecondaryButton>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">修改密码</h2>
          <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" placeholder="原密码" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
          <input className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" placeholder="新密码，至少6位" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <PrimaryButton disabled={!oldPassword || !newPassword} onClick={changePassword}>保存新密码</PrimaryButton>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">数据与隐私</h2>
          <p className="mb-3 text-sm leading-6 text-slate-500">截图和复盘数据只用于当前账号的分析。Beta 阶段注销账号先记录申请，由管理员处理。</p>
          <textarea className="mb-3 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="注销原因，可不填" value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} />
          <SecondaryButton onClick={requestDeletion}>申请注销账号</SecondaryButton>
        </Card>
      </div>
    </>
  );
}
