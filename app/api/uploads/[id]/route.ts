import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";
import { authenticatedRequestUser, createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CloudFileRow = {
  bucket: string;
  object_path: string;
  mimeType: string | null;
  originalName: string;
};

async function getCloudFile(request: Request, id: string) {
  const user = await authenticatedRequestUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("uploaded_files")
    .select("bucket,object_path,mimeType,originalName")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "uploaded")
    .maybeSingle();

  if (error) throw error;
  if (!data) return Response.json({ error: "File not found" }, { status: 404 });

  const file = data as CloudFileRow;
  const url = new URL(request.url);
  if (url.searchParams.get("signed") === "1") {
    const { data: signed, error: signedError } = await admin.storage
      .from(file.bucket)
      .createSignedUrl(file.object_path, 60);
    if (signedError) throw signedError;
    return Response.json(
      { url: signed.signedUrl, expiresIn: 60 },
      { headers: { "cache-control": "private, no-store" } }
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
      "cache-control": "private, no-store",
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
    if (!signed) return Response.json({ error: "File not found" }, { status: 404 });
    return Response.json(signed, { headers: { "cache-control": "private, no-store" } });
  }
  const file = await getFileService().readUpload(id, repositoryContext);
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  return new Response(new Uint8Array(file.data).buffer, {
    headers: {
      "content-type": file.metadata.mimeType || "application/octet-stream",
      "cache-control": "private, max-age=60"
    }
  });
}
