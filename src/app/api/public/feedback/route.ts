import { NextResponse } from 'next/server';
import { createServiceClient, getUserDisplayName, jsonError, requireProjectAccess } from '@/lib/supabase/server';
import { publicFeedbackSchema } from '@/lib/api/validation';
import { createLocalTask, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  const parsed = publicFeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid feedback payload.', details: parsed.error.flatten() }, { status: 422, headers: corsHeaders });
  }

  const payload = parsed.data;
  const projectToken = payload.projectToken ?? payload.reviewToken;
  const comment = payload.comment ?? payload.description ?? null;

  if (isLocalMode()) {
    const task = await createLocalTask({
      projectToken: projectToken!,
      title: payload.title,
      description: comment,
      pageUrl: payload.pageUrl,
      pagePath: payload.pagePath || null,
      pageTitle: payload.pageTitle || null,
      selector: payload.selector || null,
      elementText: payload.elementText || null,
      x: payload.x,
      y: payload.y,
      elementOffsetX: payload.elementOffsetX,
      elementOffsetY: payload.elementOffsetY,
      elementWidth: payload.elementWidth,
      elementHeight: payload.elementHeight,
      scrollX: payload.scrollX,
      scrollY: payload.scrollY,
      viewportWidth: payload.viewportWidth,
      viewportHeight: payload.viewportHeight,
      screenshot: payload.screenshot,
      browser: payload.browser || null,
      os: payload.os || null,
      device: payload.device || null,
      userAgent: payload.userAgent || null,
      consoleErrors: payload.consoleErrors,
      priority: payload.priority,
      reporterName: payload.reporterName || null,
      reporterEmail: payload.reporterEmail || null,
    });
    if (!task) {
      return NextResponse.json({ error: 'Invalid project token.' }, { status: 404, headers: corsHeaders });
    }
    return NextResponse.json({ id: task.id, screenshotUrl: task.screenshot_url, localMode: true }, { status: 201, headers: corsHeaders });
  }

  const supabase = createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .or(`public_token.eq.${projectToken},share_token.eq.${projectToken}`)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Invalid project token.' }, { status: 404, headers: corsHeaders });
  }

  const access = await requireProjectAccess(request, project.id);
  if (access instanceof NextResponse) {
    return NextResponse.json(await access.json(), { status: access.status, headers: corsHeaders });
  }
  const reporterName = await getUserDisplayName(supabase, access.user);
  const reporterEmail = access.user.email ?? null;

  let screenshotUrl: string | null = payload.screenshot ?? null;

  if (payload.screenshot) {
    const image = dataUrlToBuffer(payload.screenshot);
    if (image) {
      const ext = extensionFromType(image.contentType);
      const filePath = `${project.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('feedback-screenshots')
        .upload(filePath, image.buffer, {
          contentType: image.contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[Gomega] Screenshot upload failed:', uploadError.message);
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
      title: payload.title,
      description: comment,
      comment,
      page_url: payload.pageUrl,
      page_path: payload.pagePath || null,
      page_title: payload.pageTitle || null,
      selector: payload.selector || null,
      element_text: payload.elementText || null,
      x: payload.x,
      y: payload.y,
      element_offset_x: payload.elementOffsetX ?? null,
      element_offset_y: payload.elementOffsetY ?? null,
      element_width: payload.elementWidth ?? null,
      element_height: payload.elementHeight ?? null,
      scroll_x: payload.scrollX,
      scroll_y: payload.scrollY,
      viewport_width: payload.viewportWidth,
      viewport_height: payload.viewportHeight,
      screenshot_url: screenshotUrl,
      browser: payload.browser || null,
      os: payload.os || null,
      device: payload.device || null,
      user_agent: payload.userAgent || null,
      console_errors: payload.consoleErrors,
      status: 'backlog',
      priority: payload.priority,
      reporter_name: reporterName,
      reporter_email: reporterEmail,
    })
    .select('id')
    .single();

  if (insertError || !task) {
    return NextResponse.json({ error: insertError?.message ?? 'Unable to save feedback.' }, { status: 500, headers: corsHeaders });
  }

  return NextResponse.json({ id: task.id, screenshotUrl, reporterName }, { status: 201, headers: corsHeaders });
}
