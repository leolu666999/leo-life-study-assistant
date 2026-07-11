import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="设置新密码" subtitle="密码重置链接验证成功后，可在这里设置新密码。" footer={<Link href="/login" className="font-medium text-slate-950">返回登录</Link>}>
      <AuthForm mode="reset" />
    </AuthShell>
  );
}
