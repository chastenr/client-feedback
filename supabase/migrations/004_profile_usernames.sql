alter table public.profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9._-]{3,40}$');
  end if;
end $$;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

notify pgrst, 'reload schema';
