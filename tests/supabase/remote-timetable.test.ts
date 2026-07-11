import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getCourses } from "@/app/api/courses/route";
import { GET as getTimetable } from "@/app/api/timetable/route";
import { POST as previewTimetable } from "@/app/api/timetable/import/preview/route";
import { POST as confirmTimetable } from "@/app/api/timetable/import/confirm/route";
import { PATCH as patchOccurrence, DELETE as deleteOccurrence } from "@/app/api/timetable/occurrences/[id]/route";
import { instantToWallTime } from "@/lib/timezone";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote timetable tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const userAId = required("SUPABASE_TEST_USER_A_ID");
const userBId = required("SUPABASE_TEST_USER_B_ID");
const adminId = required("SUPABASE_TEST_ADMIN_ID");

function client(key = publishableKey) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signIn(emailName: string, passwordName: string) {
  const result = client();
  const { data, error } = await result.auth.signInWithPassword({ email: required(emailName), password: required(passwordName) });
  if (error || !data.session) throw error || new Error(`Unable to sign in ${emailName}`);
  return { client: result, session: data.session };
}

function request(path: string, session?: Session, method = "GET", body?: unknown) {
  return new Request(`http://local.test${path}`, {
    method,
    headers: {
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function calendar(events: string) {
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MyAssist Phase 5//EN\n${events}\nEND:VCALENDAR`;
}

function event(lines: string) {
  return `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
}

const recurringIcs = calendar([
  event([
    "UID:phase5-shared-series", "DTSTART;TZID=Australia/Sydney:20260917T090000",
    "DTEND;TZID=Australia/Sydney:20260917T100000", "RRULE:FREQ=WEEKLY;COUNT=4",
    "EXDATE;TZID=Australia/Sydney:20261001T090000", "SUMMARY:TEST5000 Workshop", "LOCATION:Original Room"
  ].join("\n")),
  event([
    "UID:phase5-shared-series", "RECURRENCE-ID;TZID=Australia/Sydney:20260924T090000",
    "DTSTART;TZID=Australia/Sydney:20260924T110000", "DTEND;TZID=Australia/Sydney:20260924T120000",
    "SUMMARY:TEST5000 Workshop", "LOCATION:Moved Room"
  ].join("\n")),
  event([
    "UID:phase5-shared-series", "RECURRENCE-ID;TZID=Australia/Sydney:20261008T090000",
    "DTSTART;TZID=Australia/Sydney:20261008T090000", "DTEND;TZID=Australia/Sydney:20261008T100000",
    "SUMMARY:TEST5000 Workshop", "STATUS:CANCELLED"
  ].join("\n"))
].join("\n"));

const ids = {
  legacyCourseA: crypto.randomUUID(), legacySessionA: crypto.randomUUID(), legacyAssignmentA: crypto.randomUUID(),
  crossCourse: crypto.randomUUID(), crossOccurrence: crypto.randomUUID(), rollbackSourceKey: crypto.createHash("sha256").update("rollback").digest("hex")
};

let service: SupabaseClient;
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;
let userA: Session;
let userB: Session;
let adminSession: Session;
let previewA: Record<string, any>;
let sourceAId = "";
let courseAId = "";
let movedId = "";
let scheduledId = "";
let cancelledId = "";

async function cleanup() {
  const owners = [userAId, userBId, adminId];
  for (const table of ["course_occurrences", "timetable_courses", "timetable_sources", "assignments", "class_sessions", "courses"]) {
    const { error } = await service.from(table).delete().in("user_id", owners);
    if (error) throw error;
  }
}

beforeAll(async () => {
  process.env.DATA_BACKEND = "supabase";
  process.env.AUTH_REQUIRED = "true";
  service = client(secretKey);
  const [a, b, admin] = await Promise.all([
    signIn("SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD"),
    signIn("SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD"),
    signIn("SUPABASE_TEST_ADMIN_EMAIL", "SUPABASE_TEST_ADMIN_PASSWORD")
  ]);
  userAClient = a.client;
  userBClient = b.client;
  userA = a.session;
  userB = b.session;
  adminSession = admin.session;
  await cleanup();
}, 60_000);

afterAll(async () => {
  await cleanup();
  await Promise.all([userAClient.auth.signOut({ scope: "local" }), userBClient.auth.signOut({ scope: "local" })]);
  delete process.env.DATA_BACKEND;
  delete process.env.AUTH_REQUIRED;
}, 60_000);

describe.sequential("Phase 5 real Supabase timetable", () => {
  it("1. anonymous timetable access is rejected", async () => {
    await expect(getTimetable(request("/api/timetable"))).rejects.toThrow(/Authentication/);
  });

  it("2. preview parses recurrence, EXDATE, moved exception and cancellation without database writes", async () => {
    const before = await service.from("timetable_sources").select("*", { count: "exact", head: true }).eq("user_id", userAId);
    const response = await previewTimetable(request("/api/timetable/import/preview", userA, "POST", {
      icsText: recurringIcs, name: "Synthetic recurrence", semester: "S2", academicYear: 2026, timezone: "Australia/Sydney"
    }));
    expect(response.status).toBe(200);
    previewA = await response.json();
    expect(previewA.summary).toMatchObject({ courseCount: 1, occurrenceCount: 3, duplicateCount: 0 });
    expect(previewA.source.sourceKey).toMatch(/^[a-f0-9]{64}$/);
    expect(previewA.occurrences.filter((item: any) => item.isException)).toHaveLength(2);
    expect(previewA.occurrences.filter((item: any) => item.status === "cancelled")).toHaveLength(1);
    const after = await service.from("timetable_sources").select("*", { count: "exact", head: true }).eq("user_id", userAId);
    expect(after.count).toBe(before.count);
  });

  it("3. confirm atomically creates one source, course and three occurrences", async () => {
    const response = await confirmTimetable(request("/api/timetable/import/confirm", userA, "POST", previewA));
    expect(response.status).toBe(201);
    const result = await response.json() as Record<string, unknown>;
    sourceAId = String(result.sourceId);
    expect(result).toMatchObject({ created: 3, updated: 0, skipped: 0, conflicts: 0 });
    const [{ data: courses }, { data: occurrences }] = await Promise.all([
      service.from("timetable_courses").select("id").eq("user_id", userAId).eq("sourceId", sourceAId),
      service.from("course_occurrences").select("id").eq("user_id", userAId).eq("sourceId", sourceAId)
    ]);
    expect(courses).toHaveLength(1);
    expect(occurrences).toHaveLength(3);
    courseAId = String(courses![0].id);
  });

  it("4. User A receives the established timetable JSON shape", async () => {
    const response = await getTimetable(request("/api/timetable?includeCancelled=1", userA));
    expect(response.status).toBe(200);
    const body = await response.json() as { sources: any[]; courses: any[]; occurrences: any[] };
    expect(body.sources).toHaveLength(1);
    expect(body.courses).toHaveLength(1);
    expect(body.occurrences).toHaveLength(3);
    expect(body.sources[0]).toMatchObject({ id: sourceAId, enabled: true, lastSyncStatus: "success", timezone: "Australia/Sydney" });
    expect(body.occurrences[0].localModifiedFields).toEqual([]);
    const moved = body.occurrences.find((item) => item.isException && item.status !== "cancelled");
    const cancelled = body.occurrences.find((item) => item.status === "cancelled");
    const scheduled = body.occurrences.find((item) => !item.isException);
    movedId = moved.id;
    cancelledId = cancelled.id;
    scheduledId = scheduled.id;
    expect(instantToWallTime(moved.startAt).slice(0, 16)).toBe("2026-09-24T11:00");
    expect(instantToWallTime(moved.occurrenceStart).slice(0, 16)).toBe("2026-09-24T09:00");
  });

  it("5. default query excludes cancelled occurrences", async () => {
    const body = await (await getTimetable(request("/api/timetable", userA))).json() as { occurrences: any[] };
    expect(body.occurrences).toHaveLength(2);
    expect(body.occurrences.some((item) => item.id === cancelledId)).toBe(false);
  });

  it("6. from/to filters use absolute timetable instants", async () => {
    const body = await (await getTimetable(request("/api/timetable?includeCancelled=1&from=2026-09-24T00:00:00Z&to=2026-09-25T00:00:00Z", userA))).json() as { occurrences: any[] };
    expect(body.occurrences).toHaveLength(1);
    expect(body.occurrences[0].id).toBe(movedId);
  });

  it("7. User B cannot see User A timetable or feed metadata", async () => {
    const body = await (await getTimetable(request("/api/timetable?includeCancelled=1", userB))).json() as { sources: any[]; courses: any[]; occurrences: any[] };
    expect(body).toEqual({ sources: [], courses: [], occurrences: [] });
    const { data } = await userBClient.from("timetable_sources").select("id,feedUrl").eq("id", sourceAId);
    expect(data).toEqual([]);
  });

  it("8. Admin Account ordinary timetable API cannot see User A data", async () => {
    const body = await (await getTimetable(request("/api/timetable?includeCancelled=1", adminSession))).json() as { sources: any[]; occurrences: any[] };
    expect(body.sources).toEqual([]);
    expect(body.occurrences).toEqual([]);
  });

  it("9. repeating confirm reuses source identity and does not duplicate occurrences", async () => {
    const result = await (await confirmTimetable(request("/api/timetable/import/confirm", userA, "POST", previewA))).json() as Record<string, unknown>;
    expect(result).toMatchObject({ sourceId: sourceAId, created: 0, updated: 3, skipped: 0, conflicts: 0 });
    const [{ count: sources }, { count: courses }, { count: occurrences }] = await Promise.all([
      service.from("timetable_sources").select("*", { count: "exact", head: true }).eq("user_id", userAId),
      service.from("timetable_courses").select("*", { count: "exact", head: true }).eq("user_id", userAId),
      service.from("course_occurrences").select("*", { count: "exact", head: true }).eq("user_id", userAId)
    ]);
    expect({ sources, courses, occurrences }).toEqual({ sources: 1, courses: 1, occurrences: 3 });
  });

  it("10. single PATCH records localModifiedFields without changing API shape", async () => {
    const response = await patchOccurrence(request(`/api/timetable/occurrences/${movedId}`, userA, "PATCH", {
      patch: { location: "Local Room", notes: "Local note" }, scope: "single"
    }), params(movedId));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: movedId, location: "Local Room", notes: "Local note", isException: true,
      localModifiedFields: ["location", "notes"] });
  });

  it("11. re-import protects locally modified occurrence and reports one conflict", async () => {
    const result = await (await confirmTimetable(request("/api/timetable/import/confirm", userA, "POST", previewA))).json() as Record<string, unknown>;
    expect(result).toMatchObject({ created: 0, updated: 2, skipped: 1, conflicts: 1 });
    const { data } = await service.from("course_occurrences").select("location,notes").eq("id", movedId).single();
    expect(data).toMatchObject({ location: "Local Room", notes: "Local note" });
  });

  it("11a. unknown PATCH fields do not clear local modification protection", async () => {
    const response = await patchOccurrence(request(`/api/timetable/occurrences/${movedId}`, userA, "PATCH", {
      patch: { unexpectedField: "ignored" }, scope: "single"
    }), params(movedId));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: movedId, location: "Local Room", localModifiedFields: ["location", "notes"] });
  });

  it("12. User B cannot PATCH User A occurrence even when UUID is known", async () => {
    const response = await patchOccurrence(request(`/api/timetable/occurrences/${movedId}`, userB, "PATCH", { location: "tampered" }), params(movedId));
    expect(response.status).toBe(404);
    const { data } = await service.from("course_occurrences").select("location").eq("id", movedId).single();
    expect(data?.location).toBe("Local Room");
  });

  it("13. User B cannot cancel User A occurrence", async () => {
    const response = await deleteOccurrence(request(`/api/timetable/occurrences/${scheduledId}`, userB, "DELETE"), params(scheduledId));
    expect(response.status).toBe(404);
    const { data } = await service.from("course_occurrences").select("status").eq("id", scheduledId).single();
    expect(data?.status).toBe("scheduled");
  });

  it("14. DELETE is a soft cancellation and includeCancelled still returns the row", async () => {
    const response = await deleteOccurrence(request(`/api/timetable/occurrences/${scheduledId}?scope=single`, userA, "DELETE"), params(scheduledId));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: scheduledId, status: "cancelled", localModifiedFields: ["status"] });
    const included = await (await getTimetable(request("/api/timetable?includeCancelled=1", userA))).json() as { occurrences: any[] };
    expect(included.occurrences.some((item) => item.id === scheduledId && item.status === "cancelled")).toBe(true);
  });

  it("15. series cancellation updates unmodified instances but preserves locally modified ones", async () => {
    const response = await deleteOccurrence(request(`/api/timetable/occurrences/${cancelledId}?scope=series`, userA, "DELETE"), params(cancelledId));
    expect(response.status).toBe(200);
    const { data } = await service.from("course_occurrences").select("id,status").eq("user_id", userAId).eq("courseId", courseAId);
    expect(data?.find((item) => item.id === movedId)?.status).toBe("scheduled");
    expect(data?.filter((item) => item.id !== movedId).every((item) => item.status === "cancelled")).toBe(true);
  });

  it("16. User B can import the same external UID into an independent owner space", async () => {
    const previewResponse = await previewTimetable(request("/api/timetable/import/preview", userB, "POST", {
      icsText: recurringIcs, name: "B recurrence", semester: "S2", academicYear: 2026, timezone: "Australia/Sydney"
    }));
    const preview = await previewResponse.json();
    const result = await (await confirmTimetable(request("/api/timetable/import/confirm", userB, "POST", preview))).json() as Record<string, unknown>;
    expect(result).toMatchObject({ created: 3 });
    const { count } = await service.from("course_occurrences").select("*", { count: "exact", head: true }).eq("user_id", userBId).eq("externalUid", "phase5-shared-series");
    expect(count).toBe(3);
  });

  it("17. malformed ICS returns the existing 400 error boundary", async () => {
    const response = await previewTimetable(request("/api/timetable/import/preview", userA, "POST", { icsText: "not ics" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
  });

  it("18. invalid timezone is rejected rather than using server local time", async () => {
    const response = await previewTimetable(request("/api/timetable/import/preview", userA, "POST", {
      icsText: recurringIcs, timezone: "Mars/Olympus"
    }));
    expect(response.status).toBe(400);
    expect(String((await response.json()).error)).toMatch(/时区/);
  });

  it("19. localhost Calendar Feed is blocked before network fetch", async () => {
    const response = await previewTimetable(request("/api/timetable/import/preview", userA, "POST", { feedUrl: "http://127.0.0.1:3011/private.ics" }));
    expect(response.status).toBe(400);
    expect(String((await response.json()).error)).toMatch(/不允许/);
  });

  it("20. Cloud GET /api/courses preserves legacy owner isolation", async () => {
    await userAClient.from("courses").insert({ id: ids.legacyCourseA, code: "LEGACY1", name: "Legacy", semester: "S2" });
    await userAClient.from("class_sessions").insert({ id: ids.legacySessionA, courseId: ids.legacyCourseA, dayOfWeek: 1,
      startTime: "09:00", endTime: "10:00", type: "lecture", location: "Room" });
    await userAClient.from("assignments").insert({ id: ids.legacyAssignmentA, courseId: ids.legacyCourseA, title: "Assignment",
      dueDate: "2026-09-01T00:00:00Z", status: "not_started" });
    const own = await (await getCourses(request("/api/courses", userA))).json() as any[];
    const other = await (await getCourses(request("/api/courses", userB))).json() as any[];
    expect(own[0]).toMatchObject({ id: ids.legacyCourseA, sessions: [{ id: ids.legacySessionA }], assignments: [{ id: ids.legacyAssignmentA }] });
    expect(other).toEqual([]);
  });

  it("21. User B cannot attach a timetable course to User A source", async () => {
    const { error } = await userBClient.from("timetable_courses").insert({ id: ids.crossCourse, courseCode: "CROSS1",
      courseName: "Cross", activityType: "Lecture", semester: "S2", academicYear: 2026, sourceId: sourceAId });
    expect(error).not.toBeNull();
    const { count } = await service.from("timetable_courses").select("*", { count: "exact", head: true }).eq("id", ids.crossCourse);
    expect(count).toBe(0);
  });

  it("22. User B cannot attach an occurrence to User A course", async () => {
    const { error } = await userBClient.from("course_occurrences").insert({ id: ids.crossOccurrence, courseId: courseAId,
      startAt: "2026-09-01T00:00:00Z", endAt: "2026-09-01T01:00:00Z" });
    expect(error).not.toBeNull();
    const { count } = await service.from("course_occurrences").select("*", { count: "exact", head: true }).eq("id", ids.crossOccurrence);
    expect(count).toBe(0);
  });

  it("23. atomic import failure leaves no source, course, or occurrence", async () => {
    const invalidPreview = {
      source: { type: "ics_file", name: "Rollback", sourceKey: ids.rollbackSourceKey, semester: "S2", academicYear: 2026, timezone: "Australia/Sydney" },
      courses: [{ id: crypto.randomUUID(), courseCode: "ROLL1", courseName: "Rollback", activityType: "Lecture", semester: "S2", academicYear: 2026 }],
      occurrences: [{ courseId: crypto.randomUUID(), startAt: "2026-09-01T00:00:00Z", endAt: "2026-09-01T01:00:00Z",
        externalUid: "rollback", occurrenceStart: "2026-09-01T00:00:00Z" }]
    };
    const { error } = await userAClient.rpc("import_timetable_preview_atomic", { p_preview: invalidPreview });
    expect(error).not.toBeNull();
    const { data: sources } = await service.from("timetable_sources").select("id").eq("user_id", userAId).eq("sourceKey", ids.rollbackSourceKey);
    expect(sources).toEqual([]);
    const { count: courses } = await service.from("timetable_courses").select("*", { count: "exact", head: true }).eq("user_id", userAId).eq("courseCode", "ROLL1");
    const { count: occurrences } = await service.from("course_occurrences").select("*", { count: "exact", head: true }).eq("user_id", userAId).eq("externalUid", "rollback");
    expect({ courses, occurrences }).toEqual({ courses: 0, occurrences: 0 });
  });

  it("24. invalid occurrence status also rolls back a started import", async () => {
    const sourceKey = crypto.createHash("sha256").update("invalid-status").digest("hex");
    const courseId = crypto.randomUUID();
    const invalid = { source: { type: "ics_file", name: "Invalid", sourceKey, semester: "S2", academicYear: 2026, timezone: "Australia/Sydney" },
      courses: [{ id: courseId, courseCode: "BAD1", courseName: "Bad", activityType: "Lecture", semester: "S2", academicYear: 2026 }],
      occurrences: [{ courseId, startAt: "2026-09-01T00:00:00Z", endAt: "2026-09-01T01:00:00Z",
        status: "invalid", externalUid: "invalid-status", occurrenceStart: "2026-09-01T00:00:00Z" }] };
    const { error } = await userAClient.rpc("import_timetable_preview_atomic", { p_preview: invalid });
    expect(error).not.toBeNull();
    const { count } = await service.from("timetable_sources").select("*", { count: "exact", head: true }).eq("sourceKey", sourceKey);
    expect(count).toBe(0);
  });

  it("25. Admin ordinary import creates only Admin-owned timetable data", async () => {
    const ics = calendar(event("UID:admin-own\nDTSTART:20260801T000000Z\nDTEND:20260801T010000Z\nSUMMARY:ADMIN1000 Lecture"));
    const preview = await (await previewTimetable(request("/api/timetable/import/preview", adminSession, "POST", { icsText: ics }))).json();
    await confirmTimetable(request("/api/timetable/import/confirm", adminSession, "POST", preview));
    const { count: adminCount } = await service.from("course_occurrences").select("*", { count: "exact", head: true }).eq("user_id", adminId).eq("externalUid", "admin-own");
    const a = await (await getTimetable(request("/api/timetable?includeCancelled=1", userA))).json() as { occurrences: any[] };
    expect(adminCount).toBe(1);
    expect(a.occurrences.some((item) => item.externalUid === "admin-own")).toBe(false);
  });

  it("26. anonymous confirm cannot execute the transaction RPC", async () => {
    await expect(confirmTimetable(request("/api/timetable/import/confirm", undefined, "POST", previewA))).rejects.toThrow(/Authentication/);
  });
});
