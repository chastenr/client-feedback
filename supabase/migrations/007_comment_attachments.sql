alter table public.task_comments
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

notify pgrst, 'reload schema';
