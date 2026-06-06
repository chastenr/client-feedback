import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type AdminMode = 'user' | 'service-dev';

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
    return { client: createServiceClient(), mode: 'user', user: data.user };
  }

  if (process.env.ADMIN_AUTH_DISABLED === 'true') {
    return { client: createServiceClient(), mode: 'service-dev', user: null };
  }

  return jsonError('Admin login required.', 401);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
