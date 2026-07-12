import { mutationResponse } from "@/lib/realtime";
import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const importantFile = await getFileService().updateImportantFile(id, body, repositoryContext);
  if (!importantFile) return Response.json({ error: "Important file not found" }, { status: 404 });
  return mutationResponse(importantFile, 200, "important-files", "update");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  await getFileService().deleteImportantFile(id, repositoryContext);
  return mutationResponse({ ok: true }, 200, "important-files", "delete");
}
