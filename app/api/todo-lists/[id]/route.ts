import { updateTodoList } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const todoList = updateTodoList(id, body);
  if (!todoList) return Response.json({ error: "To Do List not found" }, { status: 404 });
  return mutationResponse(todoList, 200, "todo-lists", "update");
}
