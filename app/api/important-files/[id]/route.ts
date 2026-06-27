import { deleteImportantFile, updateImportantFile } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const importantFile = updateImportantFile(id, body);
  if (!importantFile) return Response.json({ error: "Important file not found" }, { status: 404 });
  return Response.json(importantFile);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteImportantFile(id);
  return Response.json({ ok: true });
}
