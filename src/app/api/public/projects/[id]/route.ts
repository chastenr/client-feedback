import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalProject, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const project = await getLocalProject(params.id);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        client_name: project.client_name ?? null,
        website_url: project.website_url,
        public_token: project.public_token,
        share_token: project.share_token ?? project.public_token,
      },
      localMode: true,
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,client_name,website_url,public_token,share_token')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  return NextResponse.json({ project: data });
}
