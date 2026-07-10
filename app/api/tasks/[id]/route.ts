import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const task = getTaskService().updateTask(id, body);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return mutationResponse(task, 200, "tasks", "update");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  getTaskService().deleteTask(id);
  return mutationResponse({ ok: true }, 200, "tasks", "delete");
}
