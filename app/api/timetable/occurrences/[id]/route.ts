import { mutationResponse } from "@/lib/realtime";
import { getTimetableService } from "@/lib/services/timetable-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const occurrence = getTimetableService().updateCourseOccurrence(id, body.patch ?? body, body.scope || "single");
  if (!occurrence) return Response.json({ error: "Course occurrence not found" }, { status: 404 });
  return mutationResponse(occurrence, 200, "timetable", "update-occurrence");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const occurrence = getTimetableService().cancelCourseOccurrence(id, url.searchParams.get("scope") || "single");
  if (!occurrence) return Response.json({ error: "Course occurrence not found" }, { status: 404 });
  return mutationResponse(occurrence, 200, "timetable", "cancel-occurrence");
}
