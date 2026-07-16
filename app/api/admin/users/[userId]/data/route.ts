import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

const allowed = {
  tasks: "tasks", todo: "todo_lists", expenses: "expenses", journal: "journal_entries",
  timetable: "course_occurrences", files: "uploaded_files", importantFiles: "important_files",
  documents: "secure_documents"
} as const;
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    await assertAdminRequest(request);
    const { userId } = await context.params;
    const type = new URL(request.url).searchParams.get("type") as keyof typeof allowed;
    const table = allowed[type];
    if (!table) return NextResponse.json({ error: "Invalid data type" }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().from(table).select("*").eq("user_id", userId).limit(200);
    if (error) throw error;
    return NextResponse.json({ type, rows: data });
  } catch (error) { return adminRouteError(error); }
}
