import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { getLocalProject, isLocalMode } from '@/lib/local-store';

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

  const { data, error } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .eq('id', params.id)
    .single();

  if (error || !data) return jsonError('Project not found.', 404);
  return NextResponse.json({ project: data });
}
