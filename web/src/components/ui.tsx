export function PageTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 inline-flex rounded-full border border-black/10 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm">
        LivePilot
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[32px] md:leading-tight">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-panel rounded-[var(--radius-card)] p-4 md:p-5 ${className}`}>{children}</section>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`focus-ring min-h-10 rounded-[var(--radius-control)] bg-[linear-gradient(135deg,#151312,#3b2b32)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-45 ${props.className || ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`focus-ring min-h-10 rounded-[var(--radius-control)] border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-45 ${props.className || ""}`}
    />
  );
}

export function StatusMessage({ type, text, onRetry }: { type: "empty" | "loading" | "error" | "success" | "warning"; text: string; onRetry?: () => void }) {
  const color = type === "error"
    ? "border-red-400/25 bg-red-500/10 text-red-200"
    : type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : type === "warning"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
      : type === "loading"
        ? "border-black/10 bg-white text-slate-600"
        : "border-black/10 bg-white text-slate-500";
  return (
    <div className={`rounded-2xl border p-4 text-sm leading-6 shadow-sm ${color}`}>
      <div>{text}</div>
      {onRetry ? (
        <button className="mt-3 rounded-md border border-current px-3 py-1 text-xs font-semibold" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}
