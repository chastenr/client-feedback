import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { commentSchema } from '@/lib/api/validation';
import { createLocalComment, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid comment.', 422);

  if (isLocalMode()) {
    const comment = await createLocalComment(params.id, parsed.data.message);
    if (!comment) return jsonError('Task not found.', 404);
    return NextResponse.json({ comment, localMode: true }, { status: 201 });
  }

  const result = getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: userData } = result.mode === 'user'
    ? await result.client.auth.getUser()
    : { data: { user: null } };

  const { data, error } = await result.client
    .from('task_comments')
    .insert({
      task_id: params.id,
      user_id: userData.user?.id ?? null,
      message: parsed.data.message,
    })
    .select('*')
    .single();

  if (error || !data) return jsonError(error?.message ?? 'Unable to add comment.', 500);
  return NextResponse.json({ comment: data }, { status: 201 });
}
