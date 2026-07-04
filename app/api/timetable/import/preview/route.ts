import { parseIcsToTimetablePreview } from "@/lib/ics-timetable";

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
  const body = await bodyFromRequest(request);
  let icsText = String(body.icsText ?? "");
  const feedUrl = typeof body.feedUrl === "string" && body.feedUrl.trim() ? body.feedUrl.trim() : null;
  if (!icsText && feedUrl) {
    const response = await fetch(feedUrl, { cache: "no-store" });
    if (!response.ok) {
      return Response.json({ error: "读取 Calendar Feed 失败，请确认链接有效或需要登录权限。" }, { status: 400 });
    }
    icsText = await response.text();
  }
  if (!icsText.trim()) return Response.json({ error: "缺少 ICS 内容或 Calendar Feed URL。" }, { status: 400 });

  const preview = parseIcsToTimetablePreview(icsText, {
    sourceType: feedUrl ? "calendar_feed" : "ics_file",
    name: body.name || (feedUrl ? "Calendar Feed" : "ICS 文件"),
    feedUrl,
    semester: body.semester || "Semester",
    academicYear: Number(body.academicYear || new Date().getFullYear()),
    timezone: body.timezone || "Australia/Sydney"
  });
  return Response.json(preview);
}
