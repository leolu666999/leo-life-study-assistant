import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="重置密码" subtitle="输入注册邮箱，我们会发送安全的密码重置链接。" footer={<Link href="/login" className="font-medium text-slate-950">返回登录</Link>}>
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
