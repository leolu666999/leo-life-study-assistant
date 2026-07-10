import {
  cancelCourseOccurrence,
  importTimetablePreview,
  listCourseOccurrences,
  listCourses,
  listTimetableCourses,
  listTimetableSources,
  updateCourseOccurrence
} from "@/lib/db";
import type { TimetableRepository } from "../timetable-repository";

export const sqliteTimetableRepository: TimetableRepository = {
  listCourses,
  listTimetableSources,
  listTimetableCourses,
  listCourseOccurrences,
  importTimetablePreview,
  updateCourseOccurrence,
  cancelCourseOccurrence
};
