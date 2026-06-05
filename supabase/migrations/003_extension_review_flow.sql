alter table public.projects
  add column if not exists client_name text,
  add column if not exists share_token text;

update public.projects
set share_token = public_token
where share_token is null;

alter table public.projects
  alter column share_token set default encode(gen_random_bytes(24), 'hex');

create unique index if not exists projects_share_token_key
on public.projects(share_token);

alter table public.feedback_tasks
  add column if not exists page_path text,
  add column if not exists element_text text,
  add column if not exists comment text;

update public.feedback_tasks
set comment = description
where comment is null and description is not null;
