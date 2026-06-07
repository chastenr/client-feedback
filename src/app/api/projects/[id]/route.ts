import { NextResponse } from 'next/server';
import { sendProjectDeletedEmail } from '@/lib/email';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { deleteLocalProject, getLocalProject, isLocalMode } from '@/lib/local-store';
import { sendSlackNotification } from '@/lib/slack';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const project = await getLocalProject(params.id);
    if (!project) return jsonError('Project not found.', 404);
    return NextResponse.json({ project, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .eq('id', params.id)
    .single();

  if (error || !data) return jsonError('Project not found.', 404);
  return NextResponse.json({ project: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const deleted = await deleteLocalProject(params.id);
    if (!deleted) return jsonError('Project not found.', 404);
    return NextResponse.json({ ok: true, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: project } = await result.client
    .from('projects')
    .select('id,name,website_url')
    .eq('id', params.id)
    .maybeSingle();

  if (!project) return jsonError('Project not found.', 404);
  const deletedAt = new Date().toISOString();
  const deletedBy = result.user?.email || 'Admin';

  const { data: tasks } = await result.client
    .from('feedback_tasks')
    .select('id')
    .eq('project_id', params.id);
  const taskIds = (tasks ?? []).map(task => task.id);

  if (taskIds.length > 0) {
    const { error: commentsError } = await result.client
      .from('task_comments')
      .delete()
      .in('task_id', taskIds);
    if (commentsError) return jsonError(commentsError.message, 500);
  }

  const { error: tasksError } = await result.client
    .from('feedback_tasks')
    .delete()
    .eq('project_id', params.id);
  if (tasksError) return jsonError(tasksError.message, 500);

  const { error: membersError } = await result.client
    .from('project_members')
    .delete()
    .eq('project_id', params.id);
  if (membersError) return jsonError(membersError.message, 500);

  const { error: projectError } = await result.client
    .from('projects')
    .delete()
    .eq('id', params.id);
  if (projectError) return jsonError(projectError.message, 500);

  await Promise.allSettled([
    sendSlackNotification({
      type: 'project_deleted',
      projectName: project.name,
      projectUrl: project.website_url,
      authorName: deletedBy,
      deletedAt,
      message: `${deletedBy} deleted ${project.name}. Removed ${taskIds.length} task${taskIds.length === 1 ? '' : 's'} and related comments/members.`,
    }),
    sendProjectDeletedEmail({
      projectName: project.name,
      projectUrl: project.website_url,
      deletedBy,
      deletedAt,
      taskCount: taskIds.length,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
