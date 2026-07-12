import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier = String(body.identifier || "").trim();
  const password = String(body.password || "");
  if (!identifier || !password) return NextResponse.json({ error: "请输入用户名或邮箱和密码。" }, { status: 400 });

  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: profile, error } = await createSupabaseAdminClient()
      .from("profiles")
      .select("user_id")
      .ilike("username", identifier)
      .maybeSingle();
    if (error || !profile) return NextResponse.json({ error: "用户名或密码不正确。" }, { status: 401 });
    const { data, error: userError } = await createSupabaseAdminClient().auth.admin.getUserById(String(profile.user_id));
    if (userError || !data.user.email) return NextResponse.json({ error: "用户名或密码不正确。" }, { status: 401 });
    email = data.user.email;
  }

  const { error } = await (await createSupabaseServerClient()).auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: "用户名、邮箱或密码不正确。" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
