begin;

insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('important-files', 'important-files', false)
on conflict (id) do update set public = false;

create policy receipts_select_own
on storage.objects for select to authenticated
using (bucket_id = 'receipts' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy receipts_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy receipts_update_own
on storage.objects for update to authenticated
using (bucket_id = 'receipts' and split_part(name, '/', 1) = (select auth.uid())::text)
with check (bucket_id = 'receipts' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy receipts_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy important_files_select_own
on storage.objects for select to authenticated
using (bucket_id = 'important-files' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy important_files_insert_own
on storage.objects for insert to authenticated
with check (bucket_id = 'important-files' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy important_files_update_own
on storage.objects for update to authenticated
using (bucket_id = 'important-files' and split_part(name, '/', 1) = (select auth.uid())::text)
with check (bucket_id = 'important-files' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy important_files_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'important-files' and split_part(name, '/', 1) = (select auth.uid())::text);

commit;
