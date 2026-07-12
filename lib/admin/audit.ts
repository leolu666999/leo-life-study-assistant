import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAdminAudit(client: SupabaseClient, input: {
  adminUserId: string; targetUserId?: string | null; action: string; entityType?: string | null; entityId?: string | null;
  metadata?: Record<string, unknown>; result?: "started" | "succeeded" | "failed";
}) {
  const { error } = await client.from("admin_audit_logs").insert({
    admin_user_id: input.adminUserId, target_user_id: input.targetUserId || null, action: input.action,
    entity_type: input.entityType || null, entity_id: input.entityId || null, metadata: input.metadata || {}, result: input.result || "succeeded"
  });
  if (error) throw error;
}
