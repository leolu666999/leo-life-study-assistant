import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await assertAdminRequest(request);
    const { data, error } = await createSupabaseAdminClient().from("developer_messages").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ messages: data });
  } catch (error) { return adminRouteError(error); }
}
