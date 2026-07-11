import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    await assertAdminRequest(request);
    const { userId } = await context.params;
    if (!uuidPattern.test(userId)) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const { data, error } = await createSupabaseAdminClient()
      .from("tasks")
      .select("id,user_id,title,type,status,priority,startDate,dueDate,createdAt,updatedAt")
      .eq("user_id", userId)
      .order("createdAt", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ tasks: data });
  } catch (error) {
    return adminRouteError(error);
  }
}
