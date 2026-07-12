import { mutationResponse } from "@/lib/realtime";
import { getFileService } from "@/lib/services/file-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getFileService().listImportantFiles(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.fileId) return Response.json({ error: "Missing fileId" }, { status: 400 });
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getFileService().createImportantFile(body, context), { status: 201 }, "important-files", "create");
}
