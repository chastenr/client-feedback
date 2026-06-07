import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit';
import { getAdminClient, getUserDisplayName, jsonError } from '@/lib/supabase/server';
import { statusSchema } from '@/lib/api/validation';
import { createLocalAuditLog, isLocalMode, updateLocalTask } from '@/lib/local-store';

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
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid status.', 422);

  if (isLocalMode()) {
    const task = await updateLocalTask(params.id, { status: parsed.data.status });
    if (!task) return jsonError('Task not found.', 404);
    await createLocalAuditLog({
      project_id: task.project_id,
      project_name: task.projects?.name ?? null,
      task_id: task.id,
      actor_id: null,
      actor_name: 'Admin',
      actor_email: null,
      action: 'task_status_changed',
      summary: `Admin moved task to ${task.status}.`,
      metadata: { after_status: task.status },
    });
    return NextResponse.json({ task, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: before } = await result.client
    .from('feedback_tasks')
    .select('id,project_id,status,title,comment,description,projects(name)')
    .eq('id', params.id)
    .maybeSingle();

  const { data, error } = await result.client
    .from('feedback_tasks')
    .update({ status: parsed.data.status })
    .eq('id', params.id)
    .select('*, projects(id,name,website_url,public_token)')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to update status.', 500);
  const actorName = result.user ? await getUserDisplayName(result.client, result.user) : 'Admin';
  await recordAuditLog(result.client, {
    projectId: data.project_id,
    projectName: relationProjectName(data.projects),
    taskId: data.id,
    user: result.user,
    actorName,
    action: 'task_status_changed',
    summary: `${actorName} moved task from ${before?.status ?? 'unknown'} to ${data.status}.`,
    metadata: { before_status: before?.status, after_status: data.status },
  });
  return NextResponse.json({ task: data });
}
