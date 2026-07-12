-- Phase 6: owner-scoped file metadata and compensating Storage lifecycle.

begin;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id in ('receipts', 'important-files');

create index if not exists uploaded_files_owner_status
  on public.uploaded_files(user_id, status, "updatedAt");

create or replace function public.save_expense_with_currency(
  p_expense_id uuid,
  p_create boolean,
  p_expense jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency text;
  v_receipt_id uuid := nullif(p_expense->>'receiptFileId', '')::uuid;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_expense_id is null or jsonb_typeof(p_expense) <> 'object' then raise exception 'invalid expense payload'; end if;
  if v_receipt_id is not null and not exists (
    select 1 from public.uploaded_files
    where user_id = v_user_id and id = v_receipt_id and bucket = 'receipts' and status = 'uploaded'
  ) then raise exception 'receipt file not found or unavailable'; end if;
  v_currency := p_expense->>'currency';
  if p_create then
    insert into public.expenses (
      id, user_id, type, title, amount, currency, category, date, merchant, "paymentMethod", notes, "receiptFileId"
    ) values (
      p_expense_id, v_user_id, p_expense->>'type', p_expense->>'title', (p_expense->>'amount')::numeric,
      v_currency, p_expense->>'category', (p_expense->>'date')::date, nullif(p_expense->>'merchant', ''),
      nullif(p_expense->>'paymentMethod', ''), nullif(p_expense->>'notes', ''), v_receipt_id
    );
  else
    update public.expenses set type = p_expense->>'type', title = p_expense->>'title',
      amount = (p_expense->>'amount')::numeric, currency = v_currency, category = p_expense->>'category',
      date = (p_expense->>'date')::date, merchant = nullif(p_expense->>'merchant', ''),
      "paymentMethod" = nullif(p_expense->>'paymentMethod', ''), notes = nullif(p_expense->>'notes', ''),
      "receiptFileId" = v_receipt_id
    where user_id = v_user_id and id = p_expense_id;
    if not found then raise exception 'expense not found'; end if;
  end if;
  if v_receipt_id is not null then
    update public.uploaded_files set "linkedEntityType" = 'expense', "linkedEntityId" = p_expense_id
      where user_id = v_user_id and id = v_receipt_id;
  end if;
  insert into public.settings (user_id, key, value) values (v_user_id, 'lastUsedCurrency', v_currency)
    on conflict (user_id, key) do update set value = excluded.value, "updatedAt" = now();
  return p_expense_id;
end;
$$;

create or replace function public.save_important_file(
  p_important_id uuid,
  p_input jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_id uuid := nullif(p_input->>'fileId', '')::uuid;
  v_tags jsonb := coalesce(p_input->'tags', '[]'::jsonb);
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_important_id is null or jsonb_typeof(p_input) <> 'object' or btrim(coalesce(p_input->>'title', '')) = '' then
    raise exception 'invalid important file payload';
  end if;
  if jsonb_typeof(v_tags) <> 'array' then raise exception 'invalid important file tags'; end if;
  if not exists (
    select 1 from public.uploaded_files
    where user_id = v_user_id and id = v_file_id and bucket = 'important-files' and status = 'uploaded'
  ) then raise exception 'uploaded file not found or unavailable'; end if;

  insert into public.important_files (
    id, user_id, title, category, tags_json, notes, "fileId", "expiryDate"
  ) values (
    p_important_id, v_user_id, btrim(p_input->>'title'), coalesce(nullif(p_input->>'category', ''), '其他'),
    v_tags, nullif(p_input->>'notes', ''), v_file_id, nullif(p_input->>'expiryDate', '')::date
  )
  on conflict (id) do update set
    title = excluded.title,
    category = excluded.category,
    tags_json = excluded.tags_json,
    notes = excluded.notes,
    "expiryDate" = excluded."expiryDate"
  where important_files.user_id = v_user_id and important_files."fileId" = v_file_id;
  if not found then raise exception 'important file not found'; end if;

  update public.uploaded_files
  set "linkedEntityType" = 'important_file', "linkedEntityId" = p_important_id
  where user_id = v_user_id and id = v_file_id;
  return p_important_id;
end;
$$;

create or replace function public.mark_unreferenced_file_for_delete(p_file_id uuid)
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
  select * into v_file from public.uploaded_files where user_id = v_user_id and id = p_file_id for update;
  if not found then return jsonb_build_object('cleanup', false); end if;
  select
    (select count(*) from public.important_files where user_id = v_user_id and "fileId" = p_file_id) +
    (select count(*) from public.expenses where user_id = v_user_id and "receiptFileId" = p_file_id)
  into v_refs;
  if v_refs > 0 or v_file.status <> 'uploaded' then return jsonb_build_object('cleanup', false, 'fileId', p_file_id); end if;
  update public.uploaded_files set status = 'pending_delete' where user_id = v_user_id and id = p_file_id;
  return jsonb_build_object('cleanup', true, 'fileId', p_file_id, 'bucket', v_file.bucket, 'objectPath', v_file.object_path);
end;
$$;

create or replace function public.detach_important_file_for_delete(p_important_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_id uuid;
  v_cleanup jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select "fileId" into v_file_id from public.important_files
    where user_id = v_user_id and id = p_important_id for update;
  if not found then return jsonb_build_object('deleted', false, 'cleanup', false); end if;
  delete from public.important_files where user_id = v_user_id and id = p_important_id;
  v_cleanup := public.mark_unreferenced_file_for_delete(v_file_id);
  return v_cleanup || jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.detach_expense_for_delete(p_expense_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_id uuid;
  v_cleanup jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  select "receiptFileId" into v_file_id from public.expenses
    where user_id = v_user_id and id = p_expense_id for update;
  if not found then return jsonb_build_object('deleted', false, 'cleanup', false); end if;
  delete from public.expenses where user_id = v_user_id and id = p_expense_id;
  if v_file_id is null then return jsonb_build_object('deleted', true, 'cleanup', false); end if;
  v_cleanup := public.mark_unreferenced_file_for_delete(v_file_id);
  return v_cleanup || jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.save_important_file(uuid, jsonb) from public, anon;
revoke all on function public.mark_unreferenced_file_for_delete(uuid) from public, anon;
revoke all on function public.detach_important_file_for_delete(uuid) from public, anon;
revoke all on function public.detach_expense_for_delete(uuid) from public, anon;
grant execute on function public.save_important_file(uuid, jsonb) to authenticated, service_role;
grant execute on function public.mark_unreferenced_file_for_delete(uuid) to authenticated, service_role;
grant execute on function public.detach_important_file_for_delete(uuid) to authenticated, service_role;
grant execute on function public.detach_expense_for_delete(uuid) to authenticated, service_role;

commit;
