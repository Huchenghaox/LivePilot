export function PageTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-brand">
        Beta 截图复盘
      </div>
      <h1 className="text-2xl font-bold tracking-normal text-ink md:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-panel rounded-[var(--radius-card)] p-5 ${className}`}>{children}</section>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`focus-ring brand-gradient min-h-11 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016] shadow-glow hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-45 ${props.className || ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`focus-ring min-h-11 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-brand/60 hover:bg-white/[0.08] disabled:opacity-45 ${props.className || ""}`}
    />
  );
}

export function StatusMessage({ type, text, onRetry }: { type: "empty" | "loading" | "error" | "success" | "warning"; text: string; onRetry?: () => void }) {
  const color = type === "error"
    ? "border-red-400/25 bg-red-500/10 text-red-200"
    : type === "success"
      ? "border-brand/25 bg-brand/10 text-brand"
      : type === "warning"
        ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
      : type === "loading"
        ? "border-brand/20 bg-brand/10 text-brand"
        : "border-white/10 bg-white/[0.045] text-slate-400";
  return (
    <div className={`rounded-2xl border p-4 text-sm leading-6 ${color}`}>
      <div>{text}</div>
      {onRetry ? (
        <button className="mt-3 rounded-md border border-current px-3 py-1 text-xs font-semibold" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}
