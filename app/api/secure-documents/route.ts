import { mutationResponse } from "@/lib/realtime";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";
import { getFileService } from "@/lib/services/file-service";

export const runtime = "nodejs";

function validateDocument(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "");
  if (!title) return "请输入文档名称";
  if (content.length > 200000) return "文档内容超过 200,000 字符";
  return null;
}

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getFileService().listSecureDocuments(context));
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const validationError = validateDocument(body);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getFileService().createSecureDocument(body, context), { status: 201 }, "secure-documents", "create");
}
