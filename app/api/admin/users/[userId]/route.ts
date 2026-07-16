import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

const tables = {
  tasks: "tasks",
  todo: "todo_lists",
  expenses: "expenses",
  journal: "journal_entries",
  timetableCourses: "timetable_courses",
  timetable: "course_occurrences",
  importantFiles: "important_files",
  files: "uploaded_files",
  documents: "secure_documents"
} as const;
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    await assertAdminRequest(request);
    const { userId } = await context.params;
    const admin = createSupabaseAdminClient();
    const [{ data: authData, error }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId), admin.from("profiles").select("username,display_name,created_at").eq("user_id", userId).maybeSingle()
    ]);
    if (error || !authData.user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const counts: Record<string, number> = {};
    await Promise.all(Object.entries(tables).map(async ([key, table]) => {
      const { count, error: countError } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
      if (countError) throw countError; counts[key] = count || 0;
    }));
    return NextResponse.json({ user: { id: userId, email: authData.user.email, username: profile?.username || null,
      createdAt: authData.user.created_at, lastSignInAt: authData.user.last_sign_in_at || null }, counts });
  } catch (error) { return adminRouteError(error); }
}
