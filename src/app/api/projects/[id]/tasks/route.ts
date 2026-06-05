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

  const result = getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('feedback_tasks')
    .select('*, projects(id,name,website_url,public_token,share_token)')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ tasks: data ?? [] });
}
