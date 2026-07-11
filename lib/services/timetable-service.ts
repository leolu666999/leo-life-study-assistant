import { parseIcsToTimetablePreview } from "@/lib/ics-timetable";
import { fetchCalendarFeedText, validateCalendarFeedUrl } from "@/lib/calendar-feed";
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

  async getTimetable(input: { from?: string; to?: string; includeCancelled?: boolean }, context?: RepositoryContext) {
    const [sources, courses, occurrences] = await Promise.all([
      this.repository.listTimetableSources(context), this.repository.listTimetableCourses(context),
      this.repository.listCourseOccurrences(input, context)
    ]);
    return { sources, courses, occurrences };
  }

  async previewTimetable(input: TimetablePreviewInput): Promise<TimetablePreviewResult> {
    let icsText = String(input.icsText ?? "");
    const feedUrl = typeof input.feedUrl === "string" && input.feedUrl.trim() ? input.feedUrl.trim() : null;
    try {
      if (feedUrl) await validateCalendarFeedUrl(feedUrl);
      if (!icsText && feedUrl) icsText = await fetchCalendarFeedText(feedUrl);
      if (!icsText.trim()) return { error: "缺少 ICS 内容或 Calendar Feed URL。" };
      return { preview: parseIcsToTimetablePreview(icsText, {
        sourceType: feedUrl ? "calendar_feed" : "ics_file",
        name: input.name || (feedUrl ? "Calendar Feed" : "ICS 文件"),
        feedUrl,
        semester: input.semester || "Semester",
        academicYear: Number(input.academicYear || new Date().getFullYear()),
        timezone: input.timezone || "Australia/Sydney"
      }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ICS 解析失败。" };
    }
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
