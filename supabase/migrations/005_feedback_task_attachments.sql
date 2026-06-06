alter table public.feedback_tasks
  add column if not exists attachment_url text;

notify pgrst, 'reload schema';
