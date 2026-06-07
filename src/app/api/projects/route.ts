import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { createProjectSchema } from '@/lib/api/validation';
import { createLocalProject, isLocalMode, listLocalProjects } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (isLocalMode()) {
    return NextResponse.json({ projects: await listLocalProjects(), localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  if (!result.isSuperAdmin && result.user) {
    const { data: memberships, error: memberError } = await result.client
      .from('project_members')
      .select('project_id')
      .eq('user_id', result.user.id);
    if (memberError) return jsonError(memberError.message, 500);

    const projectIds = (memberships ?? []).map(member => member.project_id).filter(Boolean);
    if (projectIds.length === 0) return NextResponse.json({ projects: [] });

    const { data, error } = await result.client
      .from('projects')
      .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ projects: data ?? [] });
  }

  const { data, error } = await result.client
    .from('projects')
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .order('created_at', { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid project payload.', details: parsed.error.flatten() }, { status: 422 });
  }

  if (isLocalMode()) {
    const project = await createLocalProject({ name: parsed.data.name, websiteUrl: parsed.data.websiteUrl, clientName: parsed.data.clientName, allowedOrigin: parsed.data.allowedOrigin });
    return NextResponse.json({ project, localMode: true }, { status: 201 });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const user = result.user;
  const service = result.client;

  if (user?.id) {
    await service.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    });
  }

  const { data: project, error } = await service
    .from('projects')
    .insert({
      name: parsed.data.name,
      client_name: parsed.data.clientName || null,
      website_url: parsed.data.websiteUrl,
      allowed_origin: parsed.data.allowedOrigin || null,
      created_by: user?.id ?? null,
    })
    .select('id,name,client_name,website_url,allowed_origin,widget_last_seen_at,public_token,share_token,created_by,created_at')
    .single();

  if (error || !project) return jsonError(error?.message ?? 'Unable to create project.', 500);

  if (user?.id) {
    await service.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      role: 'owner',
    });
  }

  return NextResponse.json({ project }, { status: 201 });
}
