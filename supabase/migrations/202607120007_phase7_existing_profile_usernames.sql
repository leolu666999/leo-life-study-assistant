begin;

update public.profiles
set username = 'user_' || left(replace(user_id::text, '-', ''), 12),
    updated_at = now()
where username is null;

alter table public.profiles alter column username set not null;

commit;
