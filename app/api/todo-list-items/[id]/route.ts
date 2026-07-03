import { setTodoListItemCompleted } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const item = setTodoListItemCompleted(id, Boolean(body.completed));
  if (!item) return Response.json({ error: "To Do List item not found" }, { status: 404 });
  return mutationResponse(item, 200, "todo-list-items", "update");
}
