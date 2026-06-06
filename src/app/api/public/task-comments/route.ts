import { NextResponse } from 'next/server';
import { createServiceClient, getAppOrigin, getUserDisplayName, requireProjectAccess } from '@/lib/supabase/server';
import { isLocalMode, getLocalTask, getLocalTaskComments, createLocalComment } from '@/lib/local-store';
import { sendSlackNotification } from '@/lib/slack';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('task_id');
  if (!taskId) {
    return NextResponse.json({ error: 'task_id is required.' }, { status: 400, headers: cors });
  }

  if (isLocalMode()) {
    const task = await getLocalTask(taskId);
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });
    const comments = await getLocalTaskComments(taskId);
    return NextResponse.json({ task, comments }, { headers: cors });
  }

  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from('feedback_tasks')
    .select('id,project_id,comment,description,reporter_name,reporter_email,page_url,page_path,status,created_at')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });

  const access = await requireProjectAccess(request, task.project_id);
  if (access instanceof NextResponse) {
    return NextResponse.json(await access.json(), { status: access.status, headers: cors });
  }

  const { data: comments } = await supabase
    .from('task_comments')
    .select('id,message,created_at,user_id,author_name')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  const userIds = Array.from(new Set((comments ?? []).map(comment => comment.user_id).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id,full_name,username,email').in('id', userIds)
    : { data: [] };
  const profileNames = new Map(
    (profiles ?? []).map(profile => [
      profile.id,
      profile.full_name || profile.username || profile.email || 'Client',
    ]),
  );
  const commentsWithNames = (comments ?? []).map(comment => ({
    ...comment,
    author_name: comment.author_name || (comment.user_id ? profileNames.get(comment.user_id) : null) || 'Client',
  }));

  return NextResponse.json({ task, comments: commentsWithNames }, { headers: cors });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const taskId = typeof body?.task_id === 'string' ? body.task_id : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!taskId || !message) {
    return NextResponse.json({ error: 'task_id and message are required.' }, { status: 400, headers: cors });
  }

  if (isLocalMode()) {
    const comment = await createLocalComment(taskId, message, 'Client');
    if (!comment) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });
    return NextResponse.json({ comment }, { status: 201, headers: cors });
  }

  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from('feedback_tasks')
    .select('id,project_id,page_url,page_path,comment,description,title')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });

  const access = await requireProjectAccess(request, task.project_id);
  if (access instanceof NextResponse) {
    return NextResponse.json(await access.json(), { status: access.status, headers: cors });
  }

  const authorName = await getUserDisplayName(supabase, access.user);

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: access.user.id, author_name: authorName, message })
    .select('*')
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? 'Unable to add comment.' }, { status: 500, headers: cors });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name, website_url')
    .eq('id', task.project_id)
    .maybeSingle();

  await sendSlackNotification({
    type: 'comment',
    projectName: project?.name,
    projectUrl: project?.website_url,
    taskId,
    taskUrl: `${getAppOrigin(request)}/dashboard/tasks/${taskId}`,
    pageUrl: task.page_url,
    pagePath: task.page_path,
    authorName,
    message,
  });

  return NextResponse.json({ comment }, { status: 201, headers: cors });
}
