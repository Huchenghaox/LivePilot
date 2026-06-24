import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <PageTitle title="页面不存在" desc="这个页面可能已经移动，或你打开的链接不正确。" />
      <Card>
        <p className="text-sm text-slate-600">你可以回到首页，继续创建主播、复盘直播或查看最近报告。</p>
        <Link className="brand-gradient mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-bold text-[#061016] shadow-glow" href="/">
          返回首页
        </Link>
      </Card>
    </>
  );
}
