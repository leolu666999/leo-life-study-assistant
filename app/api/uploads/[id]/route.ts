import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";
import { authenticatedRequestUser, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "cache-control": "private, no-store, max-age=0",
  vary: "Cookie, Authorization"
};

type CloudFileRow = {
  bucket: string;
  object_path: string;
  mimeType: string | null;
  originalName: string;
};

async function getCloudFile(request: Request, id: string) {
  const user = await authenticatedRequestUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("uploaded_files")
    .select("bucket,object_path,mimeType,originalName")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "uploaded")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    console.warn("Private upload lookup missed", {
      fileId: id.slice(0, 8),
      userId: user.id.slice(0, 8),
      backend: process.env.DATA_BACKEND
    });
    return Response.json({ error: "File not found" }, { status: 404, headers: privateHeaders });
  }

  const file = data as CloudFileRow;
  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    const { data: signed, error: signedError } = await admin.storage
      .from(file.bucket)
      .createSignedUrl(file.object_path, 60);
    if (signedError) throw signedError;
    return Response.json(
      { url: signed.signedUrl, expiresIn: 60 },
      { headers: privateHeaders }
    );
  }

  const { data: blob, error: downloadError } = await admin.storage
    .from(file.bucket)
    .download(file.object_path);
  if (downloadError) throw downloadError;

  return new Response(await blob.arrayBuffer(), {
    headers: {
      "content-type": file.mimeType || blob.type || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      ...privateHeaders,
      "x-content-type-options": "nosniff"
    }
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (process.env.DATA_BACKEND === "supabase") return getCloudFile(request, id);

  const repositoryContext = await repositoryContextForRequest(request);
  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    const signed = await getFileService().createSignedDownloadUrl(id, 60, repositoryContext);
    if (!signed) return Response.json({ error: "File not found" }, { status: 404, headers: privateHeaders });
    return Response.json(signed, { headers: privateHeaders });
  }
  const file = await getFileService().readUpload(id, repositoryContext);
  if (!file) return Response.json({ error: "File not found" }, { status: 404, headers: privateHeaders });

  return new Response(new Uint8Array(file.data).buffer, {
    headers: {
      "content-type": file.metadata.mimeType || "application/octet-stream",
      ...privateHeaders
    }
  });
}
