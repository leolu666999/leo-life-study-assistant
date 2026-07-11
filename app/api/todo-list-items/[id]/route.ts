import { mutationResponse } from "@/lib/realtime";
import { getTodoService } from "@/lib/services/todo-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const item = await getTodoService().updateTodoItemCompletion(id, Boolean(body.completed), repositoryContext);
  if (!item) return Response.json({ error: "To Do List item not found" }, { status: 404 });
  return mutationResponse(item, 200, "todo-list-items", "update");
}
