import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const countedTables = ["tasks", "todo_lists", "expenses", "journal_entries", "important_files", "secure_documents"] as const;

export async function GET(request: Request) {
  try {
    await assertAdminRequest(request);
    const admin = createSupabaseAdminClient();
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;

    const rowCounts: Record<string, number> = {};
    for (const table of countedTables) {
      const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      rowCounts[table] = count ?? 0;
    }

    return NextResponse.json({
      totalUsers: users.users.length,
      usersCreatedToday: 0,
      activeUsers: 0,
      apiErrors: 0,
      syncFailures: 0,
      fileAnomalies: 0,
      rowCounts
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
