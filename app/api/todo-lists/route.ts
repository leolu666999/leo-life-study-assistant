import { mutationResponse } from "@/lib/realtime";
import { getTodoService } from "@/lib/services/todo-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTodoService().listTodoLists(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getTodoService().createTodoList(body, context), { status: 201 }, "todo-lists", "create");
}
