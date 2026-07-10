import type { Course, CourseOccurrence, TimetableCourse, TimetableImportPreview, TimetableSource } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type TimetableImportResult = {
  sourceId: string;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
};

export interface TimetableRepository {
  listCourses(context?: RepositoryContext): Course[];
  listTimetableSources(context?: RepositoryContext): TimetableSource[];
  listTimetableCourses(context?: RepositoryContext): TimetableCourse[];
  listCourseOccurrences(input?: { from?: string; to?: string; includeCancelled?: boolean }, context?: RepositoryContext): CourseOccurrence[];
  importTimetablePreview(preview: TimetableImportPreview, context?: RepositoryContext): TimetableImportResult;
  updateCourseOccurrence(id: string, patch: Partial<CourseOccurrence>, scope?: string, context?: RepositoryContext): CourseOccurrence | null;
  cancelCourseOccurrence(id: string, scope?: string, context?: RepositoryContext): CourseOccurrence | null;
}
