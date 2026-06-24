"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { API_BASE, apiFetch, saveAuth } from "@/lib/api";
import { PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type AuthResponse = { access_token: string; user: { id: number; name: string } };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [inviteCode, setInviteCode] = useState("BETA2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ok" | "offline">("checking");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/health`)
      .then((response) => {
        if (active) setServiceStatus(response.ok ? "ok" : "offline");
      })
      .catch(() => {
        if (active) setServiceStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (loading) return;
    if (!phone.trim()) {
      setError("请先填写手机号。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) {
        setError("请填写你的称呼。");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致。");
        return;
      }
      if (!acceptedTerms) {
        setError("请先阅读并同意服务条款和隐私说明。");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { phone, password } : { phone, name, password, invite_code: inviteCode };
      const data = await apiFetch<AuthResponse>(path, { method: "POST", body: JSON.stringify(body) });
      saveAuth(data.access_token, data.user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-soft px-4 py-8">
      <div className="glass-panel w-full max-w-md rounded-[24px] p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-[#061016] shadow-glow">
            <Bot />
          </div>
          <div>
            <h1 className="text-xl font-bold">LivePilot</h1>
            <p className="text-sm text-slate-500">第一次使用也能独立完成复盘</p>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "login" ? "brand-gradient text-[#061016]" : "text-slate-400"}`} onClick={() => setMode("login")}>
            登录
          </button>
          <button className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === "register" ? "brand-gradient text-[#061016]" : "text-slate-400"}`} onClick={() => setMode("register")}>
            邀请码注册
          </button>
        </div>
        <div className="space-y-3">
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="手机号" value={phone} onChange={(event) => setPhone(event.target.value)} />
          {mode === "register" ? <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="你的称呼" value={name} onChange={(event) => setName(event.target.value)} /> : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="密码，至少 6 位" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-semibold text-slate-300" type="button" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>
          {mode === "register" ? <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="再次输入密码" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /> : null}
          {mode === "register" ? <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} /> : null}
        </div>
        {mode === "register" ? (
          <label className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
            <input className="mt-0.5" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span>
              我已了解 LivePilot 会处理我填写的直播运营数据，并同意
              <a className="mx-1 font-semibold text-brand" href="/terms" target="_blank">服务条款</a>
              和
              <a className="mx-1 font-semibold text-brand" href="/privacy" target="_blank">隐私说明</a>
              。邮箱验证和密码找回功能正在完善中。
            </span>
          </label>
        ) : null}
        {process.env.NODE_ENV === "development" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-500">
            后台连接：{serviceStatus === "checking" ? "检查中" : serviceStatus === "ok" ? "正常" : "暂时无法连接"} · {API_BASE}
          </div>
        ) : null}
        {error ? <div className="mt-4"><StatusMessage type="error" text={error} onRetry={submit} /></div> : null}
        <div className="mt-6 flex gap-3">
          <PrimaryButton disabled={loading} onClick={submit} className="flex-1">
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册并进入"}
          </PrimaryButton>
          <SecondaryButton onClick={() => router.push("/")}>稍后</SecondaryButton>
        </div>
      </div>
    </main>
  );
}
