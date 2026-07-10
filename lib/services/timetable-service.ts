import { parseIcsToTimetablePreview } from "@/lib/ics-timetable";
import { getTimetableRepository } from "@/lib/repositories";
import type { RepositoryContext } from "@/lib/repositories/repository-context";
import type { CourseOccurrence, TimetableImportPreview } from "@/lib/types";

export type TimetablePreviewInput = {
  icsText?: string;
  feedUrl?: string | null;
  name?: string;
  semester?: string;
  academicYear?: number;
  timezone?: string;
};

export type TimetablePreviewResult =
  | { preview: TimetableImportPreview; error?: never }
  | { preview?: never; error: string };

export class TimetableService {
  constructor(private readonly repository = getTimetableRepository()) {}

  listCourses(context?: RepositoryContext) {
    return this.repository.listCourses(context);
  }

  getTimetable(input: { from?: string; to?: string; includeCancelled?: boolean }, context?: RepositoryContext) {
    return {
      sources: this.repository.listTimetableSources(context),
      courses: this.repository.listTimetableCourses(context),
      occurrences: this.repository.listCourseOccurrences(input, context)
    };
  }

  async previewTimetable(input: TimetablePreviewInput): Promise<TimetablePreviewResult> {
    let icsText = String(input.icsText ?? "");
    const feedUrl = typeof input.feedUrl === "string" && input.feedUrl.trim() ? input.feedUrl.trim() : null;
    if (!icsText && feedUrl) {
      const response = await fetch(feedUrl, { cache: "no-store" });
      if (!response.ok) return { error: "读取 Calendar Feed 失败，请确认链接有效或需要登录权限。" };
      icsText = await response.text();
    }
    if (!icsText.trim()) return { error: "缺少 ICS 内容或 Calendar Feed URL。" };
    return {
      preview: parseIcsToTimetablePreview(icsText, {
        sourceType: feedUrl ? "calendar_feed" : "ics_file",
        name: input.name || (feedUrl ? "Calendar Feed" : "ICS 文件"),
        feedUrl,
        semester: input.semester || "Semester",
        academicYear: Number(input.academicYear || new Date().getFullYear()),
        timezone: input.timezone || "Australia/Sydney"
      })
    };
  }

  importTimetable(preview: TimetableImportPreview, context?: RepositoryContext) {
    return this.repository.importTimetablePreview(preview, context);
  }

  updateCourseOccurrence(id: string, patch: Partial<CourseOccurrence>, scope = "single", context?: RepositoryContext) {
    return this.repository.updateCourseOccurrence(id, patch, scope, context);
  }

  cancelCourseOccurrence(id: string, scope = "single", context?: RepositoryContext) {
    return this.repository.cancelCourseOccurrence(id, scope, context);
  }
}

export function getTimetableService() {
  return new TimetableService();
}
