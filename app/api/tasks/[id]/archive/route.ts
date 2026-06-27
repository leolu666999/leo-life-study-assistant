import { setTaskStatus } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = setTaskStatus(id, "archived");
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return Response.json(task);
}
