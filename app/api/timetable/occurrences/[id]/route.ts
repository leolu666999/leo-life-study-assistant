import { mutationResponse } from "@/lib/realtime";
import { getTimetableService } from "@/lib/services/timetable-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const occurrence = await getTimetableService().updateCourseOccurrence(id, body.patch ?? body, body.scope || "single", repositoryContext);
  if (!occurrence) return Response.json({ error: "Course occurrence not found" }, { status: 404 });
  return mutationResponse(occurrence, 200, "timetable", "update-occurrence");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const repositoryContext = await repositoryContextForRequest(request);
  const occurrence = await getTimetableService().cancelCourseOccurrence(id, url.searchParams.get("scope") || "single", repositoryContext);
  if (!occurrence) return Response.json({ error: "Course occurrence not found" }, { status: 404 });
  return mutationResponse(occurrence, 200, "timetable", "cancel-occurrence");
}
