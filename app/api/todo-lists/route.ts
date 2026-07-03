import { createTodoList, listTodoLists } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listTodoLists());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createTodoList(body), { status: 201 }, "todo-lists", "create");
}
