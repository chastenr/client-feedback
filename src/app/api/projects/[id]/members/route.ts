import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { projectMemberSchema } from '@/lib/api/validation';
import { getAdminClient, getAppOrigin, jsonError } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function memberAccessError(message: string, status = 500) {
  if (/bearer token|jwt|not authorized|invalid api key|invalid token/i.test(message)) {
    return jsonError('Supabase service role key is missing or invalid. Set SUPABASE_SERVICE_ROLE_KEY in Vercel to the project service_role secret, then redeploy.', 503);
  }
  return jsonError(message, status);
}

async function findAuthUserByEmail(client: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 100;

  while (page <= 20) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };

    const user = data.users.find((candidate: User) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < perPage) return { user: user ?? null, error: null };
    page += 1;
  }

  return { user: null, error: null };
}

async function ensureProject(client: SupabaseClient, id: string) {
  const { data } = await client.from('projects').select('id,name').eq('id', id).single();
  return data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const project = await ensureProject(result.client, params.id);
  if (!project) return jsonError('Project not found.', 404);

  const { data, error } = await result.client
    .from('project_members')
    .select('id,project_id,user_id,role,created_at,profiles(id,email,full_name,username)')
    .eq('project_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = projectMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid member invite payload.', details: parsed.error.flatten() }, { status: 422 });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const project = await ensureProject(result.client, params.id);
  if (!project) return jsonError('Project not found.', 404);

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName || null;

  const { data: existingProfile } = await result.client
    .from('profiles')
    .select('id,email')
    .eq('email', email)
    .maybeSingle();

  let userId = existingProfile?.id ?? null;
  let invited = false;

  if (!userId) {
    const { user, error: lookupError } = await findAuthUserByEmail(result.client, email);
    if (lookupError) return memberAccessError(lookupError.message);
    userId = user?.id ?? null;
  }

  if (!userId) {
    const { data: invitedUser, error: inviteError } = await result.client.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${getAppOrigin(request)}/login`,
    });
    if (inviteError || !invitedUser.user) {
      return memberAccessError(inviteError?.message ?? 'Unable to invite member.');
    }
    userId = invitedUser.user.id;
    invited = true;
  }

  const { error: profileError } = await result.client.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    role: parsed.data.role,
  });
  if (profileError) return memberAccessError(profileError.message);

  const { data: member, error: memberError } = await result.client
    .from('project_members')
    .upsert({
      project_id: params.id,
      user_id: userId,
      role: parsed.data.role,
    }, { onConflict: 'project_id,user_id' })
    .select('id,project_id,user_id,role,created_at,profiles(id,email,full_name,username)')
    .single();

  if (memberError || !member) return jsonError(memberError?.message ?? 'Unable to add member.', 500);

  return NextResponse.json({ member, invited }, { status: invited ? 201 : 200 });
}
