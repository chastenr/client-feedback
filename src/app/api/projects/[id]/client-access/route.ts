import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { clientAccessSchema } from '@/lib/api/validation';
import { getAdminClient, jsonError } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function clientAccessError(message: string, status = 500) {
  if (/bearer token|jwt|not authorized|invalid api key|invalid token/i.test(message)) {
    return jsonError('Supabase service role key is missing or invalid. Set SUPABASE_SERVICE_ROLE_KEY in Vercel to the project service_role secret, then redeploy.', 503);
  }
  return jsonError(message, status);
}

function isMissingProfileRole(message: string) {
  return /role.*profiles|profiles.*role|schema cache/i.test(message);
}

function isMissingProfileUsername(message: string) {
  return /username.*profiles|profiles.*username|schema cache/i.test(message);
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
  const username = parsed.data.username?.trim().toLowerCase() || null;
  const fullName = parsed.data.fullName || null;
  let userId: string | null = null;

  if (username) {
    const { data: existingUsername, error: usernameError } = await result.client
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (usernameError && !isMissingProfileUsername(usernameError.message)) {
      return clientAccessError(usernameError.message);
    }
    if (existingUsername?.id) {
      const { data: profileForEmail } = await result.client
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (!profileForEmail?.id || profileForEmail.id !== existingUsername.id) {
        return jsonError('That username is already used by another client.', 409);
      }
    }
  }

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
    if (updateError) return clientAccessError(updateError.message);
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
      if (lookupError) return clientAccessError(lookupError.message);
      if (!authUser) return clientAccessError(createError.message);

      const { error: updateError } = await result.client.auth.admin.updateUserById(authUser.id, {
        password: parsed.data.password,
        user_metadata: { full_name: fullName },
      });
      if (updateError) return clientAccessError(updateError.message);

      userId = authUser.id;
    }
  }

  if (!userId) return jsonError('Unable to create client account.', 500);

  const profilePayload = {
    id: userId,
    email,
    full_name: fullName,
    username,
    role: 'viewer',
  };
  const { error: profileError } = await result.client.from('profiles').upsert(profilePayload);
  if (profileError) {
    if (!isMissingProfileRole(profileError.message) && !isMissingProfileUsername(profileError.message)) {
      return clientAccessError(profileError.message);
    }

    const { error: fallbackProfileError } = await result.client.from('profiles').upsert({
      id: userId,
      email,
      full_name: fullName,
    });
    if (fallbackProfileError) return clientAccessError(fallbackProfileError.message);
  }

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
      username,
      full_name: fullName,
      role: 'viewer',
      project_id: params.id,
    },
  }, { status: 201 });
}
