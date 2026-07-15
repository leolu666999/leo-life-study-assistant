-- Keep checklist completion and count progress in one owner-scoped transaction.
create or replace function public.update_checklist_subtask_atomic(
  p_subtask_id uuid,
  p_completed boolean
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_subtask jsonb;
  v_task_id uuid;
  v_completed_count numeric;
  v_total_count numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.subtasks
  set completed = p_completed, "updatedAt" = now()
  where user_id = v_user_id and id = p_subtask_id
  returning to_jsonb(subtasks.*), "taskId" into v_subtask, v_task_id;

  if v_subtask is null then return null; end if;

  select count(*) filter (where completed), count(*)
  into v_completed_count, v_total_count
  from public.subtasks
  where user_id = v_user_id and "taskId" = v_task_id;

  update public.tasks
  set status = case when status = 'not_started' then 'in_progress' else status end,
      "progressCurrent" = case
        when type = 'checklist' and "progressEnabled" and "progressType" = 'count' then v_completed_count
        else "progressCurrent"
      end,
      "progressTarget" = case
        when type = 'checklist' and "progressEnabled" and "progressType" = 'count' then v_total_count
        else "progressTarget"
      end,
      "progressUnit" = case
        when type = 'checklist' and "progressEnabled" and "progressType" = 'count' then '项'
        else "progressUnit"
      end,
      "updatedAt" = now()
  where user_id = v_user_id and id = v_task_id and "deletedAt" is null;

  return v_subtask;
end;
$$;

revoke all on function public.update_checklist_subtask_atomic(uuid, boolean) from public;
grant execute on function public.update_checklist_subtask_atomic(uuid, boolean) to authenticated;