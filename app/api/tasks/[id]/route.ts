import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const task = await getTaskService().updateTask(id, body, repositoryContext);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return mutationResponse(task, 200, "tasks", "update");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  await getTaskService().deleteTask(id, repositoryContext);
  return mutationResponse({ ok: true }, 200, "tasks", "delete");
}
