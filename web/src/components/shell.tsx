"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Home, ShieldCheck, UploadCloud, UserRound, Wand2 } from "lucide-react";
import { clearAuth } from "@/lib/api";

const nav = [
  { href: "/", label: "首页", icon: Home },
  { href: "/prepare", label: "开播准备", icon: Wand2 },
  { href: "/review", label: "直播复盘", icon: UploadCloud },
  { href: "/me", label: "我的", icon: UserRound }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = pathname === "/login";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const user = JSON.parse(window.localStorage.getItem("user") || "{}") as { role?: string };
      setIsAdmin(user.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, [pathname]);

  if (isAuth) return <>{children}</>;

  const visibleNav = isAdmin ? [...nav, { href: "/admin", label: "系统管理", icon: ShieldCheck }] : nav;

  return (
    <div className="min-h-screen bg-soft">
      <aside className="app-shell-nav fixed left-0 top-0 hidden h-full w-64 border-r border-white/10 bg-[#0f0f16]/88 px-4 py-5 backdrop-blur-xl lg:block">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-[#061016] shadow-glow">
            <Bot size={22} />
          </div>
          <div>
            <div className="font-bold text-ink">LivePilot</div>
            <div className="text-xs text-slate-500">独立工具 · Beta</div>
          </div>
        </div>
        <nav className="space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                  active ? "brand-gradient text-[#061016] shadow-glow" : "text-slate-400 hover:bg-white/[0.06] hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-500">
          LivePilot 是独立直播运营工具，与抖音官方无隶属或授权关系。
        </div>
        <button
          className="focus-ring mt-4 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-white/[0.06] hover:text-ink"
          onClick={() => {
            clearAuth();
            router.push("/login");
          }}
        >
          退出登录
        </button>
      </aside>
      <main className="pb-20 lg:ml-64">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</div>
      </main>
      <nav className="app-shell-nav fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 border-t border-white/10 bg-[#101016]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-xl lg:hidden">
        {visibleNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`rounded-xl py-2 text-center text-xs font-semibold ${active ? "bg-white/[0.08] text-brand" : "text-slate-500"}`}>
              <Icon className="mx-auto mb-1" size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
