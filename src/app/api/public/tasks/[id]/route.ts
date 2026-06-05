import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalTask, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const task = await getLocalTask(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({
      id: task.id,
      title: task.title,
      description: task.description,
      comment: task.comment ?? task.description,
      selector: task.selector,
      elementText: task.element_text ?? null,
      x: Number(task.x),
      y: Number(task.y),
      elementOffsetX: task.element_offset_x === null ? null : Number(task.element_offset_x),
      elementOffsetY: task.element_offset_y === null ? null : Number(task.element_offset_y),
      elementWidth: task.element_width === null ? null : Number(task.element_width),
      elementHeight: task.element_height === null ? null : Number(task.element_height),
      scrollX: Number(task.scroll_x),
      scrollY: Number(task.scroll_y),
      viewportWidth: task.viewport_width,
      viewportHeight: task.viewport_height,
      screenshotUrl: task.screenshot_url,
      pageUrl: task.page_url,
      pagePath: task.page_path ?? null,
      projectId: task.project_id,
      projectToken: task.projects?.public_token,
      localMode: true,
    }, { headers: corsHeaders });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('feedback_tasks')
    .select(`
      id,
      title,
      description,
      comment,
      selector,
      element_text,
      x,
      y,
      element_offset_x,
      element_offset_y,
      element_width,
      element_height,
      scroll_x,
      scroll_y,
      viewport_width,
      viewport_height,
      screenshot_url,
      page_url,
      page_path,
      project_id,
      projects!inner(public_token)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404, headers: corsHeaders });
  }

  const row = data as any;
  const projectToken = Array.isArray(row.projects)
    ? row.projects[0]?.public_token
    : row.projects?.public_token;

  return NextResponse.json({
    id: data.id,
    title: data.title,
    description: data.description,
    comment: row.comment ?? data.description,
    selector: data.selector,
    elementText: row.element_text ?? null,
    x: Number(data.x),
    y: Number(data.y),
    elementOffsetX: data.element_offset_x === null ? null : Number(data.element_offset_x),
    elementOffsetY: data.element_offset_y === null ? null : Number(data.element_offset_y),
    elementWidth: data.element_width === null ? null : Number(data.element_width),
    elementHeight: data.element_height === null ? null : Number(data.element_height),
    scrollX: Number(data.scroll_x),
    scrollY: Number(data.scroll_y),
    viewportWidth: data.viewport_width,
    viewportHeight: data.viewport_height,
    screenshotUrl: data.screenshot_url,
    pageUrl: data.page_url,
    pagePath: row.page_path ?? null,
    projectId: data.project_id,
    projectToken,
  }, { headers: corsHeaders });
}
