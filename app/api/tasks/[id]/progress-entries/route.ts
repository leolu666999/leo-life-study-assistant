import { addProgressEntry, listProgressEntries } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return Response.json(listProgressEntries(id));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const task = addProgressEntry(id, body);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return Response.json(task, { status: 201 });
}
