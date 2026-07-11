import { createHash, randomUUID } from "node:crypto";
import ICAL from "ical.js";
import type { CourseOccurrence, TimetableCourse, TimetableImportPreview, TimetableSourceType } from "./types";
import { isValidTimeZone, zonedWallTimeToUtcStrict } from "./timezone";

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

function timeParts(value: ICAL.Time) {
  return {
    date: `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`,
    time: `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}:${String(value.second).padStart(2, "0")}`
  };
}

function propertyTimezone(event: ICAL.Event, propertyName: string) {
  const property = event.component.getFirstProperty(propertyName);
  const value = property?.getParameter("tzid");
  return Array.isArray(value) ? value[0] : value;
}

function toIso(value: ICAL.Time | Date | null | undefined, event?: ICAL.Event, propertyName = "dtstart", fallbackTimezone = "Australia/Sydney") {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value.zone?.tzid === "UTC") return value.toJSDate().toISOString();
  const requestedTimezone = (event && propertyTimezone(event, propertyName)) || (value.zone?.tzid !== "floating" ? value.zone?.tzid : "") || fallbackTimezone;
  if (requestedTimezone && isValidTimeZone(requestedTimezone)) {
    const parts = timeParts(value);
    return zonedWallTimeToUtcStrict(parts.date, value.isDate ? "00:00:00" : parts.time, requestedTimezone);
  }
  if (value.zone?.tzid && value.zone.tzid !== "floating" && ICAL.TimezoneService.has(value.zone.tzid)) {
    return value.toJSDate().toISOString();
  }
  throw new Error("ICS 包含无法识别的时区。");
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

function eventUpdatedAt(event: ICAL.Event, fallbackTimezone: string) {
  const component = event.component;
  const modified = component.getFirstPropertyValue("last-modified") as ICAL.Time | undefined;
  if (modified) return toIso(modified, event, "last-modified", fallbackTimezone);
  const stamp = component.getFirstPropertyValue("dtstamp") as ICAL.Time | undefined;
  return stamp ? toIso(stamp, event, "dtstamp", fallbackTimezone) : new Date().toISOString();
}

function eventStatus(event: ICAL.Event): CourseOccurrence["status"] {
  const status = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase();
  return status === "CANCELLED" ? "cancelled" : "scheduled";
}

function expansionWindow(events: ICAL.Event[], fallbackTimezone: string) {
  const starts = events.map((event) => event.startDate ? new Date(toIso(event.startDate, event, "dtstart", fallbackTimezone)).getTime() : NaN)
    .filter((value): value is number => Number.isFinite(value));
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

type ExpandedEvent = { start: ICAL.Time; end: ICAL.Time; recurrenceId: ICAL.Time; item: ICAL.Event };

function expandEvent(event: ICAL.Event, windowEnd: ICAL.Time) {
  const occurrences: ExpandedEvent[] = [];
  if (event.isRecurring()) {
    const iterator = event.iterator();
    let next = iterator.next();
    let count = 0;
    while (next && next.compare(windowEnd) <= 0 && count < 500) {
      const details = event.getOccurrenceDetails(next);
      occurrences.push({ start: details.startDate, end: details.endDate, recurrenceId: details.recurrenceId, item: details.item });
      next = iterator.next();
      count += 1;
    }
    if (event.startDate && !occurrences.some((item) => item.recurrenceId.compare(event.startDate) === 0)) {
      const details = event.getOccurrenceDetails(event.startDate);
      occurrences.push({ start: details.startDate, end: details.endDate, recurrenceId: details.recurrenceId, item: details.item });
    }
    return occurrences;
  }
  if (event.startDate) occurrences.push({ start: event.startDate, end: addDuration(event.startDate, event),
    recurrenceId: event.recurrenceId || event.startDate, item: event });
  return occurrences;
}

function eventGroups(components: ICAL.Component[]) {
  const groups = new Map<string, ICAL.Component[]>();
  for (const component of components) {
    const event = new ICAL.Event(component);
    const uid = event.uid || randomUUID();
    groups.set(uid, [...(groups.get(uid) ?? []), component]);
  }
  const events: ICAL.Event[] = [];
  for (const componentsForUid of groups.values()) {
    const masters = componentsForUid.filter((component) => !component.hasProperty("recurrence-id"));
    const exceptions = componentsForUid.filter((component) => component.hasProperty("recurrence-id"));
    if (masters.length > 0) {
      for (const master of masters) events.push(new ICAL.Event(master, { strictExceptions: true, exceptions }));
    } else {
      for (const exception of exceptions) events.push(new ICAL.Event(exception));
    }
  }
  return events;
}

function sourceKey(icsText: string, options: PreviewOptions) {
  let identity = icsText;
  if (options.feedUrl) {
    const url = new URL(options.feedUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Calendar Feed 只支持 HTTP 或 HTTPS。");
    if (url.username || url.password) throw new Error("Calendar Feed URL 不允许包含用户名或密码。");
    url.hash = "";
    identity = url.toString();
  }
  return createHash("sha256").update(identity).digest("hex");
}

export function parseIcsToTimetablePreview(icsText: string, options: PreviewOptions): TimetableImportPreview {
  const fallbackTimezone = options.timezone || "Australia/Sydney";
  if (!isValidTimeZone(fallbackTimezone)) throw new Error("无效的 IANA 时区。");
  const jcal = ICAL.parse(icsText);
  const calendar = new ICAL.Component(jcal);
  const vevents = calendar.getAllSubcomponents("vevent");
  for (const timezone of calendar.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(timezone);
  const events = eventGroups(vevents);
  const window = expansionWindow(events, fallbackTimezone);
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
      const item = occurrence.item;
      const occurrenceDescription = item.description || description;
      const occurrenceLocation = item.location || location;
      const isException = item.isRecurrenceException();
      const startAt = toIso(occurrence.start, item, "dtstart", fallbackTimezone);
      const identityStart = toIso(occurrence.recurrenceId, isException ? item : event,
        isException ? "recurrence-id" : "dtstart", fallbackTimezone);
      occurrences.push({
        id: randomUUID(),
        courseId: course.id,
        course,
        startAt,
        endAt: toIso(occurrence.end, item, "dtend", fallbackTimezone),
        location: occurrenceLocation,
        campus: campusFromLocation(occurrenceLocation),
        status: eventStatus(item),
        isException,
        originalStartAt: isException ? identityStart : null,
        sourceUpdatedAt: eventUpdatedAt(item, fallbackTimezone),
        localModifiedAt: null,
        localModifiedFields: [],
        notes: occurrenceDescription,
        sourceType: options.sourceType,
        sourceId: null,
        externalUid: uid,
        occurrenceStart: identityStart,
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
      sourceKey: sourceKey(icsText, options),
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
