import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isLocalMode, getLocalTask, getLocalTaskComments, createLocalComment } from '@/lib/local-store';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    .select('id,comment,description,reporter_name,reporter_email,page_url,page_path,status,created_at')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });

  const { data: comments } = await supabase
    .from('task_comments')
    .select('id,message,created_at,user_id')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  return NextResponse.json({ task, comments: comments ?? [] }, { headers: cors });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const taskId = typeof body?.task_id === 'string' ? body.task_id : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!taskId || !message) {
    return NextResponse.json({ error: 'task_id and message are required.' }, { status: 400, headers: cors });
  }

  if (isLocalMode()) {
    const comment = await createLocalComment(taskId, message);
    if (!comment) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });
    return NextResponse.json({ comment }, { status: 201, headers: cors });
  }

  const supabase = createServiceClient();

  const { data: task } = await supabase
    .from('feedback_tasks')
    .select('id')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: cors });

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: null, message })
    .select('*')
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? 'Unable to add comment.' }, { status: 500, headers: cors });
  }

  return NextResponse.json({ comment }, { status: 201, headers: cors });
}
