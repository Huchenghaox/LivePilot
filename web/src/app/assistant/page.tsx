"use client";

import { useState } from "react";
import { Card, PageTitle, StatusMessage } from "@/components/ui";

const rescue: Record<string, string> = {
  "冷场了": "刚进来的朋友，我先用一个问题接住大家：你现在直播最卡的是没人进来，还是进来了留不住？扣 1 或 2，我按最多的先讲。",
  "来新流量了": "欢迎新来的朋友，我正在讲下一场直播怎么把人留住。你先听完这一段，马上能拿走一个开场模板。",
  "评论少了": "大家不用打很多字，直接扣数字就行：1 是开场卡住，2 是互动没人回，3 是不知道怎么引导关注。",
  "需要引导关注": "如果你想继续拿这类开播话术和复盘方法，可以先点个关注，后面我会一场一场拆给你看。",
  "连麦接不住": "我先确认一下，你最想解决的是当下这个情绪，还是下一步具体怎么做？我们先选一个讲清楚。",
  "出现敏感内容": "这个话题我们先不做判断，我换一个更安全也更有帮助的角度：具体到下一步，你可以先做什么。"
};

export default function AssistantPage() {
  const [text, setText] = useState("欢迎来到直播间。今天我们聊新手开播怎么留住刚进来的观众。");
  const [suggestion, setSuggestion] = useState("每 15 分钟重新介绍一次主题，接住刚进来的新用户。");

  return (
    <>
      <PageTitle title="实时助手" desc="用于直播中的提词、节奏提醒和快捷救场；平台操作仍由主播或场控手动完成。" />
      <div className="mb-5">
        <StatusMessage type="empty" text="实时助手属于后续阶段能力。当前可预览网页提词和快捷救场样式，但不会监听系统音频，也不会自动操作平台账号。" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">提词内容</h2>
            <div className="text-xs text-slate-500">字号 · 滚动速度 · 暂停</div>
          </div>
          <textarea className="h-80 w-full resize-none rounded-md border border-slate-300 p-4 text-xl leading-9" value={text} onChange={(event) => setText(event.target.value)} />
        </Card>
        <div className="space-y-5">
          <Card>
            <h2 className="mb-3 text-lg font-bold">AI 当前建议</h2>
            <div className="rounded-2xl border border-brand/25 bg-brand/10 p-4 text-brand">{suggestion}</div>
          </Card>
          <Card>
            <h2 className="mb-3 text-lg font-bold">快捷救场</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(rescue).map((item) => (
                <button key={item} className="rounded-xl border border-white/10 bg-white/[0.045] p-3 text-sm font-semibold text-slate-100 hover:border-brand/50" onClick={() => setSuggestion(rescue[item])}>
                  {item}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
