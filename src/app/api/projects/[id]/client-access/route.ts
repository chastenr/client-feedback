import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { clientAccessSchema } from '@/lib/api/validation';
import { getAdminClient, jsonError } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = clientAccessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid client account payload.', details: parsed.error.flatten() }, { status: 422 });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: project } = await result.client
    .from('projects')
    .select('id,name')
    .eq('id', params.id)
    .single();

  if (!project) return jsonError('Project not found.', 404);

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName || null;
  let userId: string | null = null;

  const { data: existingProfile } = await result.client
    .from('profiles')
    .select('id,email')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile?.id) {
    const existingUserId = existingProfile.id;
    userId = existingUserId;

    const { error: updateError } = await result.client.auth.admin.updateUserById(existingUserId, {
      password: parsed.data.password,
      user_metadata: { full_name: fullName },
    });
    if (updateError) return jsonError(updateError.message, 500);
  } else {
    const { data: created, error: createError } = await result.client.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.user) {
      userId = created.user.id;
    } else if (createError) {
      const { user: authUser, error: lookupError } = await findAuthUserByEmail(result.client, email);
      if (lookupError) return jsonError(lookupError.message, 500);
      if (!authUser) return jsonError(createError.message, 500);

      const { error: updateError } = await result.client.auth.admin.updateUserById(authUser.id, {
        password: parsed.data.password,
        user_metadata: { full_name: fullName },
      });
      if (updateError) return jsonError(updateError.message, 500);

      userId = authUser.id;
    }
  }

  if (!userId) return jsonError('Unable to create client account.', 500);

  const { error: profileError } = await result.client.from('profiles').upsert({
    id: userId,
    email,
    full_name: fullName,
    role: 'viewer',
  });
  if (profileError) return jsonError(profileError.message, 500);

  const { error: memberError } = await result.client
    .from('project_members')
    .upsert({
      project_id: params.id,
      user_id: userId,
      role: 'viewer',
    }, { onConflict: 'project_id,user_id' });

  if (memberError) return jsonError(memberError.message, 500);

  return NextResponse.json({
    client: {
      id: userId,
      email,
      full_name: fullName,
      role: 'viewer',
      project_id: params.id,
    },
  }, { status: 201 });
}
