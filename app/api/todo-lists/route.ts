import { createTodoList, listTodoLists } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listTodoLists());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createTodoList(body), { status: 201 });
}
