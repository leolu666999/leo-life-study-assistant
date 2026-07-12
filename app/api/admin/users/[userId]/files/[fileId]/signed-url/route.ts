import { NextResponse } from "next/server";
import { adminRouteError } from "@/lib/admin/admin-route";
import { assertAdminRequest, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ userId: string; fileId: string }> }) {
  try {
    await assertAdminRequest(request);
    const { userId, fileId } = await context.params;
    const admin = createSupabaseAdminClient();
    const { data: file, error } = await admin.from("uploaded_files").select("bucket,object_path,originalName").eq("user_id", userId).eq("id", fileId).maybeSingle();
    if (error) throw error;
    if (!file?.bucket || !file.object_path) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const { data, error: signedError } = await admin.storage.from(file.bucket).createSignedUrl(file.object_path, 60, { download: file.originalName });
    if (signedError) throw signedError;
    return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
  } catch (error) { return adminRouteError(error); }
}
