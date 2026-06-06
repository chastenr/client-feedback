import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { isLocalMode, listLocalTasks } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    return NextResponse.json({ tasks: await listLocalTasks(params.id), localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('feedback_tasks')
    .select('*, projects(id,name,website_url,public_token,share_token)')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);

  const tasks = data ?? [];
  const taskIds = tasks.map(task => task.id);
  if (taskIds.length === 0) return NextResponse.json({ tasks });

  const { data: members } = await result.client
    .from('project_members')
    .select('user_id, role')
    .eq('project_id', params.id)
    .in('role', ['owner', 'admin', 'member']);
  const editorIds = new Set((members ?? []).map(member => member.user_id).filter(Boolean));

  const { data: comments } = editorIds.size
    ? await result.client
      .from('task_comments')
      .select('task_id,user_id,author_name,message,created_at')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })
    : { data: [] };

  const latestEditorByTask = new Map<string, {
    author_name: string | null;
    message: string | null;
    created_at: string;
  }>();

  for (const comment of comments ?? []) {
    if (!comment.task_id || latestEditorByTask.has(comment.task_id)) continue;
    if (!comment.user_id || !editorIds.has(comment.user_id)) continue;
    latestEditorByTask.set(comment.task_id, {
      author_name: comment.author_name ?? null,
      message: comment.message ?? null,
      created_at: comment.created_at,
    });
  }

  return NextResponse.json({
    tasks: tasks.map(task => {
      const latestEditor = latestEditorByTask.get(task.id);
      return {
        ...task,
        last_editor_name: latestEditor?.author_name ?? null,
        last_editor_at: latestEditor?.created_at ?? null,
        last_editor_message: latestEditor?.message ?? null,
      };
    }),
  });
}
