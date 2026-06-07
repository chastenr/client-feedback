import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { getAdminClient, getUserDisplayName, jsonError } from '@/lib/supabase/server';
import { commentSchema } from '@/lib/api/validation';
import { createLocalAuditLog, createLocalComment, getLocalTask, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

function relationProjectName(value: unknown) {
  const project = Array.isArray(value) ? value[0] : value;
  return typeof project === 'object' && project !== null && 'name' in project && typeof project.name === 'string'
    ? project.name
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid comment.', 422);

  if (isLocalMode()) {
    const comment = await createLocalComment(params.id, parsed.data.message, 'Admin', {
      url: parsed.data.attachmentUrl,
      name: parsed.data.attachmentName,
      type: parsed.data.attachmentType,
    });
    if (!comment) return jsonError('Task not found.', 404);
    const task = await getLocalTask(params.id);
    if (task) {
      await createLocalAuditLog({
        project_id: task.project_id,
        project_name: task.projects?.name ?? null,
        task_id: task.id,
        actor_id: null,
        actor_name: 'Admin',
        actor_email: null,
        action: 'comment_added',
        summary: parsed.data.attachmentUrl ? 'Admin added a comment with an attachment.' : 'Admin commented on a task.',
        metadata: { message: parsed.data.message, attachment_url: parsed.data.attachmentUrl ?? null },
      });
    }
    return NextResponse.json({ comment, localMode: true }, { status: 201 });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const authorName = result.user ? await getUserDisplayName(result.client, result.user) : 'Admin';
  const { data: task } = await result.client
    .from('feedback_tasks')
    .select('id,project_id,title,comment,description,projects(name)')
    .eq('id', params.id)
    .maybeSingle();

  const { data, error } = await result.client
    .from('task_comments')
    .insert({
      task_id: params.id,
      user_id: result.user?.id ?? null,
      author_name: authorName,
      message: parsed.data.message,
      attachment_url: parsed.data.attachmentUrl ?? null,
      attachment_name: parsed.data.attachmentName ?? null,
      attachment_type: parsed.data.attachmentType ?? null,
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to add comment.', 500);
  if (task) {
    await recordAuditLog(result.client, {
      projectId: task.project_id,
      projectName: relationProjectName(task.projects),
      taskId: task.id,
      user: result.user,
      actorName: authorName,
      action: 'comment_added',
      summary: parsed.data.attachmentUrl
        ? `${authorName} added a comment with an attachment.`
        : `${authorName} commented on a task.`,
      metadata: { message: parsed.data.message, attachment_url: parsed.data.attachmentUrl ?? null },
    });
  }
  return NextResponse.json({ comment: data }, { status: 201 });
}
