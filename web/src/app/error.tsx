"use client";

import { Card, PageTitle, PrimaryButton, SecondaryButton } from "@/components/ui";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <PageTitle title="服务暂时异常" desc="页面没有正常打开，你可以重试一次，或稍后再回来。" />
      <Card>
        <p className="text-sm text-slate-600">如果正在生成报告，任务通常会继续保留。重试后仍失败，可以回到直播复盘页面查看状态。</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton onClick={reset}>重试</PrimaryButton>
          <SecondaryButton onClick={() => { window.location.href = "/review"; }}>查看直播复盘</SecondaryButton>
        </div>
      </Card>
    </>
  );
}
