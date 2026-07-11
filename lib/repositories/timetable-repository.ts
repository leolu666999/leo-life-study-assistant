import type { Course, CourseOccurrence, TimetableCourse, TimetableImportPreview, TimetableSource } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";
import type { RepositoryResult } from "./repository-context";

export type TimetableImportResult = {
  sourceId: string;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
};

export interface TimetableRepository {
  listCourses(context?: RepositoryContext): RepositoryResult<Course[]>;
  listTimetableSources(context?: RepositoryContext): RepositoryResult<TimetableSource[]>;
  listTimetableCourses(context?: RepositoryContext): RepositoryResult<TimetableCourse[]>;
  listCourseOccurrences(input?: { from?: string; to?: string; includeCancelled?: boolean }, context?: RepositoryContext): RepositoryResult<CourseOccurrence[]>;
  importTimetablePreview(preview: TimetableImportPreview, context?: RepositoryContext): RepositoryResult<TimetableImportResult>;
  updateCourseOccurrence(id: string, patch: Partial<CourseOccurrence>, scope?: string, context?: RepositoryContext): RepositoryResult<CourseOccurrence | null>;
  cancelCourseOccurrence(id: string, scope?: string, context?: RepositoryContext): RepositoryResult<CourseOccurrence | null>;
}
