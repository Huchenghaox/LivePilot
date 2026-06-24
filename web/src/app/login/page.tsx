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
            <h1 className="text-xl font-bold">AI直播运营助手</h1>
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
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="密码，至少 6 位" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {mode === "register" ? <input className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} /> : null}
        </div>
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
