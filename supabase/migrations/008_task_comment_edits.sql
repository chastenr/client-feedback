alter table public.task_comments
  add column if not exists updated_at timestamptz;

notify pgrst, 'reload schema';
