import { NextResponse } from "next/server";
import { writeAdminAudit } from "@/lib/admin/audit";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, context: { params: Promise<{ messageId: string }> }) {
  try {
    const adminUser = await assertAdminRequest(request);
    const { messageId } = await context.params;
    const status = String((await request.json()).status || "");
    if (!["unread", "read", "resolved"].includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("developer_messages").update({ status }).eq("id", messageId).select("user_id").single();
    if (error) throw error;
    await writeAdminAudit(admin, { adminUserId: adminUser.id, targetUserId: data.user_id, action: "developer_message.status_update", entityType: "developer_message", entityId: messageId, metadata: { status } });
    return NextResponse.json({ ok: true });
  } catch (error) { return adminRouteError(error); }
}
