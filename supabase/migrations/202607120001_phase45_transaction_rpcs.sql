-- Phase 4.5: atomic write boundaries for multi-table cloud operations.
-- All functions are security invoker and derive ownership from auth.uid().

create or replace function public.save_task_with_relations(
  p_task_id uuid,
  p_create boolean,
  p_task jsonb,
  p_tags jsonb,
  p_subtasks jsonb,
  p_replace_subtasks boolean
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tag_name text;
  v_tag_id uuid;
  v_subtask jsonb;
  v_subtask_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_task_id is null or jsonb_typeof(p_task) <> 'object' then raise exception 'invalid task payload'; end if;
  if jsonb_typeof(coalesce(p_tags, '[]'::jsonb)) <> 'array' then raise exception 'invalid tags payload'; end if;
  if jsonb_typeof(coalesce(p_subtasks, '[]'::jsonb)) <> 'array' then raise exception 'invalid subtasks payload'; end if;

  if coalesce((p_task->>'pinnedToBottom')::boolean, false) then
    update public.tasks set "pinnedToBottom" = false
      where user_id = v_user_id and id <> p_task_id and "pinnedToBottom";
    update public.progress_items set pinned = false
      where user_id = v_user_id and pinned;
  end if;

  if p_create then
    insert into public.tasks (
      id, user_id, title, description, type, status, priority, tags_json,
      "startDate", "dueDate", "completedAt", "archivedAt", "reminderRule",
      "progressCurrent", "progressTarget", "progressUnit", "progressEnabled",
      "progressType", "pinnedToBottom", "parentPlanId", "originalImageId", notes
    ) values (
      p_task_id, v_user_id, p_task->>'title', coalesce(p_task->>'description', ''), p_task->>'type',
      p_task->>'status', p_task->>'priority', coalesce(p_tags, '[]'::jsonb),
      nullif(p_task->>'startDate', '')::timestamptz, nullif(p_task->>'dueDate', '')::timestamptz,
      nullif(p_task->>'completedAt', '')::timestamptz, nullif(p_task->>'archivedAt', '')::timestamptz,
      coalesce(p_task->>'reminderRule', 'none'), nullif(p_task->>'progressCurrent', '')::numeric,
      nullif(p_task->>'progressTarget', '')::numeric, nullif(p_task->>'progressUnit', ''),
      coalesce((p_task->>'progressEnabled')::boolean, false), coalesce(p_task->>'progressType', 'none'),
      coalesce((p_task->>'pinnedToBottom')::boolean, false), nullif(p_task->>'parentPlanId', '')::uuid,
      nullif(p_task->>'originalImageId', '')::uuid, nullif(p_task->>'notes', '')
    );
  else
    update public.tasks set
      title = p_task->>'title', description = coalesce(p_task->>'description', ''), type = p_task->>'type',
      status = p_task->>'status', priority = p_task->>'priority', tags_json = coalesce(p_tags, '[]'::jsonb),
      "startDate" = nullif(p_task->>'startDate', '')::timestamptz,
      "dueDate" = nullif(p_task->>'dueDate', '')::timestamptz,
      "completedAt" = nullif(p_task->>'completedAt', '')::timestamptz,
      "archivedAt" = nullif(p_task->>'archivedAt', '')::timestamptz,
      "reminderRule" = coalesce(p_task->>'reminderRule', 'none'),
      "progressCurrent" = nullif(p_task->>'progressCurrent', '')::numeric,
      "progressTarget" = nullif(p_task->>'progressTarget', '')::numeric,
      "progressUnit" = nullif(p_task->>'progressUnit', ''),
      "progressEnabled" = coalesce((p_task->>'progressEnabled')::boolean, false),
      "progressType" = coalesce(p_task->>'progressType', 'none'),
      "pinnedToBottom" = coalesce((p_task->>'pinnedToBottom')::boolean, false),
      "parentPlanId" = nullif(p_task->>'parentPlanId', '')::uuid,
      "originalImageId" = nullif(p_task->>'originalImageId', '')::uuid,
      notes = nullif(p_task->>'notes', '')
    where user_id = v_user_id and id = p_task_id and "deletedAt" is null;
    if not found then raise exception 'task not found'; end if;
  end if;

  delete from public.task_tags where user_id = v_user_id and "taskId" = p_task_id;
  for v_tag_name in select value from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) loop
    if btrim(v_tag_name) = '' then raise exception 'tag name cannot be empty'; end if;
    insert into public.tags (id, user_id, name) values (gen_random_uuid(), v_user_id, btrim(v_tag_name))
      on conflict (user_id, name) do update set name = excluded.name
      returning id into v_tag_id;
    insert into public.task_tags (user_id, "taskId", "tagId") values (v_user_id, p_task_id, v_tag_id);
  end loop;

  if p_replace_subtasks then
    delete from public.subtasks where user_id = v_user_id and "taskId" = p_task_id;
    for v_subtask in select value from jsonb_array_elements(coalesce(p_subtasks, '[]'::jsonb)) loop
      if jsonb_typeof(v_subtask) <> 'object' or btrim(coalesce(v_subtask->>'title', '')) = '' then
        raise exception 'invalid subtask payload';
      end if;
      v_subtask_id := coalesce(nullif(v_subtask->>'id', '')::uuid, gen_random_uuid());
      insert into public.subtasks (id, user_id, "taskId", title, completed, "createdAt") values (
        v_subtask_id, v_user_id, p_task_id, btrim(v_subtask->>'title'),
        coalesce((v_subtask->>'completed')::boolean, false),
        coalesce(nullif(v_subtask->>'createdAt', '')::timestamptz, now())
      );
    end loop;
  end if;

  return p_task_id;
