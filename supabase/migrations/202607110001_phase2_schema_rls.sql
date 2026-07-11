begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if to_jsonb(new) ? 'updatedAt' then
    new."updatedAt" = now();
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at_snake()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "originalName" text not null,
  "storedName" text not null,
  path text not null,
  "mimeType" text not null,
  size bigint not null check (size >= 0),
  "createdAt" timestamptz not null default now(),
  "linkedEntityType" text,
  "linkedEntityId" uuid,
  bucket text,
  object_path text,
  sha256 text,
  status text not null default 'uploaded' check (status in ('pending', 'uploaded', 'pending_delete', 'deleted', 'failed')),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  unique (user_id, id),
  unique (user_id, bucket, object_path)
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('daily', 'weekly', 'monthly')),
  "startDate" date not null,
  "endDate" date not null,
  "reflectionNote" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  check ("endDate" >= "startDate")
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  type text not null check (type in ('todo', 'deadline', 'counter', 'checklist', 'shopping', 'plan_item')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  tags_json jsonb not null default '[]'::jsonb check (jsonb_typeof(tags_json) = 'array'),
  "startDate" timestamptz,
  "dueDate" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "completedAt" timestamptz,
  "archivedAt" timestamptz,
  "reminderRule" text default 'none',
  "progressCurrent" numeric,
  "progressTarget" numeric,
  "progressUnit" text,
  "parentPlanId" uuid,
  "originalImageId" uuid,
  notes text,
  "progressEnabled" boolean not null default false,
  "progressType" text not null default 'none' check ("progressType" in ('none', 'count', 'pages', 'percentage', 'time', 'custom', 'custom_unit')),
  "pinnedToBottom" boolean not null default false,
  "deletedAt" timestamptz,
  unique (user_id, id),
  foreign key (user_id, "parentPlanId") references public.plans(user_id, id) on delete set null ("parentPlanId"),
  foreign key (user_id, "originalImageId") references public.uploaded_files(user_id, id) on delete set null ("originalImageId")
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "taskId" uuid not null,
  title text not null,
  completed boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, "taskId") references public.tasks(user_id, id) on delete cascade
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  "createdAt" timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name)
);

create table public.task_tags (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "taskId" uuid not null,
  "tagId" uuid not null,
  primary key (user_id, "taskId", "tagId"),
  foreign key (user_id, "taskId") references public.tasks(user_id, id) on delete cascade,
  foreign key (user_id, "tagId") references public.tags(user_id, id) on delete cascade
);

create table public.plan_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "planId" uuid not null,
  "taskId" uuid not null,
  "sortOrder" integer not null default 0,
  primary key (user_id, "planId", "taskId"),
  foreign key (user_id, "planId") references public.plans(user_id, id) on delete cascade,
  foreign key (user_id, "taskId") references public.tasks(user_id, id) on delete cascade
);

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  notes text,
  "sourcePlanId" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, "sourcePlanId"),
  foreign key (user_id, "sourcePlanId") references public.plans(user_id, id) on delete set null ("sourcePlanId")
);

create table public.todo_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "todoListId" uuid not null,
  content text not null,
  completed boolean not null default false,
  "sortOrder" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "hasScheduleTime" boolean not null default false,
  "scheduledStartAt" timestamptz,
  "scheduledEndAt" timestamptz,
  "scheduledTimezone" text,
  "parsedTimeText" text,
  "scheduleParseConfidence" numeric,
  unique (user_id, id),
  foreign key (user_id, "todoListId") references public.todo_lists(user_id, id) on delete cascade,
  check ("scheduledEndAt" is null or "scheduledStartAt" is null or "scheduledEndAt" >= "scheduledStartAt")
);

create table public.progress_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  "currentValue" numeric not null default 0,
  "targetValue" numeric not null default 1,
  unit text default '',
  category text default 'general',
  "linkedTaskId" uuid,
  pinned boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, "linkedTaskId") references public.tasks(user_id, id) on delete set null ("linkedTaskId")
);

create table public.task_progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "taskId" uuid not null,
  "createdAt" timestamptz not null default now(),
  "amountDelta" numeric,
  "currentValueAfter" numeric,
  "durationMinutes" numeric,
  note text,
  unique (user_id, id),
  foreign key (user_id, "taskId") references public.tasks(user_id, id) on delete cascade
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  semester text not null,
  notes text,
  unique (user_id, id)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "courseId" uuid not null,
  "dayOfWeek" integer not null check ("dayOfWeek" between 0 and 6),
  "startTime" time not null,
  "endTime" time not null,
  type text not null,
  location text not null,
  notes text,
  unique (user_id, id),
  foreign key (user_id, "courseId") references public.courses(user_id, id) on delete cascade,
  check ("endTime" >= "startTime")
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "courseId" uuid not null,
  title text not null,
  "dueDate" timestamptz not null,
  status text not null default 'not_started',
  weight numeric,
  notes text,
  "linkedTaskId" uuid,
  unique (user_id, id),
  foreign key (user_id, "courseId") references public.courses(user_id, id) on delete cascade,
  foreign key (user_id, "linkedTaskId") references public.tasks(user_id, id) on delete set null ("linkedTaskId")
);

create table public.timetable_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('calendar_feed', 'ics_file', 'screenshot')),
  name text not null,
  "feedUrl" text,
  semester text not null,
  "academicYear" integer not null,
  timezone text not null default 'Australia/Sydney',
  "lastSyncedAt" timestamptz,
  "lastSyncStatus" text not null default 'idle' check ("lastSyncStatus" in ('idle', 'success', 'failed')),
  "lastSyncError" text,
  enabled boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id)
);

