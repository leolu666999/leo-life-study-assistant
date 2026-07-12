import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await assertAdminRequest(request);
    const admin = createSupabaseAdminClient();
    const query = new URL(request.url).searchParams.get("q")?.toLowerCase().trim() || "";
    const { data: authData, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const ids = authData.users.map((user) => user.id);
    const { data: profiles } = ids.length ? await admin.from("profiles").select("user_id,username,display_name").in("user_id", ids) : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
    const users = authData.users.map((user) => ({
      id: user.id, email: user.email || null, username: profileMap.get(user.id)?.username || null,
      createdAt: user.created_at, lastSignInAt: user.last_sign_in_at || null
    })).filter((user) => !query || `${user.username || ""} ${user.email || ""}`.toLowerCase().includes(query));
    return NextResponse.json({ users });
  } catch (error) { return adminRouteError(error); }
}
