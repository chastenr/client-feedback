import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { updateTaskSchema } from '@/lib/api/validation';
import { getLocalTask, getLocalTaskComments, isLocalMode, updateLocalTask } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const task = await getLocalTask(params.id);
    if (!task) return jsonError('Task not found.', 404);
    return NextResponse.json({ task, comments: await getLocalTaskComments(params.id), localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: task, error } = await result.client
    .from('feedback_tasks')
    .select('*, projects(id,name,website_url,public_token,share_token)')
    .eq('id', params.id)
    .single();

  if (error || !task) return jsonError('Task not found.', 404);

  const { data: comments } = await result.client
    .from('task_comments')
    .select('*')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ task, comments: comments ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = updateTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid task payload.', details: parsed.error.flatten() }, { status: 422 });
  }

  if (isLocalMode()) {
    const task = await updateLocalTask(params.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignee_id: parsed.data.assigneeId,
    });
    if (!task) return jsonError('Task not found.', 404);
    return NextResponse.json({ task, localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.assigneeId !== undefined) updates.assignee_id = parsed.data.assigneeId;

  const { data, error } = await result.client
    .from('feedback_tasks')
    .update(updates)
    .eq('id', params.id)
    .select('*, projects(id,name,website_url,public_token,share_token)')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to update task.', 500);
  return NextResponse.json({ task: data });
}
