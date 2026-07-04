import { randomUUID } from "node:crypto";
import ICAL from "ical.js";
import type { CourseOccurrence, TimetableCourse, TimetableImportPreview, TimetableSourceType } from "./types";

const activityTypes = ["Lecture", "Tutorial", "Workshop", "Practical", "Seminar", "Lab", "Studio", "Exam"];
const colors = ["#0f172a", "#2563eb", "#059669", "#7c3aed", "#dc2626", "#ea580c", "#0891b2", "#4f46e5"];

type PreviewOptions = {
  sourceType: TimetableSourceType;
  name?: string;
  feedUrl?: string | null;
  semester?: string;
  academicYear?: number;
  timezone?: string;
};

function toIso(value: ICAL.Time | Date | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value.toJSDate().toISOString();
}

function addDuration(start: ICAL.Time, event: ICAL.Event) {
  if (event.endDate) return event.endDate;
  const duration = event.duration;
  if (!duration) return start;
  const end = start.clone();
  end.addDuration(duration);
  return end;
}

function extractActivityType(summary: string, description: string) {
  const haystack = `${summary} ${description}`.toLowerCase();
  return activityTypes.find((type) => haystack.includes(type.toLowerCase())) ?? "Other";
}

function extractCourseCode(summary: string, description: string) {
  const match = `${summary} ${description}`.match(/\b[A-Z]{3,}[A-Z0-9]*\d{3,}[A-Z0-9]*\b/);
  return match?.[0] ?? "COURSE";
}

function cleanCourseName(summary: string, courseCode: string, activityType: string) {
  return summary
    .replace(courseCode, "")
    .replace(new RegExp(activityType, "i"), "")
    .replace(/[-–—|()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || summary || courseCode;
}

function campusFromLocation(location: string) {
  const lower = location.toLowerCase();
  if (lower.includes("camperdown")) return "Camperdown";
  if (lower.includes("darlington")) return "Darlington";
  if (lower.includes("online") || lower.includes("zoom")) return "Online";
  return "";
}

function eventUpdatedAt(event: ICAL.Event) {
  const component = event.component;
  return toIso(
    component.getFirstPropertyValue("last-modified") as ICAL.Time | undefined ??
    component.getFirstPropertyValue("dtstamp") as ICAL.Time | undefined ??
    undefined
  );
}

function eventStatus(event: ICAL.Event): CourseOccurrence["status"] {
  const status = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase();
  return status === "CANCELLED" ? "cancelled" : "scheduled";
}

function expansionWindow(events: ICAL.Event[]) {
  const starts = events.map((event) => event.startDate?.toJSDate().getTime()).filter((value): value is number => Number.isFinite(value));
  const first = starts.length ? new Date(Math.min(...starts)) : new Date();
  const start = new Date(first);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(first);
  end.setMonth(end.getMonth() + 7);
  return {
    start: ICAL.Time.fromJSDate(start, false),
    end: ICAL.Time.fromJSDate(end, false)
  };
}

function expandEvent(event: ICAL.Event, windowEnd: ICAL.Time) {
  const occurrences: Array<{ start: ICAL.Time; end: ICAL.Time }> = [];
  if (event.isRecurring()) {
    const iterator = event.iterator();
    let next = iterator.next();
    let count = 0;
    while (next && next.compare(windowEnd) <= 0 && count < 500) {
      const details = event.getOccurrenceDetails(next);
      occurrences.push({ start: details.startDate, end: details.endDate });
      next = iterator.next();
      count += 1;
    }
    return occurrences;
  }
  if (event.startDate) occurrences.push({ start: event.startDate, end: addDuration(event.startDate, event) });
  return occurrences;
}

export function parseIcsToTimetablePreview(icsText: string, options: PreviewOptions): TimetableImportPreview {
  const jcal = ICAL.parse(icsText);
  const calendar = new ICAL.Component(jcal);
  const vevents = calendar.getAllSubcomponents("vevent");
  const events = vevents.map((component) => new ICAL.Event(component));
  const window = expansionWindow(events);
  const courseMap = new Map<string, TimetableCourse>();
  const occurrences: CourseOccurrence[] = [];
  const unrecognizedFields = new Set<string>();

  for (const event of events) {
    const summary = event.summary || "未命名课程";
    const description = event.description || "";
    const location = event.location || "";
    const uid = event.uid || randomUUID();
    const courseCode = extractCourseCode(summary, description);
    const activityType = extractActivityType(summary, description);
    const courseName = cleanCourseName(summary, courseCode, activityType);
    if (courseCode === "COURSE") unrecognizedFields.add(summary);
    const courseKey = `${courseCode}|${courseName}|${activityType}`;
    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        id: randomUUID(),
        courseCode,
        courseName,
        activityType,
        activityName: summary,
        semester: options.semester || "Semester",
        academicYear: options.academicYear || new Date().getFullYear(),
        defaultLocation: location,
        campus: campusFromLocation(location),
        color: colors[courseMap.size % colors.length],
        notes: description,
        sourceType: options.sourceType,
        sourceId: null,
        externalUid: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    const course = courseMap.get(courseKey)!;
    for (const occurrence of expandEvent(event, window.end)) {
      const startAt = toIso(occurrence.start);
      occurrences.push({
        id: randomUUID(),
        courseId: course.id,
        course,
        startAt,
        endAt: toIso(occurrence.end),
        location,
        campus: campusFromLocation(location),
        status: eventStatus(event),
        isException: Boolean(event.recurrenceId),
        originalStartAt: event.recurrenceId ? toIso(event.recurrenceId) : null,
        sourceUpdatedAt: eventUpdatedAt(event),
        localModifiedAt: null,
        localModifiedFields: [],
        notes: description,
        sourceType: options.sourceType,
        sourceId: null,
        externalUid: uid,
        occurrenceStart: startAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  const sortedOccurrences = occurrences.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const semesterStart = sortedOccurrences[0]?.startAt ?? null;
  const semesterEnd = sortedOccurrences[sortedOccurrences.length - 1]?.endAt ?? null;
  const duplicateCount = sortedOccurrences.length - new Set(sortedOccurrences.map((item) => `${item.externalUid}|${item.occurrenceStart}`)).size;

  return {
    source: {
      type: options.sourceType,
      name: options.name || (options.feedUrl ? "Calendar Feed" : "ICS 文件"),
      feedUrl: options.feedUrl ?? null,
      semester: options.semester || "Semester",
      academicYear: options.academicYear || new Date().getFullYear(),
      timezone: options.timezone || "Australia/Sydney"
    },
    summary: {
      courseCount: courseMap.size,
      occurrenceCount: sortedOccurrences.length,
      semesterStart,
      semesterEnd,
      duplicateCount,
      conflictCount: 0,
      unrecognizedFields: Array.from(unrecognizedFields)
    },
    courses: Array.from(courseMap.values()),
    occurrences: sortedOccurrences
  };
}
