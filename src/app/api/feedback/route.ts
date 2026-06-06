import { NextResponse } from 'next/server';
import { createServiceClient, jsonError } from '@/lib/supabase/server';
import { widgetFeedbackSchema } from '@/lib/api/validation';
import { createLocalTask, getLocalProjectByToken, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function extensionFromType(contentType: string) {
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('svg')) return 'svg';
  return 'png';
}

export async function POST(request: Request) {
  const parsed = widgetFeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback payload.', details: parsed.error.flatten() }, { status: 422, headers: corsHeaders });
  }

  const { project_id, comment, reporter_name, reporter_email, page_url, page_path, selector, element_text, x, y, scroll_x, scroll_y, viewport_width, viewport_height, user_agent, screenshot } = parsed.data;

  const title = comment.slice(0, 80) + (comment.length > 80 ? '…' : '');

  if (isLocalMode()) {
    const project = await getLocalProjectByToken(project_id);
    if (!project) {
      return NextResponse.json({ error: 'Invalid project ID.' }, { status: 404, headers: corsHeaders });
    }
    const task = await createLocalTask({
      projectToken: project_id,
      title,
      description: comment,
      pageUrl: page_url,
      pagePath: page_path ?? null,
      pageTitle: null,
      selector: selector ?? null,
      elementText: element_text ?? null,
      x,
      y,
      elementOffsetX: null,
      elementOffsetY: null,
      elementWidth: null,
      elementHeight: null,
      scrollX: scroll_x,
      scrollY: scroll_y,
      viewportWidth: viewport_width,
      viewportHeight: viewport_height,
      screenshot: screenshot ?? null,
      browser: null,
      os: null,
      device: null,
      userAgent: user_agent ?? null,
      consoleErrors: [],
      priority: 'medium',
      reporterName: reporter_name ?? null,
      reporterEmail: reporter_email ?? null,
    });
    if (!task) {
      return NextResponse.json({ error: 'Invalid project ID.' }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({ id: task.id, localMode: true }, { status: 201, headers: corsHeaders });
  }

  const supabase = createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, allowed_origin')
    .or(`public_token.eq.${project_id},share_token.eq.${project_id}`)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: `Project ID "${project_id}" was not found. Make sure the data-project-id attribute on your widget script tag is correct.` },
      { status: 404, headers: corsHeaders },
    );
  }

  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (project.allowed_origin && origin) {
    try {
      const requestOrigin = new URL(origin).origin;
      const allowedOrigin = project.allowed_origin.startsWith('http')
        ? new URL(project.allowed_origin).origin
        : project.allowed_origin;
      if (requestOrigin !== allowedOrigin) {
        return NextResponse.json(
          { error: `This domain (${requestOrigin}) is not authorised to submit feedback for this project. Add it as the allowed domain in your project settings.` },
          { status: 403, headers: corsHeaders },
        );
      }
    } catch {
      // URL parsing failed — skip origin check rather than block
    }
  }

  let screenshotUrl: string | null = screenshot ?? null;
  if (screenshot) {
    const image = dataUrlToBuffer(screenshot);
    if (image) {
      const ext = extensionFromType(image.contentType);
      const filePath = `${project.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('feedback-screenshots')
        .upload(filePath, image.buffer, { contentType: image.contentType, upsert: false });
      if (uploadError) {
        console.error('[Kaze] Screenshot upload failed:', uploadError.message);
      } else {
        const { data } = supabase.storage.from('feedback-screenshots').getPublicUrl(filePath);
        screenshotUrl = data.publicUrl;
      }
    }
  }

  const { data: task, error: insertError } = await supabase
    .from('feedback_tasks')
    .insert({
      project_id: project.id,
      title,
      description: comment,
      comment,
      page_url,
      page_path: page_path ?? null,
      page_title: null,
      selector: selector ?? null,
      element_text: element_text ?? null,
      x,
      y,
      element_offset_x: null,
      element_offset_y: null,
      element_width: null,
      element_height: null,
      scroll_x,
      scroll_y,
      viewport_width,
      viewport_height,
      screenshot_url: screenshotUrl,
      browser: null,
      os: null,
      device: null,
      user_agent: user_agent ?? null,
      console_errors: [],
      status: 'backlog',
      priority: 'medium',
      reporter_name: reporter_name ?? null,
      reporter_email: reporter_email ?? null,
    })
    .select('id')
    .single();

  if (insertError || !task) {
    const detail = insertError?.message ?? 'Unknown database error';
    console.error('[Kaze] Supabase insert failed:', detail);
    return NextResponse.json(
      { error: `Feedback could not be saved. ${detail}. Check your Supabase table schema and service role key.` },
      { status: 500, headers: corsHeaders },
    );
  }

  return NextResponse.json({ id: task.id, screenshotUrl }, { status: 201, headers: corsHeaders });
}
