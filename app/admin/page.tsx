import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isAdmin } from "@/lib/auth/admin";
import { currentSessionUser } from "@/lib/supabase/server";

export default async function AdminPage() {
  const user = await currentSessionUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (!isAdmin(user)) redirect("/");
  return <AdminDashboard />;
}
