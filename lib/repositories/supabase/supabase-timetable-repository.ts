import type { Assignment, ClassSession, Course, CourseOccurrence, TimetableCourse, TimetableSource } from "@/lib/types";
import { instantToWallTime, zonedWallTimeToUtcStrict } from "@/lib/timezone";
import type { RepositoryContext } from "../repository-context";
import type { TimetableRepository } from "../timetable-repository";
import { requireSupabaseContext } from "../request-context";

type Row = Record<string, unknown>;
const editableFields = ["startAt", "endAt", "location", "campus", "notes", "status"] as const;

function mapSource(row: Row): TimetableSource {
  return {
    id: String(row.id), type: row.type as TimetableSource["type"], name: String(row.name),
    feedUrl: row.feedUrl ? String(row.feedUrl) : null, semester: String(row.semester), academicYear: Number(row.academicYear),
    timezone: String(row.timezone || "Australia/Sydney"), lastSyncedAt: row.lastSyncedAt ? String(row.lastSyncedAt) : null,
    lastSyncStatus: row.lastSyncStatus as TimetableSource["lastSyncStatus"], lastSyncError: row.lastSyncError ? String(row.lastSyncError) : null,
    enabled: Boolean(row.enabled), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

function mapCourse(row: Row): TimetableCourse {
  return {
    id: String(row.id), courseCode: String(row.courseCode), courseName: String(row.courseName), activityType: String(row.activityType),
    activityName: row.activityName ? String(row.activityName) : null, semester: String(row.semester), academicYear: Number(row.academicYear),
    defaultLocation: row.defaultLocation ? String(row.defaultLocation) : null, campus: row.campus ? String(row.campus) : null,
    color: String(row.color || "#0f172a"), notes: row.notes ? String(row.notes) : null,
    sourceType: row.sourceType as TimetableCourse["sourceType"], sourceId: row.sourceId ? String(row.sourceId) : null,
    externalUid: row.externalUid ? String(row.externalUid) : null, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapOccurrence(row: Row, course?: TimetableCourse): CourseOccurrence {
  return {
    id: String(row.id), courseId: String(row.courseId), course, startAt: String(row.startAt), endAt: String(row.endAt),
    location: row.location ? String(row.location) : null, campus: row.campus ? String(row.campus) : null,
    status: row.status as CourseOccurrence["status"], isException: Boolean(row.isException),
    originalStartAt: row.originalStartAt ? String(row.originalStartAt) : null,
    sourceUpdatedAt: row.sourceUpdatedAt ? String(row.sourceUpdatedAt) : null,
    localModifiedAt: row.localModifiedAt ? String(row.localModifiedAt) : null,
    localModifiedFields: stringArray(row.localModifiedFields), notes: row.notes ? String(row.notes) : null,
    sourceType: row.sourceType as CourseOccurrence["sourceType"], sourceId: row.sourceId ? String(row.sourceId) : null,
    externalUid: row.externalUid ? String(row.externalUid) : null,
    occurrenceStart: row.occurrenceStart ? String(row.occurrenceStart) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

async function getOccurrence(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const { data, error } = await client.from("course_occurrences").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: course, error: courseError } = await client.from("timetable_courses").select("*").eq("user_id", userId).eq("id", data.courseId).maybeSingle();
  if (courseError) throw courseError;
  return mapOccurrence(data, course ? mapCourse(course) : undefined);
}

function sydneyDateKey(value: string) {
  return instantToWallTime(value, "Australia/Sydney").slice(0, 10);
}

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function scopeBounds(current: CourseOccurrence, scope: string) {
  if (scope === "future") return { from: current.startAt };
  const date = sydneyDateKey(current.startAt);
  if (scope === "week") {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const startDate = addUtcDays(date, -((day + 6) % 7));
    return { from: zonedWallTimeToUtcStrict(startDate, "00:00:00"), to: zonedWallTimeToUtcStrict(addUtcDays(startDate, 7), "00:00:00") };
  }
  if (scope === "month") {
    const startDate = `${date.slice(0, 7)}-01`;
    const next = new Date(`${startDate}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from: zonedWallTimeToUtcStrict(startDate, "00:00:00"), to: zonedWallTimeToUtcStrict(next.toISOString().slice(0, 10), "00:00:00") };
  }
  return {};
}

async function updateOccurrence(id: string, patch: Partial<CourseOccurrence>, scope = "single", context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const current = await getOccurrence(id, context);
  if (!current) return null;
  const normalizedScope = ["single", "series", "future", "week", "month"].includes(scope) ? scope : "single";
  const fields = editableFields.filter((field) => Object.prototype.hasOwnProperty.call(patch, field));
  if (fields.length === 0) return current;
  const values: Record<string, unknown> = { isException: true, localModifiedAt: new Date().toISOString(), localModifiedFields: fields };
  for (const field of fields) if (patch[field] !== null && patch[field] !== undefined) values[field] = patch[field];
  let query = client.from("course_occurrences").update(values).eq("user_id", userId);
  if (normalizedScope === "single") query = query.eq("id", id);
  else {
    query = query.eq("courseId", current.courseId).is("localModifiedAt", null);
    const bounds = scopeBounds(current, normalizedScope);
    if (bounds.from) query = query.gte("startAt", bounds.from);
    if (bounds.to) query = query.lt("startAt", bounds.to);
  }
  const { error } = await query;
  if (error) throw error;
  return getOccurrence(id, context);
}

export const supabaseTimetableRepository: TimetableRepository = {
  async listCourses(context) {
    const { client, userId } = requireSupabaseContext(context);
    const [{ data: courses, error }, { data: sessions, error: sessionError }, { data: assignments, error: assignmentError }] = await Promise.all([
      client.from("courses").select("*").eq("user_id", userId).order("code"),
      client.from("class_sessions").select("*").eq("user_id", userId).order("dayOfWeek").order("startTime"),
      client.from("assignments").select("*").eq("user_id", userId).order("dueDate")
    ]);
    if (error) throw error;
    if (sessionError) throw sessionError;
    if (assignmentError) throw assignmentError;
    return (courses ?? []).map((row) => ({
      id: String(row.id), code: String(row.code), name: String(row.name), semester: String(row.semester), notes: row.notes ? String(row.notes) : null,
      sessions: (sessions ?? []).filter((item) => item.courseId === row.id).map((item) => ({
        id: String(item.id), courseId: String(item.courseId), dayOfWeek: Number(item.dayOfWeek), startTime: String(item.startTime),
        endTime: String(item.endTime), type: String(item.type), location: String(item.location), notes: item.notes ? String(item.notes) : null
      } satisfies ClassSession)),
      assignments: (assignments ?? []).filter((item) => item.courseId === row.id).map((item) => ({
        id: String(item.id), courseId: String(item.courseId), title: String(item.title), dueDate: String(item.dueDate),
        status: String(item.status), weight: item.weight === null ? null : Number(item.weight), notes: item.notes ? String(item.notes) : null,
        linkedTaskId: item.linkedTaskId ? String(item.linkedTaskId) : null
      } satisfies Assignment))
    } satisfies Course));
  },
  async listTimetableSources(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("timetable_sources").select("*").eq("user_id", userId).order("updatedAt", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSource);
  },
  async listTimetableCourses(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("timetable_courses").select("*").eq("user_id", userId).order("courseCode").order("activityType");
    if (error) throw error;
    return (data ?? []).map(mapCourse);
  },
  async listCourseOccurrences(input = {}, context) {
    const { client, userId } = requireSupabaseContext(context);
    let query = client.from("course_occurrences").select("*").eq("user_id", userId).order("startAt");
    if (input.from) query = query.gte("endAt", input.from);
    if (input.to) query = query.lte("startAt", input.to);
    if (!input.includeCancelled) query = query.neq("status", "cancelled");
    const { data, error } = await query;
    if (error) throw error;
    const courseIds = [...new Set((data ?? []).map((row) => String(row.courseId)))];
    const courseMap = new Map<string, TimetableCourse>();
    if (courseIds.length > 0) {
      const courses = await client.from("timetable_courses").select("*").eq("user_id", userId).in("id", courseIds);
      if (courses.error) throw courses.error;
      for (const row of courses.data ?? []) courseMap.set(String(row.id), mapCourse(row));
    }
    return (data ?? []).map((row) => mapOccurrence(row, courseMap.get(String(row.courseId))));
  },
  async importTimetablePreview(preview, context) {
    const { client } = requireSupabaseContext(context);
    if (!/^[a-f0-9]{64}$/i.test(String(preview.source.sourceKey ?? ""))) throw new Error("Timetable preview source identity is missing");
    if (preview.source.type === "calendar_feed") {
      if (!preview.source.feedUrl) throw new Error("Calendar Feed URL is required");
      const { validateCalendarFeedUrl } = await import("@/lib/calendar-feed");
      await validateCalendarFeedUrl(preview.source.feedUrl);
    }
    const { data, error } = await client.rpc("import_timetable_preview_atomic", { p_preview: preview });
    if (error) throw error;
    const result = data as Record<string, unknown>;
    return { sourceId: String(result.sourceId), created: Number(result.created), updated: Number(result.updated),
      skipped: Number(result.skipped), conflicts: Number(result.conflicts) };
  },
  updateCourseOccurrence: updateOccurrence,
  cancelCourseOccurrence(id, scope = "single", context) {
    return updateOccurrence(id, { status: "cancelled" }, scope, context);
  }
};
