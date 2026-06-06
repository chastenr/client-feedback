export const TASK_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'ready_for_review',
  'done',
] as const;

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  ready_for_review: 'Ready for Review',
  done: 'Done',
};

export interface Project {
  id: string;
  name: string;
  client_name?: string | null;
  website_url: string;
  allowed_origin?: string | null;
  widget_last_seen_at?: string | null;
  public_token: string;
  share_token?: string;
  created_by: string | null;
  created_at: string;
}

export interface FeedbackTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  comment?: string | null;
  page_url: string;
  page_path?: string | null;
  page_title: string | null;
  selector: string | null;
  element_text?: string | null;
  x: number;
  y: number;
  element_offset_x: number | null;
  element_offset_y: number | null;
  element_width: number | null;
  element_height: number | null;
  scroll_x: number;
  scroll_y: number;
  viewport_width: number;
  viewport_height: number;
  screenshot_url: string | null;
  attachment_url?: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  user_agent: string | null;
  console_errors?: unknown[];
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  last_editor_name?: string | null;
  last_editor_at?: string | null;
  last_editor_message?: string | null;
  created_at: string;
  updated_at: string;
  projects?: Pick<Project, 'id' | 'name' | 'website_url' | 'public_token' | 'share_token'>;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  author_name: string | null;
  message: string;
  created_at: string;
}
