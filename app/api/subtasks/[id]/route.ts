import { setSubtaskCompleted } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const subtask = setSubtaskCompleted(id, Boolean(body.completed));
  if (!subtask) return Response.json({ error: "Checklist item not found" }, { status: 404 });
  return Response.json(subtask);
}
