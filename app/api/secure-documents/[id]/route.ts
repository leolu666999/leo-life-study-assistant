import { mutationResponse } from "@/lib/realtime";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";
import { getFileService } from "@/lib/services/file-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json() as Record<string, unknown>;
  if (body.title !== undefined && !String(body.title).trim()) return Response.json({ error: "请输入文档名称" }, { status: 400 });
  if (body.content !== undefined && String(body.content).length > 200000) return Response.json({ error: "文档内容超过 200,000 字符" }, { status: 400 });
  const repositoryContext = await repositoryContextForRequest(request);
  const document = await getFileService().updateSecureDocument(id, body, repositoryContext);
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
  return mutationResponse(document, 200, "secure-documents", "update");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  await getFileService().deleteSecureDocument(id, repositoryContext);
  return mutationResponse({ ok: true }, 200, "secure-documents", "delete");
}
