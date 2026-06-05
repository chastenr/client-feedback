import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalProjectByToken, isLocalMode, updateLocalProjectWidgetSeen } from '@/lib/local-store';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  let body: { project_id?: string; page_url?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders });
  }

  const { project_id, page_url } = body;

  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required.' }, { status: 400, headers: corsHeaders });
  }

  if (isLocalMode()) {
    const project = await getLocalProjectByToken(project_id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404, headers: corsHeaders });
    }
    await updateLocalProjectWidgetSeen(project_id);
    return NextResponse.json({ ok: true, localMode: true }, { headers: corsHeaders });
  }

  const supabase = createServiceClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .or(`public_token.eq.${project_id},share_token.eq.${project_id}`)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404, headers: corsHeaders });
  }

  await supabase
    .from('projects')
    .update({ widget_last_seen_at: new Date().toISOString(), widget_last_seen_url: page_url ?? null })
    .eq('id', project.id);

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
