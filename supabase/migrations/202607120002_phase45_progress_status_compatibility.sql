-- Keep the pre-transaction repository behavior: a zero-value progress update
-- enables progress tracking but does not move a Task out of not_started.
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

revoke all on function public.add_task_progress_entry_atomic(uuid, uuid, jsonb, numeric) from public;
grant execute on function public.add_task_progress_entry_atomic(uuid, uuid, jsonb, numeric) to authenticated;
