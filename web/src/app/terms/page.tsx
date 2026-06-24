import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";

export default function TermsPage() {
  return (
    <>
      <PageTitle title="服务条款" desc="LivePilot Beta 使用说明。本页面不是最终法律意见，正式发布前需要负责人补充主体信息。" />
      <Card>
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>LivePilot 是一个 AI 辅助直播运营工具，用于开播准备、安全提醒和直播复盘，不承诺平台流量、收入、账号安全或审核结果。</p>
          <p>请只上传或填写你有权处理的内容。不要上传平台密码、Cookie、私密 Token、身份证件、医疗记录或与直播复盘无关的敏感个人信息。</p>
          <p>AI 生成内容可能不完整或不准确，使用前需要人工判断。涉及平台规则、法律、医疗、金融等高风险内容时，应以官方规则和专业意见为准。</p>
          <p>当前产品处于 Beta 阶段，功能可能调整。部分能力需要配置模型或获得平台官方权限。</p>
          <Link className="font-semibold text-brand" href="/login">返回登录</Link>
        </div>
      </Card>
    </>
  );
}
