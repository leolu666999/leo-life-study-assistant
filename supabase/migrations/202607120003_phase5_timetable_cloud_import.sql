-- Phase 5: stable timetable source identity and atomic three-table import.

alter table public.timetable_sources add column if not exists "sourceKey" text;

alter table public.timetable_sources
  add constraint timetable_sources_source_key_format
  check ("sourceKey" is null or "sourceKey" ~ '^[a-f0-9]{64}$');

create unique index timetable_sources_owner_source_key
  on public.timetable_sources(user_id, type, "sourceKey")
  where "sourceKey" is not null;

create unique index timetable_courses_owner_source_identity
  on public.timetable_courses(user_id, "sourceId", "courseCode", "courseName", "activityType")
  where "sourceId" is not null;

create or replace function public.import_timetable_preview_atomic(p_preview jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_source jsonb := p_preview->'source';
  v_courses jsonb := p_preview->'courses';
  v_occurrences jsonb := p_preview->'occurrences';
  v_source_id uuid;
  v_source_key text;
  v_source_type text;
  v_timezone text;
  v_course jsonb;
  v_course_id uuid;
  v_course_map jsonb := '{}'::jsonb;
  v_occurrence jsonb;
  v_occurrence_start timestamptz;
  v_existing public.course_occurrences%rowtype;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_conflicts integer := 0;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(p_preview) <> 'object' or jsonb_typeof(v_source) <> 'object'
    or jsonb_typeof(v_courses) <> 'array' or jsonb_typeof(v_occurrences) <> 'array' then
    raise exception 'invalid timetable preview payload';
  end if;

  v_source_key := lower(coalesce(v_source->>'sourceKey', ''));
  v_source_type := v_source->>'type';
  v_timezone := v_source->>'timezone';
  if v_source_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid timetable source identity'; end if;
  if v_source_type not in ('calendar_feed', 'ics_file', 'screenshot') then raise exception 'invalid timetable source type'; end if;
  if not exists(select 1 from pg_timezone_names where name = v_timezone) then raise exception 'invalid timetable timezone'; end if;

  select id into v_source_id
  from public.timetable_sources
  where user_id = v_user_id and type = v_source_type and "sourceKey" = v_source_key;

  if v_source_id is null then
    v_source_id := gen_random_uuid();
    insert into public.timetable_sources (
      id, user_id, type, name, "feedUrl", "sourceKey", semester, "academicYear", timezone,
      "lastSyncStatus", enabled
    ) values (
      v_source_id, v_user_id, v_source_type, v_source->>'name', nullif(v_source->>'feedUrl', ''),
      v_source_key, v_source->>'semester', (v_source->>'academicYear')::integer, v_timezone, 'idle', true
    );
  else
    update public.timetable_sources set
      name = v_source->>'name', "feedUrl" = nullif(v_source->>'feedUrl', ''),
      semester = v_source->>'semester', "academicYear" = (v_source->>'academicYear')::integer,
      timezone = v_timezone, enabled = true
    where user_id = v_user_id and id = v_source_id;
  end if;

  for v_course in select value from jsonb_array_elements(v_courses) loop
    if jsonb_typeof(v_course) <> 'object' or coalesce(v_course->>'id', '') = ''
      or btrim(coalesce(v_course->>'courseCode', '')) = '' or btrim(coalesce(v_course->>'courseName', '')) = ''
      or btrim(coalesce(v_course->>'activityType', '')) = '' then
      raise exception 'invalid timetable course payload';
    end if;
    select id into v_course_id
    from public.timetable_courses
    where user_id = v_user_id and "sourceId" = v_source_id
      and "courseCode" = v_course->>'courseCode' and "courseName" = v_course->>'courseName'
      and "activityType" = v_course->>'activityType';
    if v_course_id is null then
      v_course_id := gen_random_uuid();
      insert into public.timetable_courses (
        id, user_id, "courseCode", "courseName", "activityType", "activityName", semester,
        "academicYear", "defaultLocation", campus, color, notes, "sourceType", "sourceId", "externalUid"
      ) values (
        v_course_id, v_user_id, v_course->>'courseCode', v_course->>'courseName', v_course->>'activityType',
        nullif(v_course->>'activityName', ''), v_course->>'semester', (v_course->>'academicYear')::integer,
        nullif(v_course->>'defaultLocation', ''), nullif(v_course->>'campus', ''),
        coalesce(nullif(v_course->>'color', ''), '#0f172a'), nullif(v_course->>'notes', ''),
        coalesce(nullif(v_course->>'sourceType', ''), v_source_type), v_source_id,
        nullif(v_course->>'externalUid', '')
      );
    else
      update public.timetable_courses set
        "activityName" = nullif(v_course->>'activityName', ''),
        semester = v_course->>'semester', "academicYear" = (v_course->>'academicYear')::integer,
        "defaultLocation" = nullif(v_course->>'defaultLocation', ''), campus = nullif(v_course->>'campus', ''),
        color = coalesce(nullif(v_course->>'color', ''), color), notes = nullif(v_course->>'notes', ''),
        "externalUid" = nullif(v_course->>'externalUid', '')
      where user_id = v_user_id and id = v_course_id;
    end if;
    v_course_map := v_course_map || jsonb_build_object(v_course->>'id', v_course_id::text);
  end loop;

  for v_occurrence in select value from jsonb_array_elements(v_occurrences) loop
    if jsonb_typeof(v_occurrence) <> 'object' then raise exception 'invalid timetable occurrence payload'; end if;
    v_course_id := nullif(v_course_map->>(v_occurrence->>'courseId'), '')::uuid;
    if v_course_id is null then raise exception 'timetable occurrence references an unknown course'; end if;
    if btrim(coalesce(v_occurrence->>'externalUid', '')) = '' then raise exception 'timetable occurrence UID is required'; end if;
    v_occurrence_start := coalesce(nullif(v_occurrence->>'occurrenceStart', '')::timestamptz,
      nullif(v_occurrence->>'startAt', '')::timestamptz);
    if v_occurrence_start is null then raise exception 'timetable occurrence identity is required'; end if;

    select * into v_existing
    from public.course_occurrences
    where user_id = v_user_id and "sourceId" = v_source_id
      and "externalUid" = v_occurrence->>'externalUid' and "occurrenceStart" = v_occurrence_start;

    if found then
      if jsonb_array_length(v_existing."localModifiedFields") > 0 then
        v_conflicts := v_conflicts + 1;
        v_skipped := v_skipped + 1;
      else
        update public.course_occurrences set
          "courseId" = v_course_id, "startAt" = (v_occurrence->>'startAt')::timestamptz,
          "endAt" = (v_occurrence->>'endAt')::timestamptz,
          location = nullif(v_occurrence->>'location', ''), campus = nullif(v_occurrence->>'campus', ''),
          status = coalesce(nullif(v_occurrence->>'status', ''), 'scheduled'),
          "isException" = coalesce((v_occurrence->>'isException')::boolean, false),
          "originalStartAt" = nullif(v_occurrence->>'originalStartAt', '')::timestamptz,
          "sourceUpdatedAt" = nullif(v_occurrence->>'sourceUpdatedAt', '')::timestamptz,
          notes = nullif(v_occurrence->>'notes', ''),
          "sourceType" = coalesce(nullif(v_occurrence->>'sourceType', ''), v_source_type)
        where user_id = v_user_id and id = v_existing.id;
        v_updated := v_updated + 1;
      end if;
    else
      insert into public.course_occurrences (
        id, user_id, "courseId", "startAt", "endAt", location, campus, status, "isException",
        "originalStartAt", "sourceUpdatedAt", "localModifiedFields", notes, "sourceType", "sourceId",
        "externalUid", "occurrenceStart"
      ) values (
        gen_random_uuid(), v_user_id, v_course_id, (v_occurrence->>'startAt')::timestamptz,
        (v_occurrence->>'endAt')::timestamptz, nullif(v_occurrence->>'location', ''),
        nullif(v_occurrence->>'campus', ''), coalesce(nullif(v_occurrence->>'status', ''), 'scheduled'),
        coalesce((v_occurrence->>'isException')::boolean, false),
        nullif(v_occurrence->>'originalStartAt', '')::timestamptz,
        nullif(v_occurrence->>'sourceUpdatedAt', '')::timestamptz, '[]'::jsonb,
        nullif(v_occurrence->>'notes', ''), coalesce(nullif(v_occurrence->>'sourceType', ''), v_source_type),
        v_source_id, v_occurrence->>'externalUid', v_occurrence_start
      );
      v_created := v_created + 1;
    end if;
  end loop;

  update public.timetable_sources set
    "lastSyncedAt" = now(), "lastSyncStatus" = 'success', "lastSyncError" = null
  where user_id = v_user_id and id = v_source_id;

  return jsonb_build_object('sourceId', v_source_id, 'created', v_created, 'updated', v_updated,
    'skipped', v_skipped, 'conflicts', v_conflicts);
end;
$$;

revoke all on function public.import_timetable_preview_atomic(jsonb) from public;
grant execute on function public.import_timetable_preview_atomic(jsonb) to authenticated;
