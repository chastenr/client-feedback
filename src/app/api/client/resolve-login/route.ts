import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const resolveLoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(3).max(180),
});

export async function POST(request: Request) {
  const parsed = resolveLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid username or email.' }, { status: 422 });
  }

  const identifier = parsed.data.identifier;
  if (identifier.includes('@')) {
    return NextResponse.json({ email: identifier });
  }

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json({ error: 'Username login is not configured yet. Use your email instead.' }, { status: 503 });
  }

  const { data, error } = await service
    .from('profiles')
    .select('email')
    .eq('username', identifier)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Username login is not ready yet. Run the username migration or use email.' }, { status: 503 });
  }

  if (!data?.email) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  return NextResponse.json({ email: data.email });
}
