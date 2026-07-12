begin;

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');

create table if not exists public.developer_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username text,
  email text,
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  status text not null default 'unread' check (status in ('unread', 'read', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_messages_status_time
  on public.developer_messages(status, created_at desc);
create index if not exists developer_messages_user_time
  on public.developer_messages(user_id, created_at desc);

alter table public.developer_messages enable row level security;
alter table public.developer_messages force row level security;
revoke all on table public.developer_messages from public, anon, authenticated;
grant all on table public.developer_messages to service_role;

drop trigger if exists developer_messages_set_updated_at on public.developer_messages;
create trigger developer_messages_set_updated_at
before update on public.developer_messages
for each row execute function public.set_updated_at_snake();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if requested_username is null or requested_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'A valid username is required';
  end if;

  insert into public.profiles (user_id, username, display_name)
  values (new.id, requested_username, requested_username);

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

comment on column public.profiles.username is
  'Globally unique, case-insensitive login name. Auth trigger is the trusted creation boundary.';
comment on table public.developer_messages is
  'No direct client access. Public submission and admin management go through controlled server APIs.';

commit;
