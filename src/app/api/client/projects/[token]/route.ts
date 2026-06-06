import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const result = await getAuthenticatedClient(request);
  if (result instanceof NextResponse) return result;

  const { data: project } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,public_token,share_token')
    .or(`share_token.eq.${params.token},public_token.eq.${params.token}`)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  const { data: membership } = await result.client
    .from('project_members')
    .select('id')
    .eq('project_id', project.id)
    .eq('user_id', result.user.id)
    .eq('role', 'viewer')
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: 'You do not have access to this client project.' }, { status: 403 });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      client_name: project.client_name ?? null,
      website_url: project.website_url,
      review_token: project.share_token ?? project.public_token,
    },
  });
}
