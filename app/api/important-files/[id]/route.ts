import { mutationResponse } from "@/lib/realtime";
import { getFileService } from "@/lib/services/file-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const importantFile = getFileService().updateImportantFile(id, body);
  if (!importantFile) return Response.json({ error: "Important file not found" }, { status: 404 });
  return mutationResponse(importantFile, 200, "important-files", "update");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  getFileService().deleteImportantFile(id);
  return mutationResponse({ ok: true }, 200, "important-files", "delete");
}
