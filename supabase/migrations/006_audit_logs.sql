create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  project_name text,
  task_id uuid,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_project_id_created_at_idx
  on public.audit_logs(project_id, created_at desc);

create index if not exists audit_logs_action_created_at_idx
  on public.audit_logs(action, created_at desc);
