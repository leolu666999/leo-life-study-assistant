import { mutationResponse } from "@/lib/realtime";
import { getTodoService } from "@/lib/services/todo-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const todoList = getTodoService().updateTodoList(id, body);
  if (!todoList) return Response.json({ error: "To Do List not found" }, { status: 404 });
  return mutationResponse(todoList, 200, "todo-lists", "update");
}
