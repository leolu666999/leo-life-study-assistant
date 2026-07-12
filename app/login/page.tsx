import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeRedirectPath } from "@/lib/auth/redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeRedirectPath((await searchParams).next);
  return (
    <AuthShell title="登录 MyAssist" subtitle="使用用户名或邮箱登录你的个人空间。" footer={<>还没有账号？ <Link href="/register" className="font-medium text-slate-950">创建账号</Link></>}>
      <AuthForm mode="login" nextPath={nextPath} />
    </AuthShell>
  );
}
