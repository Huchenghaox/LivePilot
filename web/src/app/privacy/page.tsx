import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";

export default function PrivacyPage() {
  return (
    <>
      <PageTitle title="隐私说明" desc="说明 LivePilot 会处理哪些数据，以及用户需要避免上传哪些敏感内容。" />
      <Card>
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>LivePilot 可能处理账号信息、主播档案、平台账号记录、开播准备输入、截图、手动填写的直播数据、复盘报告和反馈。</p>
          <p>当你配置 AI 模型后，系统会把必要的直播上下文发送给所选模型服务，用于生成方案、风险提醒和报告。请同时了解所选模型服务的隐私政策。</p>
          <p>请不要上传平台密码、Cookie、私密 Token、身份证件、医疗记录或无关的私人资料。</p>
          <p>Beta 阶段注销账号会先记录申请，由管理员处理。生产部署需要配置安全存储、备份、访问控制和删除流程。</p>
          <Link className="font-semibold text-brand" href="/login">返回登录</Link>
        </div>
      </Card>
    </>
  );
}
