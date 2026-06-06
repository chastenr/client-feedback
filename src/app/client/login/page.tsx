'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function ClientLoginPage() {
  return (
    <Suspense fallback={<ClientLoginFallback />}>
      <ClientLoginContent />
    </Suspense>
  );
}

function ClientLoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 text-sm text-stone-400">
      Loading client login...
    </main>
  );
}

function ClientLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nextPath = searchParams.get('next') || '/client/portal';

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath);
    });
  }, [nextPath, router, supabase]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!supabase) {
      setError('Client login is not configured yet.');
      return;
    }

    setLoading(true);
    const loginName = identifier.trim().toLowerCase();
    let email = loginName;
    if (!loginName.includes('@')) {
      const response = await fetch('/api/client/resolve-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoading(false);
        setError(data.error ?? 'Invalid username or password.');
        return;
      }
      email = data.email;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12 text-stone-900">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 inline-flex text-sm font-semibold text-violet-600 hover:text-violet-800">
          Back home
        </Link>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Client view</p>
          <h1 className="mt-1 text-2xl font-black text-stone-900">Log in to review your website</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Use the client account your project admin created for you.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-stone-700">
              Username or email
              <input
                value={identifier}
                onChange={event => setIdentifier(event.target.value)}
                type="text"
                required
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            <label className="block text-sm font-semibold text-stone-700">
              Password
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