create table public.timetable_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "courseCode" text not null,
  "courseName" text not null,
  "activityType" text not null,
  "activityName" text,
  semester text not null,
  "academicYear" integer not null,
  "defaultLocation" text,
  campus text,
  color text not null default '#0f172a',
  notes text,
  "sourceType" text not null default 'manual',
  "sourceId" uuid,
  "externalUid" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, "sourceId") references public.timetable_sources(user_id, id) on delete set null ("sourceId")
);

create table public.course_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "courseId" uuid not null,
  "startAt" timestamptz not null,
  "endAt" timestamptz not null,
  location text,
  campus text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  "isException" boolean not null default false,
  "originalStartAt" timestamptz,
  "sourceUpdatedAt" timestamptz,
  "localModifiedAt" timestamptz,
  "localModifiedFields" jsonb not null default '[]'::jsonb check (jsonb_typeof("localModifiedFields") = 'array'),
  notes text,
  "sourceType" text not null default 'manual',
  "sourceId" uuid,
  "externalUid" text,
  "occurrenceStart" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, "courseId") references public.timetable_courses(user_id, id) on delete cascade,
  foreign key (user_id, "sourceId") references public.timetable_sources(user_id, id) on delete set null ("sourceId"),
  check ("endAt" >= "startAt")
);

create unique index course_occurrences_source_instance
  on public.course_occurrences(user_id, "sourceId", "externalUid", "occurrenceStart")
  where "sourceId" is not null and "externalUid" is not null and "occurrenceStart" is not null;

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  source text not null check (source in ('daily_plan', 'manual')),
  content text not null,
  "linkedPlanId" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, "linkedPlanId") references public.plans(user_id, id) on delete set null ("linkedPlanId")
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(18,4) not null check (amount >= 0),
  currency text not null default 'AUD' check (currency in ('AUD','USD','CNY','EUR','GBP','JPY','KRW','SGD','MYR','CAD','NZD','HKD','CHF','THB','INR','AED','SAR','TWD','IDR','PHP','VND')),
  category text not null,
  date date not null,
  merchant text,
  "paymentMethod" text,
  notes text,
  "receiptFileId" uuid,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  type text not null default 'expense' check (type in ('expense', 'income')),
  unique (user_id, id),
  foreign key (user_id, "receiptFileId") references public.uploaded_files(user_id, id) on delete set null ("receiptFileId")
);

create table public.important_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text not null default '其他',
  tags_json jsonb not null default '[]'::jsonb check (jsonb_typeof(tags_json) = 'array'),
  notes text,
  "fileId" uuid not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "expiryDate" date,
  unique (user_id, id),
  foreign key (user_id, "fileId") references public.uploaded_files(user_id, id) on delete cascade
);

create table public.settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  "updatedAt" timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  result text not null default 'started',
  created_at timestamptz not null default now()
);

create index tasks_owner_status_due on public.tasks(user_id, status, "dueDate");
create index tasks_owner_type on public.tasks(user_id, type);
create index subtasks_owner_task on public.subtasks(user_id, "taskId");
create index task_progress_owner_task_time on public.task_progress_entries(user_id, "taskId", "createdAt" desc);
create index plan_items_owner_plan_sort on public.plan_items(user_id, "planId", "sortOrder");
create index todo_lists_owner_date on public.todo_lists(user_id, date desc);
create index todo_items_owner_list_sort on public.todo_list_items(user_id, "todoListId", "sortOrder");
create index todo_items_owner_schedule on public.todo_list_items(user_id, "hasScheduleTime", "scheduledStartAt");
create index journal_owner_date on public.journal_entries(user_id, date desc);
create index expenses_owner_date_currency on public.expenses(user_id, date desc, currency, type);
create index timetable_courses_owner_source on public.timetable_courses(user_id, "sourceId", "courseCode");
create index occurrences_owner_time on public.course_occurrences(user_id, "startAt", "endAt");
create index important_files_owner_expiry on public.important_files(user_id, "expiryDate");
create index uploaded_files_owner_link on public.uploaded_files(user_id, "linkedEntityType", "linkedEntityId");
create index admin_audit_target_time on public.admin_audit_logs(target_user_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tasks','subtasks','tags','task_tags','plans','plan_items','todo_lists','todo_list_items',
    'progress_items','task_progress_entries','courses','class_sessions','assignments','timetable_sources',
    'timetable_courses','course_occurrences','journal_entries','expenses','uploaded_files','important_files','settings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at_snake();

alter table public.admin_audit_logs enable row level security;
alter table public.admin_audit_logs force row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant all on table public.admin_audit_logs to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'uploaded_files','plans','tasks','subtasks','todo_lists','todo_list_items','progress_items',
    'timetable_sources','timetable_courses','course_occurrences','journal_entries','expenses','important_files','settings'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, null)
  on conflict (user_id) do nothing;

  insert into public.settings (user_id, key, value)
  values
    (new.id, 'lastUsedCurrency', ''),
    (new.id, 'homeTitle', 'MyAssist'),
    (new.id, 'showHomeTitle', '1'),
    (new.id, 'background', 'default')
  on conflict (user_id, key) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

comment on column public.todo_lists."sourcePlanId" is
  'Known SQLite orphan must be set NULL or reported during reconciliation; never auto-create a fake plan.';
comment on table public.progress_items is
  'Legacy compatibility table. Keep private and read-only at application level after reconciliation.';
comment on table public.admin_audit_logs is
  'No ordinary client policies. Only controlled server-side service-role operations may access this table.';

commit;
