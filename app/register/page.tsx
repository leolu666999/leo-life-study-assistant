import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell title="创建账号" subtitle="使用邮箱和密码创建独立的 MyAssist 测试账号。" footer={<>已有账号？ <Link href="/login" className="font-medium text-slate-950">登录</Link></>}>
      <AuthForm mode="register" />
    </AuthShell>
  );
}
