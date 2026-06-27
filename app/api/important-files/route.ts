import { createImportantFile, listImportantFiles } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listImportantFiles());
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.fileId) return Response.json({ error: "Missing fileId" }, { status: 400 });
  return Response.json(createImportantFile(body), { status: 201 });
}
