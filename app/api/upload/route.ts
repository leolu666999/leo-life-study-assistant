import { mutationResponse } from "@/lib/realtime";
import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";
import { CLOUD_UPLOAD_MAX_BYTES } from "@/lib/storage/file-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  const context = await repositoryContextForRequest(request);
  if (context.backend === "supabase" && file.size > CLOUD_UPLOAD_MAX_BYTES) {
    return Response.json({ error: "File exceeds the 10 MB cloud upload limit" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await getFileService().saveUpload({
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    data: buffer,
    linkedEntityType: String(form.get("linkedEntityType") ?? "") || null,
    linkedEntityId: String(form.get("linkedEntityId") ?? "") || null
  }, context);

  return mutationResponse(metadata, { status: 201 }, "uploads", "create");
}
