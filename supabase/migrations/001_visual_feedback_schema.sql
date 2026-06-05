create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'member'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text not null,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  api_key text generated always as (public_token) stored,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.feedback_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  page_url text not null,
  page_title text,
  selector text,
  x numeric not null,
  y numeric not null,
  element_offset_x numeric,
  element_offset_y numeric,
  element_width numeric,
  element_height numeric,
  scroll_x numeric not null default 0,
  scroll_y numeric not null default 0,
  viewport_width integer not null,
  viewport_height integer not null,
  screenshot_url text,
  browser text,
  os text,
  device text,
  user_agent text,
  console_errors jsonb not null default '[]'::jsonb,
  status text not null default 'backlog' check (status in ('backlog', 'todo', 'in_progress', 'ready_for_review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.profiles(id) on delete set null,
  reporter_name text,
  reporter_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.feedback_tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.feedback_tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_members_user_id on public.project_members(user_id);
create index if not exists idx_feedback_tasks_project_status on public.feedback_tasks(project_id, status);
create index if not exists idx_feedback_tasks_created_at on public.feedback_tasks(created_at desc);
create index if not exists idx_task_comments_task_id on public.task_comments(task_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_tasks_set_updated_at on public.feedback_tasks;
create trigger feedback_tasks_set_updated_at
before update on public.feedback_tasks
for each row execute function public.set_updated_at();

create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_uuid
      and pm.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.feedback_tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can read projects" on public.projects;
create policy "Members can read projects"
on public.projects for select
to authenticated
using (public.is_project_member(id));

drop policy if exists "Authenticated users can create projects" on public.projects;
create policy "Authenticated users can create projects"
on public.projects for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Owners and admins can update projects" on public.projects;
create policy "Owners and admins can update projects"
on public.projects for update
to authenticated
using (
  exists (
    select 1 from public.project_members pm
    where pm.project_id = id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin')
  )
);

drop policy if exists "Members can read project membership" on public.project_members;
create policy "Members can read project membership"
on public.project_members for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "Owners and admins can manage project membership" on public.project_members;
create policy "Owners and admins can manage project membership"
on public.project_members for all
to authenticated
using (
  exists (
    select 1 from public.project_members pm
    where pm.project_id = project_members.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.project_members pm
    where pm.project_id = project_members.project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'admin')
  )
);

drop policy if exists "Members can read feedback" on public.feedback_tasks;
create policy "Members can read feedback"
on public.feedback_tasks for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "Members can update feedback" on public.feedback_tasks;
create policy "Members can update feedback"
on public.feedback_tasks for update
to authenticated
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "Widget can insert feedback for existing project" on public.feedback_tasks;
-- Public feedback is inserted through /api/public/feedback with the service role
-- after validating projects.public_token. Do not allow direct anon table inserts.

drop policy if exists "Members can read comments" on public.task_comments;
create policy "Members can read comments"
on public.task_comments for select
to authenticated
using (
  exists (
    select 1 from public.feedback_tasks ft
    where ft.id = task_comments.task_id
      and public.is_project_member(ft.project_id)
  )
);

drop policy if exists "Members can create comments" on public.task_comments;
create policy "Members can create comments"
on public.task_comments for insert
to authenticated
with check (
  exists (
    select 1 from public.feedback_tasks ft
    where ft.id = task_comments.task_id
      and public.is_project_member(ft.project_id)
  )
);

drop policy if exists "Members can read activity" on public.activity_logs;
create policy "Members can read activity"
on public.activity_logs for select
to authenticated
using (
  exists (
    select 1 from public.feedback_tasks ft
    where ft.id = activity_logs.task_id
      and public.is_project_member(ft.project_id)
  )
);

drop policy if exists "Members can create activity" on public.activity_logs;
create policy "Members can create activity"
on public.activity_logs for insert
to authenticated
with check (
  exists (
    select 1 from public.feedback_tasks ft
    where ft.id = activity_logs.task_id
      and public.is_project_member(ft.project_id)
  )
);

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', true)
on conflict (id) do nothing;
