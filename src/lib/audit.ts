import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface AuditLog {
  id: string;
  project_id: string | null;
  project_name: string | null;
  task_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditInput {
  projectId?: string | null;
  projectName?: string | null;
  taskId?: string | null;
  user?: User | null;
  actorName?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(client: SupabaseClient, input: AuditInput) {
  const { error } = await client.from('audit_logs').insert({
    project_id: input.projectId ?? null,
    project_name: input.projectName ?? null,
    task_id: input.taskId ?? null,
    actor_id: input.user?.id ?? null,
    actor_name: input.actorName || input.user?.user_metadata?.full_name || input.user?.email || 'System',
    actor_email: input.user?.email ?? null,
    action: input.action,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn('[Kaze] Audit log skipped:', error.message);
  }
}
