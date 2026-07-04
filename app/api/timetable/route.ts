import { listCourseOccurrences, listTimetableCourses, listTimetableSources } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json({
    sources: listTimetableSources(),
    courses: listTimetableCourses(),
    occurrences: listCourseOccurrences({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      includeCancelled: url.searchParams.get("includeCancelled") === "1"
    })
  });
}
