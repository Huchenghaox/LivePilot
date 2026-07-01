export function PageTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-8">
      <div className="mb-3 inline-flex rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
        LivePilot Beta
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-500">{desc}</p>
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
      className={`focus-ring min-h-11 rounded-[var(--radius-control)] bg-[#202123] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-45 ${props.className || ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type || "button"}
      className={`focus-ring min-h-11 rounded-[var(--radius-control)] border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-45 ${props.className || ""}`}
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
