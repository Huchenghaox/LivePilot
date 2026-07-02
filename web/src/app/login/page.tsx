"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Eye, EyeOff, KeyRound, MessageSquareText, UserRound } from "lucide-react";
import { API_BASE, apiFetch, saveAuth } from "@/lib/api";
import { PrimaryButton, SecondaryButton, StatusMessage } from "@/components/ui";

type AuthResponse = { access_token: string; user: { id: number; name: string; username: string } };
type RegistrationMode = { mode: "closed" | "invite" | "open"; sms_enabled: boolean };
type SmsSendResponse = { ok: boolean; message: string; phone_masked?: string; debug_code?: string };

const usernameHint = "4-32位，首位英文字母，只能包含字母、数字和下划线";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<"login" | "register" | "reset">("login");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>({ mode: "invite", sms_enabled: false });
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [debugCode, setDebugCode] = useState("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetAccount, setResetAccount] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${API_BASE}/api/health`).then((response) => response.ok),
      fetch(`${API_BASE}/api/auth/registration-mode`).then((response) => response.json() as Promise<RegistrationMode>)
    ])
      .then(([ok, mode]) => {
        if (!active) return;
        setServiceStatus(ok ? "ok" : "offline");
        setRegistrationMode(mode);
      })
      .catch(() => {
        if (active) setServiceStatus("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!countdown) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const passwordStrength = useMemo(() => {
    const value = view === "reset" ? resetPassword : password;
    if (!value) return "";
    if (value.length < 6) return "密码太短";
    if (value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value)) return "强度较好";
    return "可用，建议包含字母和数字";
  }, [password, resetPassword, view]);

  function resetAlerts() {
    setError("");
    setMessage("");
    setDebugCode("");
  }

  function switchView(next: "login" | "register" | "reset") {
    resetAlerts();
    setView(next);
  }

  async function sendRegisterCode() {
    resetAlerts();
    if (!phone.trim()) {
      setError("请先填写手机号。");
      return;
    }
    setSendingCode(true);
    try {
      const result = await apiFetch<SmsSendResponse>("/api/auth/sms/send", {
        method: "POST",
        body: JSON.stringify({ phone, purpose: "register" })
      });
      setMessage(result.message || `验证码已发送到 ${result.phone_masked || "绑定手机号"}。`);
      setDebugCode(result.debug_code || "");
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败，请稍后重试。");
    } finally {
      setSendingCode(false);
    }
  }

  async function submitLogin() {
    resetAlerts();
    if (!loginUsername.trim()) {
      setError("请填写用户名。");
      return;
    }
    if (!loginPassword) {
      setError("请填写密码。");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      saveAuth(data.access_token, data.user);
      setLoginPassword("");
      router.push("/");
    } catch (err) {
      setLoginPassword("");
      setError(err instanceof Error ? err.message : "登录失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister() {
    resetAlerts();
    if (registrationMode.mode === "closed") {
      setError("当前暂未开放注册。");
      return;
    }
    if (!phone.trim() || !smsCode.trim()) {
      setError("请填写手机号和短信验证码。");
      return;
    }
    if (!username.trim()) {
      setError("请设置用户名。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }
    if (registrationMode.mode === "invite" && !inviteCode.trim()) {
      setError("当前为邀请注册，请填写邀请码。");
      return;
    }
    if (!acceptedTerms) {
      setError("请先阅读并同意服务条款和隐私政策。");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          phone,
          sms_code: smsCode,
          username,
          nickname,
          password,
          confirm_password: confirmPassword,
          invite_code: inviteCode,
          accepted_terms: acceptedTerms
        })
      });
      saveAuth(data.access_token, data.user);
      setPassword("");
      setConfirmPassword("");
      setSmsCode("");
      router.push("/");
    } catch (err) {
      setPassword("");
      setConfirmPassword("");
      setSmsCode("");
      setError(err instanceof Error ? err.message : "注册失败，请检查后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function startReset() {
    resetAlerts();
    if (!resetAccount.trim()) {
      setError("请填写用户名或绑定手机号。");
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<SmsSendResponse>("/api/auth/password-reset/start", {
        method: "POST",
        body: JSON.stringify({ account: resetAccount })
      });
      setMessage(result.message || "如果账号存在，验证码会发送到绑定手机号。");
      setDebugCode(result.debug_code || "");
      setCountdown(60);
      setResetStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法发送验证码，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function finishReset() {
    resetAlerts();
    if (!resetCode.trim()) {
      setError("请填写短信验证码。");
      return;
    }
    if (resetPassword.length < 6) {
      setError("新密码至少需要 6 位。");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({
          account: resetAccount,
          sms_code: resetCode,
          new_password: resetPassword,
          confirm_password: resetConfirmPassword
        })
      });
      setMessage(result.message || "密码已修改，请重新登录。");
      setResetStep(3);
      setResetCode("");
      setResetPassword("");
      setResetConfirmPassword("");
    } catch (err) {
      setResetPassword("");
      setResetConfirmPassword("");
      setError(err instanceof Error ? err.message : "密码重置失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  const codeButtonLabel = countdown ? `${countdown}s后重发` : sendingCode ? "发送中..." : "获取验证码";

  return (
    <main className="grid min-h-screen place-items-center bg-soft px-4 py-8">
      <div className="glass-panel w-full max-w-lg rounded-[24px] p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-[#061016] shadow-glow">
            <Bot />
          </div>
          <div>
            <h1 className="text-xl font-bold">LivePilot</h1>
            <p className="text-sm text-slate-500">直播准备、复盘和持续优化助手</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button type="button" className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "login" ? "brand-gradient text-[#061016]" : "text-slate-400"}`} onClick={() => switchView("login")}>
            登录
          </button>
          <button type="button" className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "register" ? "brand-gradient text-[#061016]" : "text-slate-400"}`} onClick={() => switchView("register")}>
            注册
          </button>
          <button type="button" className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === "reset" ? "brand-gradient text-[#061016]" : "text-slate-400"}`} onClick={() => switchView("reset")}>
            找回密码
          </button>
        </div>

        {view === "login" ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitLogin(); }}>
            <div className="rounded-2xl border border-brand/20 bg-brand/10 p-3 text-sm text-brand">
              使用用户名和密码登录。手机号只用于注册验证和找回密码。
            </div>
            <Field icon={<UserRound size={18} />} label="用户名">
              <input className="w-full bg-transparent outline-none" autoComplete="username" placeholder="例如 livepilot_user" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} />
            </Field>
            <PasswordField value={loginPassword} onChange={setLoginPassword} show={showPassword} setShow={setShowPassword} autoComplete="current-password" />
            <PrimaryButton type="submit" disabled={loading} className="w-full">
              {loading ? "登录中..." : "登录"}
            </PrimaryButton>
          </form>
        ) : null}

        {view === "register" ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitRegister(); }}>
            {registrationMode.mode === "closed" ? (
              <StatusMessage type="warning" text="当前暂未开放注册。你可以稍后再试，或联系管理员获取开放时间。" />
            ) : (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-400">
                  注册需要先验证手机号。之后日常登录只使用用户名和密码。
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_132px]">
                  <Field icon={<MessageSquareText size={18} />} label="手机号">
                    <input className="w-full bg-transparent outline-none" inputMode="tel" type="tel" autoComplete="tel" placeholder="13812345678" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </Field>
                  <SecondaryButton disabled={sendingCode || countdown > 0} onClick={sendRegisterCode} className="h-full min-h-[52px]">
                    {codeButtonLabel}
                  </SecondaryButton>
                </div>
                <Field label="短信验证码">
                  <input className="w-full bg-transparent outline-none" inputMode="numeric" autoComplete="one-time-code" placeholder="6位数字" value={smsCode} onChange={(event) => setSmsCode(event.target.value)} />
                </Field>
                <Field label="用户名">
                  <input className="w-full bg-transparent outline-none" autoComplete="username" placeholder="首位字母，例如 anchor_01" value={username} onChange={(event) => setUsername(event.target.value)} />
                </Field>
                <p className="text-xs text-slate-500">{usernameHint}</p>
                <Field label="昵称（选填）">
                  <input className="w-full bg-transparent outline-none" placeholder="主播或运营称呼，不公开手机号" value={nickname} onChange={(event) => setNickname(event.target.value)} />
                </Field>
                <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" />
                {passwordStrength ? <p className="text-xs text-slate-500">密码提示：{passwordStrength}</p> : null}
                <Field label="确认密码">
                  <input className="w-full bg-transparent outline-none" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="再次输入密码" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                </Field>
                {registrationMode.mode === "invite" ? (
                  <Field icon={<KeyRound size={18} />} label="邀请码">
                    <input className="w-full bg-transparent outline-none" placeholder="请输入邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
                  </Field>
                ) : null}
                <label className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
                  <input className="mt-0.5" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                  <span>
                    我已了解 LivePilot 会处理我填写的直播运营数据，并同意
                    <Link className="mx-1 font-semibold text-brand" href="/terms" target="_blank">服务条款</Link>
                    和
                    <Link className="mx-1 font-semibold text-brand" href="/privacy" target="_blank">隐私政策</Link>
                    。
                  </span>
                </label>
                <PrimaryButton type="submit" disabled={loading} className="w-full">
                  {loading ? "注册中..." : "注册并进入"}
                </PrimaryButton>
              </>
            )}
          </form>
        ) : null}

        {view === "reset" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (resetStep === 1) void startReset();
              if (resetStep === 2) void finishReset();
            }}
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-400">
              找回密码会向绑定手机号发送验证码。为了保护账号安全，页面不会提示账号是否存在。
            </div>
            <div className="flex gap-2 text-xs text-slate-500">
              {["确认账号", "手机验证", "完成"].map((item, index) => (
                <div key={item} className={`flex-1 rounded-full px-3 py-1 text-center ${resetStep >= index + 1 ? "bg-brand/20 text-brand" : "bg-white/[0.04]"}`}>{item}</div>
              ))}
            </div>
            {resetStep === 1 ? (
              <>
                <Field label="用户名或绑定手机号">
                  <input className="w-full bg-transparent outline-none" placeholder="输入用户名或手机号" value={resetAccount} onChange={(event) => setResetAccount(event.target.value)} />
                </Field>
                <PrimaryButton type="submit" disabled={loading} className="w-full">
                  {loading ? "发送中..." : "发送验证码"}
                </PrimaryButton>
              </>
            ) : null}
            {resetStep === 2 ? (
              <>
                <Field label="短信验证码">
                  <input className="w-full bg-transparent outline-none" inputMode="numeric" autoComplete="one-time-code" placeholder="6位数字" value={resetCode} onChange={(event) => setResetCode(event.target.value)} />
                </Field>
                <PasswordField value={resetPassword} onChange={setResetPassword} show={showPassword} setShow={setShowPassword} autoComplete="new-password" label="新密码" />
                {passwordStrength ? <p className="text-xs text-slate-500">密码提示：{passwordStrength}</p> : null}
                <Field label="确认新密码">
                  <input className="w-full bg-transparent outline-none" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="再次输入新密码" value={resetConfirmPassword} onChange={(event) => setResetConfirmPassword(event.target.value)} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SecondaryButton onClick={() => setResetStep(1)}>返回修改账号</SecondaryButton>
                  <PrimaryButton type="submit" disabled={loading}>{loading ? "修改中..." : "确认修改密码"}</PrimaryButton>
                </div>
              </>
            ) : null}
            {resetStep === 3 ? (
              <PrimaryButton onClick={() => { setView("login"); setResetStep(1); }} className="w-full">返回登录</PrimaryButton>
            ) : null}
          </form>
        ) : null}

        {process.env.NODE_ENV === "development" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-500">
            服务状态：{serviceStatus === "checking" ? "检查中" : serviceStatus === "ok" ? "正常" : "暂时无法连接"}
            {debugCode ? <span className="ml-2 text-amber-300">开发验证码：{debugCode}</span> : null}
          </div>
        ) : null}
        {message ? <div className="mt-4"><StatusMessage type="success" text={message} /></div> : null}
        {error ? <div className="mt-4"><StatusMessage type="error" text={error} /></div> : null}
      </div>
    </main>
  );
}

function Field({ children, icon, label }: { children: ReactNode; icon?: ReactNode; label: string }) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 focus-within:border-brand/60">
      <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  setShow,
  autoComplete,
  label = "密码"
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  autoComplete: string;
  label?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_88px]">
      <Field icon={<KeyRound size={18} />} label={label}>
        <input className="w-full bg-transparent outline-none" type={show ? "text" : "password"} autoComplete={autoComplete} placeholder="至少6位" value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
      <SecondaryButton onClick={() => setShow(!show)} className="min-h-[52px]" aria-label={show ? "隐藏密码" : "显示密码"}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
        {show ? "隐藏" : "显示"}
      </SecondaryButton>
    </div>
  );
}
