import { updateProgress } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const progress = updateProgress(id, body);
  if (!progress) return Response.json({ error: "Progress item not found" }, { status: 404 });
  return Response.json(progress);
}
