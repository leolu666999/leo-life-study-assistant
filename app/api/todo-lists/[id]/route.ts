import { mutationResponse } from "@/lib/realtime";
import { getTodoService } from "@/lib/services/todo-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const todoList = await getTodoService().updateTodoList(id, body, repositoryContext);
  if (!todoList) return Response.json({ error: "To Do List not found" }, { status: 404 });
  return mutationResponse(todoList, 200, "todo-lists", "update");
}
