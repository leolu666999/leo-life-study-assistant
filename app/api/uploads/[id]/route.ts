import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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
