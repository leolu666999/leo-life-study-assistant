import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const subtask = await getTaskService().updateSubtaskCompletion(id, Boolean(body.completed), repositoryContext);
  if (!subtask) return Response.json({ error: "Checklist item not found" }, { status: 404 });
  return mutationResponse(subtask, 200, "subtasks", "update");
}
