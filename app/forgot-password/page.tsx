import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="找回密码" subtitle="通过注册邮箱接收安全的密码重置链接。" footer={<div className="flex justify-center gap-4"><Link href="/contact-developer" className="font-medium text-slate-950">联系开发者</Link><Link href="/login" className="font-medium text-slate-950">返回登录</Link></div>}>
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
