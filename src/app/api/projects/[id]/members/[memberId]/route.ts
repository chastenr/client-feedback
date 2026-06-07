import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } },
) {
  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  if (!result.isSuperAdmin && result.user) {
    const { data: requester } = await result.client
      .from('project_members')
      .select('role')
      .eq('project_id', params.id)
      .eq('user_id', result.user.id)
      .maybeSingle();
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return jsonError('Project admin access required.', 403);
    }
  }

  const { data: member } = await result.client
    .from('project_members')
    .select('id,role')
    .eq('id', params.memberId)
    .eq('project_id', params.id)
    .maybeSingle();

  if (!member) return jsonError('Member not found.', 404);
  if (member.role === 'owner') return jsonError('Project owner cannot be removed here.', 403);

  const { error } = await result.client
    .from('project_members')
    .delete()
    .eq('id', params.memberId)
    .eq('project_id', params.id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
