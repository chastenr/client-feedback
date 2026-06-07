alter table public.task_comments
  add column if not exists previous_message text;

notify pgrst, 'reload schema';
