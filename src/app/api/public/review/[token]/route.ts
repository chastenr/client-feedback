import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getLocalProjectByToken, isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  if (isLocalMode()) {
    const project = await getLocalProjectByToken(params.token);
    if (!project) return NextResponse.json({ error: 'Review link not found.' }, { status: 404, headers: corsHeaders });
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        client_name: project.client_name ?? null,
        website_url: project.website_url,
        review_token: project.share_token ?? project.public_token,
      },
      localMode: true,
    }, { headers: corsHeaders });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,client_name,website_url,public_token,share_token')
    .or(`share_token.eq.${params.token},public_token.eq.${params.token}`)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Review link not found.' }, { status: 404, headers: corsHeaders });
  return NextResponse.json({
    project: {
      id: data.id,
      name: data.name,
      client_name: data.client_name ?? null,
      website_url: data.website_url,
      review_token: data.share_token ?? data.public_token,
    },
  }, { headers: corsHeaders });
}
