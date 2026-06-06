import { NextResponse } from 'next/server';
import { getAdminClient, getAppOrigin, jsonError } from '@/lib/supabase/server';
import { isSlackConfigured, sendSlackNotification } from '@/lib/slack';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  return NextResponse.json({
    configured: isSlackConfigured(),
  });
}

export async function POST(request: Request) {
  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  if (!isSlackConfigured()) {
    return jsonError('Slack is not configured. Add SLACK_WEBHOOK_URL in Vercel environment variables, then redeploy.', 400);
  }

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body?.projectId === 'string' ? body.projectId : null;
  let projectName = 'Kaze Snippet';
  let projectUrl = getAppOrigin(request);

  if (projectId) {
    const { data: project } = await result.client
      .from('projects')
      .select('name, website_url')
      .eq('id', projectId)
      .maybeSingle();

    projectName = project?.name || projectName;
    projectUrl = project?.website_url || projectUrl;
  }

  const sent = await sendSlackNotification({
    type: 'feedback',
    projectName,
    projectUrl,
    taskId: 'test',
    taskUrl: `${getAppOrigin(request)}/dashboard`,
    pageUrl: projectUrl,
    pagePath: '/test-notification',
    authorName: result.user?.email || 'Admin',
    message: 'This is a test Slack notification from Kaze Snippet.',
  });

  if (!sent.ok) {
    return jsonError(sent.error || 'Slack test failed.', 502);
  }

  return NextResponse.json({ ok: true });
}
