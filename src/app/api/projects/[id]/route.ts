import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { sendProjectDeletedEmail } from '@/lib/email';
import { getAdminClient, getUserDisplayName, jsonError } from '@/lib/supabase/server';
import { updateProjectSchema } from '@/lib/api/validation';
import { createLocalAuditLog, deleteLocalProject, getLocalProject, isLocalMode, updateLocalProject } from '@/lib/local-store';
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

  if (!result.isSuperAdmin && result.user) {
    const { data: membership } = await result.client
      .from('project_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('user_id', result.user.id)
      .maybeSingle();
    if (!membership) return jsonError('You do not have access to this project.', 403);
  }

  const { data, error } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .eq('id', params.id)
    .single();

  if (error || !data) return jsonError('Project not found.', 404);
  return NextResponse.json({ project: data, isSuperAdmin: result.isSuperAdmin });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid project payload.', details: parsed.error.flatten() }, { status: 422 });
  }

  if (isLocalMode()) {
    const before = await getLocalProject(params.id);
    const project = await updateLocalProject(params.id, parsed.data);
    if (!project) return jsonError('Project not found.', 404);
    await createLocalAuditLog({
      project_id: project.id,
      project_name: project.name,
      task_id: null,
      actor_id: null,
      actor_name: 'Admin',
      actor_email: null,
      action: 'project_updated',
      summary: `Project settings updated${before?.website_url !== project.website_url ? ` from ${before?.website_url} to ${project.website_url}` : ''}.`,
      metadata: { before, after: project },
    });
    return NextResponse.json({ project, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  if (!result.isSuperAdmin && result.user) {
    const { data: membership } = await result.client
      .from('project_members')
      .select('id,role')
      .eq('project_id', params.id)
      .eq('user_id', result.user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return jsonError('Project admin access required.', 403);
    }
  }

  const { data: before } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,allowed_origin')
    .eq('id', params.id)
    .maybeSingle();
  if (!before) return jsonError('Project not found.', 404);

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.clientName !== undefined) updates.client_name = parsed.data.clientName || null;
  if (parsed.data.websiteUrl !== undefined) updates.website_url = parsed.data.websiteUrl;
  if (parsed.data.allowedOrigin !== undefined) updates.allowed_origin = parsed.data.allowedOrigin || null;

  const { data, error } = await result.client
    .from('projects')
    .update(updates)
    .eq('id', params.id)
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to update project.', 500);
  const actorName = result.user ? await getUserDisplayName(result.client, result.user) : 'Admin';
  await recordAuditLog(result.client, {
    projectId: data.id,
    projectName: data.name,
    user: result.user,
    actorName,
    action: before.website_url !== data.website_url ? 'project_url_changed' : 'project_updated',
    summary: before.website_url !== data.website_url
      ? `${actorName} changed website URL from ${before.website_url} to ${data.website_url}.`
      : `${actorName} updated project settings.`,
    metadata: { before, after: data },
  });
  return NextResponse.json({ project: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const project = await getLocalProject(params.id);
    const deleted = await deleteLocalProject(params.id);
    if (!deleted) return jsonError('Project not found.', 404);
    await createLocalAuditLog({
      project_id: params.id,
      project_name: project?.name ?? null,
      task_id: null,
      actor_id: null,
      actor_name: 'Admin',
      actor_email: null,
      action: 'project_deleted',
      summary: `Admin deleted ${project?.name ?? 'project'}.`,
      metadata: { project },
    });
    return NextResponse.json({ ok: true, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  if (!result.isSuperAdmin && result.user) {
    const { data: membership } = await result.client
      .from('project_members')
      .select('id,role')
      .eq('project_id', params.id)
      .eq('user_id', result.user.id)
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return jsonError('Project admin access required.', 403);
    }
  }

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

  await recordAuditLog(result.client, {
    projectId: params.id,
    projectName: project.name,
    user: result.user,
    actorName: deletedBy,
    action: 'project_deleted',
    summary: `${deletedBy} deleted ${project.name}.`,
    metadata: { website_url: project.website_url, task_count: taskIds.length },
  });

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
