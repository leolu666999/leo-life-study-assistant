import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeRedirectPath } from "@/lib/auth/redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeRedirectPath((await searchParams).next);
  return (
    <AuthShell title="登录" subtitle="登录后继续使用你的 MyAssist 数据空间。" footer={<>还没有账号？ <Link href="/register" className="font-medium text-slate-950">注册</Link></>}>
      <AuthForm mode="login" nextPath={nextPath} />
    </AuthShell>
  );
}
