import { getTimetableService } from "@/lib/services/timetable-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

async function bodyFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const icsText = file instanceof File ? await file.text() : String(form.get("icsText") ?? "");
    return {
      icsText,
      feedUrl: String(form.get("feedUrl") ?? "") || null,
      name: String(form.get("name") ?? "") || undefined,
      semester: String(form.get("semester") ?? "") || undefined,
      academicYear: Number(form.get("academicYear") || new Date().getFullYear()),
      timezone: String(form.get("timezone") || "Australia/Sydney")
    };
  }
  return request.json();
}

export async function POST(request: Request) {
  await repositoryContextForRequest(request);
  const body = await bodyFromRequest(request);
  const result = await getTimetableService().previewTimetable(body);
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.preview);
}
