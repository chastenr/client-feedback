import { NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const result = await getAuthenticatedClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('project_members')
    .select('role,projects(id,name,client_name,website_url,public_token,share_token,created_at)')
    .eq('user_id', result.user.id)
    .eq('role', 'viewer')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projects = (data ?? [])
    .map(row => Array.isArray(row.projects) ? row.projects[0] : row.projects)
    .filter(Boolean);

  return NextResponse.json({ projects });
}
