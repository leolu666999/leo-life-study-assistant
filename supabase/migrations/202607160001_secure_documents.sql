create table if not exists public.secure_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  content text not null default '',
  category text not null default '其他',
  tags_json jsonb not null default '[]'::jsonb check (jsonb_typeof(tags_json) = 'array'),
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (user_id, id),
  check (char_length(content) <= 200000)
);

create index if not exists secure_documents_owner_updated
  on public.secure_documents(user_id, "updatedAt" desc);

alter table public.secure_documents enable row level security;
alter table public.secure_documents force row level security;

create policy secure_documents_select_own on public.secure_documents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy secure_documents_insert_own on public.secure_documents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy secure_documents_update_own on public.secure_documents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy secure_documents_delete_own on public.secure_documents
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.secure_documents to authenticated;
grant all on public.secure_documents to service_role;
