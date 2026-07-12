import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell title="创建 MyAssist 账号" subtitle="设置唯一用户名，并使用邮箱和密码创建你的个人空间。" footer={<>已有账号？ <Link href="/login" className="font-medium text-slate-950">登录</Link></>}>
      <AuthForm mode="register" />
    </AuthShell>
  );
}
