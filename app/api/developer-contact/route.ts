import { NextResponse } from "next/server";
import { developerContact } from "@/lib/config/contact";
import { authenticatedRequestUser, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(developerContact());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message || message.length > 4000) {
    return NextResponse.json({ error: "留言内容需为 1 至 4000 个字符。" }, { status: 400 });
  }

  const user = await authenticatedRequestUser(request);
  let username: string | null = null;
  if (user) {
    const { data } = await createSupabaseAdminClient().from("profiles").select("username").eq("user_id", user.id).maybeSingle();
    username = data?.username ? String(data.username) : null;
  }
  const anonymousEmail = user ? null : String(body.email || "").trim() || null;
  if (anonymousEmail && !/^\S+@\S+\.\S+$/.test(anonymousEmail)) {
    return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
  }

  const { data, error } = await createSupabaseAdminClient().from("developer_messages").insert({
    user_id: user?.id || null,
    username,
    email: user?.email || anonymousEmail,
    message,
    status: "unread"
  }).select("id,created_at").single();
  if (error) return NextResponse.json({ error: "留言发送失败，请稍后再试。" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at }, { status: 201 });
}
