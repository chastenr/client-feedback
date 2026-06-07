import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import { isLocalMode, listLocalAuditLogs } from '@/lib/local-store';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    return NextResponse.json({ logs: await listLocalAuditLogs(params.id), localMode: true });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data, error } = await result.client
    .from('audit_logs')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[Kaze] Audit logs unavailable:', error.message);
    return NextResponse.json({ logs: [], needsMigration: true });
  }

  return NextResponse.json({ logs: data ?? [] });
}
