import { mutationResponse } from "@/lib/realtime";
import { getFileService } from "@/lib/services/file-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getFileService().listImportantFiles());
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.fileId) return Response.json({ error: "Missing fileId" }, { status: 400 });
  return mutationResponse(getFileService().createImportantFile(body), { status: 201 }, "important-files", "create");
}
