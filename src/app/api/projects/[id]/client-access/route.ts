import { NextResponse } from 'next/server';
import { clientAccessSchema } from '@/lib/api/validation';
import { getAdminClient, jsonError } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
  let userId: string | null = null;

  const { data: existingProfile } = await result.client
    .from('profiles')
    .select('id,email')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile?.id) {
    userId = existingProfile.id;
  } else {
    const { data: created, error: createError } = await result.client.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName || null },
    });

    if (createError || !created.user) {
      return jsonError(createError?.message ?? 'Unable to create client account.', 500);
    }

    userId = created.user.id;
  }

  await result.client.from('profiles').upsert({
    id: userId,
    email,
    full_name: parsed.data.fullName || null,
    role: 'viewer',
  });

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
      full_name: parsed.data.fullName || null,
      role: 'viewer',
      project_id: params.id,
    },
  }, { status: 201 });
}
