import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { getAdminClient, getUserDisplayName, jsonError } from '@/lib/supabase/server';
import { createLocalAuditLog, getLocalTask, isLocalMode, updateLocalComment } from '@/lib/local-store';

export const runtime = 'nodejs';

function relationProjectName(value: unknown) {
  const project = Array.isArray(value) ? value[0] : value;
  return typeof project === 'object' && project !== null && 'name' in project && typeof project.name === 'string'
    ? project.name
    : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return jsonError('Comment is required.', 422);

  if (isLocalMode()) {
    const comment = await updateLocalComment(params.id, params.commentId, message);
    if (!comment) return jsonError('Comment not found.', 404);
    const task = await getLocalTask(params.id);
    if (task) {
      await createLocalAuditLog({
        project_id: task.project_id,
        project_name: task.projects?.name ?? null,
        task_id: task.id,
        actor_id: null,
        actor_name: 'Admin',
        actor_email: null,
        action: 'comment_updated',
        summary: 'Admin edited a comment.',
        metadata: { comment_id: params.commentId },
      });
    }
    return NextResponse.json({ comment, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: before } = await result.client
    .from('task_comments')
    .select('id,task_id,message,user_id')
    .eq('id', params.commentId)
    .eq('task_id', params.id)
    .maybeSingle();
  if (!before) return jsonError('Comment not found.', 404);

  const { data: task } = await result.client
    .from('feedback_tasks')
    .select('id,project_id,projects(name)')
    .eq('id', params.id)
    .maybeSingle();

  const { data, error } = await result.client
    .from('task_comments')
    .update({ message, updated_at: new Date().toISOString() })
    .eq('id', params.commentId)
    .eq('task_id', params.id)
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to update comment.', 500);

  const actorName = result.user ? await getUserDisplayName(result.client, result.user) : 'Admin';
  if (task) {
    await recordAuditLog(result.client, {
      projectId: task.project_id,
      projectName: relationProjectName(task.projects),
      taskId: task.id,
      user: result.user,
      actorName,
      action: 'comment_updated',
      summary: `${actorName} edited a comment.`,
      metadata: { comment_id: params.commentId, before: before.message, after: message },
    });
  }

  return NextResponse.json({ comment: data });
}
