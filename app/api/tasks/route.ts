import { createTask, listTasks } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listTasks());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createTask(body), { status: 201 });
}
