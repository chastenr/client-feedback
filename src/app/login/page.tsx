'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12 text-stone-900">
      <div className="text-sm text-stone-400">Loading login...</div>
    </main>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get('next') || '/dashboard';

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath);
    });
  }, [nextPath, router, supabase]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!supabase) {
      router.replace('/dashboard');
      return;
    }

    setLoading(true);
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
          },
        });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm, then log in.');
      setMode('login');
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
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Admin view</p>
            <h1 className="mt-1 text-2xl font-black text-stone-900">
              {mode === 'login' ? 'Log in to dashboard' : 'Create admin account'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Admins manage projects, install snippets, and review client feedback tasks.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-semibold text-stone-700">
              Email
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                placeholder="admin@example.com"
              />
            </label>

            <label className="block text-sm font-semibold text-stone-700">
              Password
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                placeholder="Minimum 6 characters"
              />
            </label>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setMessage('');
              }}
              className="text-sm font-semibold text-violet-600 hover:text-violet-800"
            >
              {mode === 'login' ? 'Need an admin account? Create one' : 'Already have an account? Log in'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-500 shadow-sm">
          <p className="font-bold text-stone-800">Client view</p>
          <p className="mt-1 leading-6">
            Clients do not log in here. Send them their project review link: <span className="font-mono text-xs">/review/[token]</span>.
          </p>
        </div>
      </div>
    </main>
  );
}
