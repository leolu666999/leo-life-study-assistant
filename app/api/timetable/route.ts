import { getTimetableService } from "@/lib/services/timetable-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json(getTimetableService().getTimetable({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      includeCancelled: url.searchParams.get("includeCancelled") === "1"
  }));
}
