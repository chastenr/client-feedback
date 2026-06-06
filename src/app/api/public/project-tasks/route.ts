import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalProjectByToken, isLocalMode, listLocalTasks } from '@/lib/local-store';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('project_id');
  const pagePath = searchParams.get('page_path') ?? null;

  if (!token) {
    return NextResponse.json({ error: 'project_id is required.' }, { status: 400, headers: cors });
  }

  if (isLocalMode()) {
    const project = await getLocalProjectByToken(token);
    if (!project) return NextResponse.json({ tasks: [] }, { headers: cors });
    const all = await listLocalTasks(project.id);
    const tasks = pagePath ? all.filter(t => t.page_path === pagePath || t.page_url?.includes(pagePath)) : all;
    return NextResponse.json({ tasks: tasks.map(miniTask) }, { headers: cors });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .or(`public_token.eq.${token},share_token.eq.${token}`)
    .single();

  if (!project) return NextResponse.json({ tasks: [] }, { headers: cors });

  let query = supabase
    .from('feedback_tasks')
    .select('id,x,y,scroll_x,scroll_y,viewport_width,viewport_height,page_path,comment,description,reporter_name,status')
    .eq('project_id', project.id)
    .neq('status', 'done')
    .order('created_at', { ascending: true });

  if (pagePath) query = query.eq('page_path', pagePath);

  const { data } = await query;
  return NextResponse.json({ tasks: (data ?? []).map(miniTask) }, { headers: cors });
}

function miniTask(t: Record<string, unknown>) {
  return {
    id: t.id,
    x: t.x,
    y: t.y,
    scroll_x: t.scroll_x,
    scroll_y: t.scroll_y,
    viewport_width: t.viewport_width,
    viewport_height: t.viewport_height,
    page_path: t.page_path,
    comment: t.comment || t.description,
    reporter_name: t.reporter_name,
    status: t.status,
  };
}
