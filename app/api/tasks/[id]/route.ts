import { deleteTask, updateTask } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const task = updateTask(id, body);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return Response.json(task);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteTask(id);
  return Response.json({ ok: true });
}
