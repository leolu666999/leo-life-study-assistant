import { getFileService } from "@/lib/services/file-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const file = await getFileService().readUpload(id);
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });

  return new Response(new Uint8Array(file.data).buffer, {
    headers: {
      "content-type": file.metadata.mimeType || "application/octet-stream",
      "cache-control": "private, max-age=3600"
    }
  });
}
