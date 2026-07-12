import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdmin } from "@/lib/auth/admin";
import { currentSessionUser } from "@/lib/supabase/server";

export default async function AdminPage() {
  if (process.env.AUTH_REQUIRED !== "true") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Admin Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">需要 Cloud/Auth 模式</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            当前本地模式不强制登录，也不连接 Supabase 管理端。管理员后台只在 Cloud/Auth 模式下启用，以避免本地 SQLite 数据被误当成多用户云数据。
          </p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            返回 MyAssist
          </Link>
        </section>
      </main>
    );
  }
  const user = await currentSessionUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (!isAdmin(user)) redirect("/");
  return <AdminDashboard />;
}
