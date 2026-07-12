-- Phase 6 follow-up: expose an owner-scoped retry preparation step for visible pending deletes.

create or replace function public.prepare_pending_file_delete(p_file_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_file public.uploaded_files%rowtype;
  v_refs bigint;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select * into v_file from public.uploaded_files
    where user_id = v_user_id and id = p_file_id and status = 'pending_delete' for update;
  if not found then return jsonb_build_object('cleanup', false); end if;
  select
    (select count(*) from public.important_files where user_id = v_user_id and "fileId" = p_file_id) +
    (select count(*) from public.expenses where user_id = v_user_id and "receiptFileId" = p_file_id)
  into v_refs;
  if v_refs > 0 then raise exception 'pending file still has business references'; end if;
  return jsonb_build_object(
    'cleanup', true, 'fileId', p_file_id, 'bucket', v_file.bucket, 'objectPath', v_file.object_path
  );
end;
$$;

revoke all on function public.prepare_pending_file_delete(uuid) from public, anon;
grant execute on function public.prepare_pending_file_delete(uuid) to authenticated, service_role;
