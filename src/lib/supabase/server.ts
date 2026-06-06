import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type AdminMode = 'user' | 'service-dev';
type AuthMode = 'user';

export function getAppOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (request) return new URL(request.url).origin;
  return 'http://localhost:3000';
}

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return url;
}

export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return key;
}

export function getSupabaseServiceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return key;
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function serviceRoleConfigError() {
  return jsonError('Supabase service role key is missing or invalid. Set SUPABASE_SERVICE_ROLE_KEY in Vercel to the project service_role secret, then redeploy.', 503);
}

export function getBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

export async function getAdminClient(request: Request): Promise<{ client: SupabaseClient; mode: AdminMode; user: User | null } | NextResponse> {
  const token = getBearerToken(request);
  if (token) {
    const userClient = createUserClient(token);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) return jsonError('Admin login required.', 401);
    let service: SupabaseClient;
    try {
      service = createServiceClient();
    } catch {
      return serviceRoleConfigError();
    }
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profileError && profile?.role === 'viewer') return jsonError('Admin access required.', 403);

    const { data: memberships } = await service
      .from('project_members')
      .select('role')
      .eq('user_id', data.user.id);
    if (memberships?.length && memberships.every(member => member.role === 'viewer')) {
      return jsonError('Admin access required.', 403);
    }

    return { client: service, mode: 'user', user: data.user };
  }

  if (process.env.ADMIN_AUTH_DISABLED === 'true') {
    try {
      return { client: createServiceClient(), mode: 'service-dev', user: null };
    } catch {
      return serviceRoleConfigError();
    }
  }

  return jsonError('Admin login required.', 401);
}

export async function getAuthenticatedClient(request: Request): Promise<{ client: SupabaseClient; mode: AuthMode; user: User } | NextResponse> {
  const token = getBearerToken(request);
  if (!token) return jsonError('Login required.', 401);

  const userClient = createUserClient(token);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return jsonError('Login required.', 401);

  try {
    return { client: createServiceClient(), mode: 'user', user: data.user };
  } catch {
    return serviceRoleConfigError();
  }
}

export async function requireProjectAccess(request: Request, projectId: string) {
  const result = await getAuthenticatedClient(request);
  if (result instanceof NextResponse) return result;

  const { data } = await result.client
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', result.user.id)
    .maybeSingle();

  if (!data) return jsonError('You do not have access to this project.', 403);
  return result;
}

export async function getUserDisplayName(client: SupabaseClient, user: User) {
  const fallback = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Client';

  const { data } = await client
    .from('profiles')
    .select('full_name,username,email')
    .eq('id', user.id)
    .maybeSingle();

  return data?.full_name || data?.username || data?.email || fallback;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
