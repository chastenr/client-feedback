import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalProject, getLocalProjectByToken, isLocalMode, listLocalTasks } from '@/lib/local-store';

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
    const project = (await getLocalProjectByToken(token)) ?? (await getLocalProject(token));
    if (!project) return NextResponse.json({ tasks: [] }, { headers: cors });
    const all = await listLocalTasks(project.id);
    const tasks = pagePath ? all.filter(taskMatchesPage(pagePath)) : all;
    return NextResponse.json({ tasks: tasks.map(miniTask) }, { headers: cors });
  }

  const supabase = createServiceClient();
  const projectFilters = [`public_token.eq.${token}`, `share_token.eq.${token}`];
  if (isUuid(token)) projectFilters.push(`id.eq.${token}`);

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .or(projectFilters.join(','))
    .single();

  if (!project) return NextResponse.json({ tasks: [] }, { headers: cors });

  const { data } = await supabase
    .from('feedback_tasks')
    .select('id,x,y,scroll_x,scroll_y,viewport_width,viewport_height,page_path,page_url,selector,element_offset_x,element_offset_y,element_width,element_height,comment,description,reporter_name,status')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  const tasks = pagePath ? (data ?? []).filter(taskMatchesPage(pagePath)) : (data ?? []);
  return NextResponse.json({ tasks: tasks.map(miniTask) }, { headers: cors });
}

interface ProjectTaskRow {
  id?: unknown;
  x?: unknown;
  y?: unknown;
  scroll_x?: unknown;
  scroll_y?: unknown;
  viewport_width?: unknown;
  viewport_height?: unknown;
  page_path?: unknown;
  page_url?: unknown;
  selector?: unknown;
  element_offset_x?: unknown;
  element_offset_y?: unknown;
  element_width?: unknown;
  element_height?: unknown;
  comment?: unknown;
  description?: unknown;
  reporter_name?: unknown;
  status?: unknown;
}

function miniTask(t: ProjectTaskRow) {
  return {
    id: t.id,
    x: t.x,
    y: t.y,
    scroll_x: t.scroll_x,
    scroll_y: t.scroll_y,
    viewport_width: t.viewport_width,
    viewport_height: t.viewport_height,
    page_path: t.page_path,
    page_url: t.page_url,
    selector: t.selector,
    element_offset_x: t.element_offset_x,
    element_offset_y: t.element_offset_y,
    element_width: t.element_width,
    element_height: t.element_height,
    comment: t.comment || t.description,
    reporter_name: t.reporter_name,
    status: t.status,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePath(value: unknown) {
  if (!value) return '';

  let path = String(value);
  try {
    path = new URL(path, 'https://example.com').pathname;
  } catch {
    path = path.split('?')[0]?.split('#')[0] ?? '';
  }

  if (!path.startsWith('/')) path = `/${path}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function taskMatchesPage<T extends ProjectTaskRow>(pagePath: string) {
  const currentPath = normalizePath(pagePath);
  return (task: T) => {
    const savedPath = normalizePath(task.page_path);
    const savedUrlPath = normalizePath(task.page_url);
    return savedPath === currentPath || savedUrlPath === currentPath;
  };
}
