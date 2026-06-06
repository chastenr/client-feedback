import { NextResponse } from 'next/server';
import { createServiceClient, requireProjectAccess } from '@/lib/supabase/server';
import { isLocalMode } from '@/lib/local-store';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400, headers: cors });
  }

  const projectId = String(formData.get('project_id') ?? '');
  const file = formData.get('file') as File | null;

  if (!projectId || !file) {
    return NextResponse.json({ error: 'project_id and file are required.' }, { status: 400, headers: cors });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 50 MB.' }, { status: 413, headers: cors });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415, headers: cors });
  }

  if (isLocalMode()) {
    return NextResponse.json({ error: 'File upload requires Supabase storage. Add SUPABASE_SERVICE_ROLE_KEY to enable it.' }, { status: 503, headers: cors });
  }

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .or(`public_token.eq.${projectId},share_token.eq.${projectId}`)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404, headers: cors });
  }

  const access = await requireProjectAccess(request, project.id);
  if (access instanceof NextResponse) {
    return NextResponse.json(await access.json(), { status: access.status, headers: cors });
  }

  const ext = extFromType(file.type);
  const filePath = `${project.id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('feedback-screenshots')
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[Kaze] Attachment upload failed:', uploadError.message);
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500, headers: cors });
  }

  const { data } = supabase.storage.from('feedback-screenshots').getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl }, { status: 201, headers: cors });
}

function extFromType(mime: string) {
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  return 'bin';
}
