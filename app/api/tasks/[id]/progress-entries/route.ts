import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  return Response.json(await getTaskService().listProgressEntries(id, repositoryContext));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const task = await getTaskService().addProgressEntry(id, body, repositoryContext);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return mutationResponse(task, { status: 201 }, "progress", "entry-create");
}
