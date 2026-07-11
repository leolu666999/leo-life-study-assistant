import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = safeRedirectPath(url.searchParams.get("next"));
  if (code) {
    const { error } = await (await createSupabaseServerClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPath, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
}
