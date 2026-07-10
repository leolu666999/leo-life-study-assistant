import { mutationResponse } from "@/lib/realtime";
import { getTodoService } from "@/lib/services/todo-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTodoService().listTodoLists());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(getTodoService().createTodoList(body), { status: 201 }, "todo-lists", "create");
}
