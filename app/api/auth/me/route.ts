import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { authenticatedRequestUser, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (process.env.AUTH_REQUIRED !== "true") {
    return NextResponse.json({ authRequired: false, user: null, isAdmin: false });
  }
  const user = await authenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data: profile } = await createSupabaseAdminClient().from("profiles").select("username").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({
    authRequired: true,
    user: { id: user.id, email: user.email ?? null, username: profile?.username ?? null },
    isAdmin: isAdmin(user)
  });
}
