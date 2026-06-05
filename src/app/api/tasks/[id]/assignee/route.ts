import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { assigneeSchema } from '@/lib/api/validation';
import { isLocalMode, updateLocalTask } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = assigneeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid assignee.', 422);

  if (isLocalMode()) {
    const task = await updateLocalTask(params.id, { assignee_id: parsed.data.assigneeId });
    if (!task) return jsonError('Task not found.', 404);
    return NextResponse.json({ task, localMode: true });
  }

  const result = getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('feedback_tasks')
    .update({ assignee_id: parsed.data.assigneeId })
    .eq('id', params.id)
    .select('*, projects(id,name,website_url,public_token)')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to update assignee.', 500);
  return NextResponse.json({ task: data });
}