end;
$$;

create or replace function public.add_task_progress_entry_atomic(
  p_task_id uuid,
  p_entry_id uuid,
  p_entry jsonb,
  p_next_current numeric
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_entry_id is null or jsonb_typeof(p_entry) <> 'object' or p_next_current is null
    or p_next_current::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'invalid progress payload';
  end if;
  if not exists (select 1 from public.tasks where user_id = v_user_id and id = p_task_id and "deletedAt" is null) then
    raise exception 'task not found';
  end if;
  insert into public.task_progress_entries (
    id, user_id, "taskId", "amountDelta", "currentValueAfter", "durationMinutes", note
  ) values (
    p_entry_id, v_user_id, p_task_id, nullif(p_entry->>'amountDelta', '')::numeric,
    nullif(p_entry->>'currentValueAfter', '')::numeric, nullif(p_entry->>'durationMinutes', '')::numeric,
    nullif(p_entry->>'note', '')
  );
  update public.tasks set
    "progressEnabled" = true,
    "progressCurrent" = p_next_current,
    "progressTarget" = coalesce("progressTarget", 1),
    "progressUnit" = coalesce("progressUnit", ''),
    status = case when status = 'not_started' and p_next_current > 0 then 'in_progress' else status end
  where user_id = v_user_id and id = p_task_id;
  return p_entry_id;
end;
$$;

create or replace function public.pin_progress_item_atomic(p_item_id uuid) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_is_task boolean;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select exists(select 1 from public.tasks where user_id = v_user_id and id = p_item_id and "deletedAt" is null)
    into v_is_task;
  if not v_is_task and not exists(select 1 from public.progress_items where user_id = v_user_id and id = p_item_id) then
    raise exception 'progress item not found';
  end if;
  update public.tasks set "pinnedToBottom" = false where user_id = v_user_id and "pinnedToBottom";
  update public.progress_items set pinned = false where user_id = v_user_id and pinned;
  if v_is_task then
    update public.tasks set "pinnedToBottom" = true, "progressEnabled" = true where user_id = v_user_id and id = p_item_id;
  else
    update public.progress_items set pinned = true where user_id = v_user_id and id = p_item_id;
  end if;
  return true;
end;
$$;

create or replace function public.save_plan_with_relations(
  p_plan_id uuid,
  p_create boolean,
  p_plan jsonb,
  p_task_ids uuid[],
  p_item_drafts jsonb,
  p_replace_items boolean
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft jsonb;
  v_task_id uuid;
  v_task_ids uuid[] := coalesce(p_task_ids, array[]::uuid[]);
  v_sort integer := 0;
  v_completed boolean;
  v_completed_at timestamptz;
  v_tags jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_plan_id is null or jsonb_typeof(p_plan) <> 'object' then raise exception 'invalid plan payload'; end if;
  if jsonb_typeof(coalesce(p_item_drafts, '[]'::jsonb)) <> 'array' then raise exception 'invalid plan items payload'; end if;

  if p_create then
    insert into public.plans (id, user_id, title, type, "startDate", "endDate", "reflectionNote") values (
      p_plan_id, v_user_id, p_plan->>'title', p_plan->>'type',
      (p_plan->>'startDate')::date, (p_plan->>'endDate')::date, nullif(p_plan->>'reflectionNote', '')
    );
  else
    update public.plans set title = p_plan->>'title', type = p_plan->>'type',
      "startDate" = (p_plan->>'startDate')::date, "endDate" = (p_plan->>'endDate')::date,
      "reflectionNote" = nullif(p_plan->>'reflectionNote', '')
    where user_id = v_user_id and id = p_plan_id;
    if not found then raise exception 'plan not found'; end if;
  end if;

  if p_replace_items then
    for v_task_id in select unnest(v_task_ids) loop
      if not exists(select 1 from public.tasks where user_id = v_user_id and id = v_task_id and "deletedAt" is null) then
        raise exception 'plan task does not belong to the current user';
      end if;
    end loop;

    for v_draft in select value from jsonb_array_elements(coalesce(p_item_drafts, '[]'::jsonb)) loop
      if jsonb_typeof(v_draft) <> 'object' or btrim(coalesce(v_draft->>'title', '')) = '' then
        raise exception 'invalid plan item payload';
      end if;
      v_task_id := coalesce(nullif(v_draft->>'id', '')::uuid, gen_random_uuid());
      v_completed := coalesce((v_draft->>'completed')::boolean, false);
      v_completed_at := case when v_completed then now() else null end;
      v_tags := jsonb_build_array(case when p_plan->>'type' = 'daily' then 'To Do List' else p_plan->>'title' end);
      perform public.save_task_with_relations(v_task_id, true, jsonb_build_object(
        'title', btrim(v_draft->>'title'), 'description', '', 'type', 'plan_item',
        'status', case when v_completed then 'completed' else 'not_started' end,
        'priority', 'medium', 'startDate', p_plan->>'startDate',
        'dueDate', case when p_plan->>'type' = 'daily' then p_plan->>'endDate' else null end,
        'completedAt', v_completed_at, 'archivedAt', v_completed_at, 'reminderRule', 'none',
        'progressEnabled', false, 'progressType', 'none', 'pinnedToBottom', false,
        'parentPlanId', p_plan_id
      ), v_tags, '[]'::jsonb, false);
      v_task_ids := array_append(v_task_ids, v_task_id);
    end loop;

    delete from public.plan_items where user_id = v_user_id and "planId" = p_plan_id;
    foreach v_task_id in array v_task_ids loop
      insert into public.plan_items (user_id, "planId", "taskId", "sortOrder")
        values (v_user_id, p_plan_id, v_task_id, v_sort);
      v_sort := v_sort + 1;
    end loop;
  end if;

  delete from public.journal_entries
    where user_id = v_user_id and source = 'daily_plan' and "linkedPlanId" = p_plan_id;
  if p_plan->>'type' = 'daily' and btrim(coalesce(p_plan->>'reflectionNote', '')) <> '' then
    insert into public.journal_entries (id, user_id, date, source, content, "linkedPlanId") values (
      gen_random_uuid(), v_user_id, (p_plan->>'startDate')::date, 'daily_plan',
      btrim(p_plan->>'reflectionNote'), p_plan_id
    );
  end if;
  return p_plan_id;
end;
$$;

create or replace function public.delete_plan_with_journal(p_plan_id uuid) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_count integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  delete from public.journal_entries where user_id = v_user_id and "linkedPlanId" = p_plan_id;
  delete from public.plans where user_id = v_user_id and id = p_plan_id;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.save_todo_list_with_items(
  p_list_id uuid,
  p_create boolean,
  p_list jsonb,
  p_items jsonb,
  p_replace_items boolean
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_item jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_list_id is null or jsonb_typeof(p_list) <> 'object' then raise exception 'invalid todo list payload'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'invalid todo items payload'; end if;
  if p_create then
    insert into public.todo_lists (id, user_id, title, date, notes, "sourcePlanId") values (
      p_list_id, v_user_id, p_list->>'title', (p_list->>'date')::date,
      nullif(p_list->>'notes', ''), nullif(p_list->>'sourcePlanId', '')::uuid
    );
  else
    update public.todo_lists set title = p_list->>'title', date = (p_list->>'date')::date,
      notes = nullif(p_list->>'notes', '')
    where user_id = v_user_id and id = p_list_id;
    if not found then raise exception 'todo list not found'; end if;
  end if;
  if p_replace_items then
    delete from public.todo_list_items where user_id = v_user_id and "todoListId" = p_list_id;
    for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      if jsonb_typeof(v_item) <> 'object' or btrim(coalesce(v_item->>'content', '')) = '' then
        raise exception 'invalid todo item payload';
      end if;
      insert into public.todo_list_items (
        id, user_id, "todoListId", content, completed, "sortOrder", "createdAt",
        "hasScheduleTime", "scheduledStartAt", "scheduledEndAt", "scheduledTimezone",
        "parsedTimeText", "scheduleParseConfidence"
      ) values (
        (v_item->>'id')::uuid, v_user_id, p_list_id, btrim(v_item->>'content'),
        coalesce((v_item->>'completed')::boolean, false), coalesce((v_item->>'sortOrder')::integer, 0),
        coalesce(nullif(v_item->>'createdAt', '')::timestamptz, now()),
        coalesce((v_item->>'hasScheduleTime')::boolean, false),
        nullif(v_item->>'scheduledStartAt', '')::timestamptz, nullif(v_item->>'scheduledEndAt', '')::timestamptz,
        nullif(v_item->>'scheduledTimezone', ''), nullif(v_item->>'parsedTimeText', ''),
        nullif(v_item->>'scheduleParseConfidence', '')::numeric
      );
    end loop;
  end if;
  return p_list_id;
end;
$$;

create or replace function public.save_expense_with_currency(
  p_expense_id uuid,
  p_create boolean,
  p_expense jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_user_id uuid := auth.uid(); v_currency text;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_expense_id is null or jsonb_typeof(p_expense) <> 'object' then raise exception 'invalid expense payload'; end if;
  v_currency := p_expense->>'currency';
  if p_create then
    insert into public.expenses (
      id, user_id, type, title, amount, currency, category, date, merchant, "paymentMethod", notes, "receiptFileId"
    ) values (
      p_expense_id, v_user_id, p_expense->>'type', p_expense->>'title', (p_expense->>'amount')::numeric,
      v_currency, p_expense->>'category', (p_expense->>'date')::date, nullif(p_expense->>'merchant', ''),
      nullif(p_expense->>'paymentMethod', ''), nullif(p_expense->>'notes', ''),
      nullif(p_expense->>'receiptFileId', '')::uuid
    );
  else
    update public.expenses set type = p_expense->>'type', title = p_expense->>'title',
      amount = (p_expense->>'amount')::numeric, currency = v_currency, category = p_expense->>'category',
      date = (p_expense->>'date')::date, merchant = nullif(p_expense->>'merchant', ''),
      "paymentMethod" = nullif(p_expense->>'paymentMethod', ''), notes = nullif(p_expense->>'notes', ''),
      "receiptFileId" = nullif(p_expense->>'receiptFileId', '')::uuid
    where user_id = v_user_id and id = p_expense_id;
    if not found then raise exception 'expense not found'; end if;
  end if;
  insert into public.settings (user_id, key, value) values (v_user_id, 'lastUsedCurrency', v_currency)
    on conflict (user_id, key) do update set value = excluded.value, "updatedAt" = now();
  return p_expense_id;
end;
$$;

revoke all on function public.save_task_with_relations(uuid, boolean, jsonb, jsonb, jsonb, boolean) from public;
revoke all on function public.add_task_progress_entry_atomic(uuid, uuid, jsonb, numeric) from public;
revoke all on function public.pin_progress_item_atomic(uuid) from public;
revoke all on function public.save_plan_with_relations(uuid, boolean, jsonb, uuid[], jsonb, boolean) from public;
revoke all on function public.delete_plan_with_journal(uuid) from public;
revoke all on function public.save_todo_list_with_items(uuid, boolean, jsonb, jsonb, boolean) from public;
revoke all on function public.save_expense_with_currency(uuid, boolean, jsonb) from public;

grant execute on function public.save_task_with_relations(uuid, boolean, jsonb, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.add_task_progress_entry_atomic(uuid, uuid, jsonb, numeric) to authenticated;
grant execute on function public.pin_progress_item_atomic(uuid) to authenticated;
grant execute on function public.save_plan_with_relations(uuid, boolean, jsonb, uuid[], jsonb, boolean) to authenticated;
grant execute on function public.delete_plan_with_journal(uuid) to authenticated;
grant execute on function public.save_todo_list_with_items(uuid, boolean, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.save_expense_with_currency(uuid, boolean, jsonb) to authenticated;
