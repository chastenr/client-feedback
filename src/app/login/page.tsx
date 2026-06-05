'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Missing Supabase configuration.');
      return;
    }

    setLoading(true);
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white shadow-sm">
            K
          </div>
          <h1 className="text-xl font-black text-stone-900">Kaze Snippet</h1>
          <p className="mt-1 text-sm text-stone-500">{mode === 'signin' ? 'Sign in to your dashboard' : 'Create your account'}</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {mode === 'signup' && (
              <label className="block text-sm font-semibold text-stone-700">
                Full name
                <input
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                />
              </label>
            )}
            <label className="block text-sm font-semibold text-stone-700">
              Email
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                type="email"
                required
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
                minLength={6}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </label>
          </div>

          {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
          >
            {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-3 w-full text-sm font-semibold text-stone-500 hover:text-stone-900"
          >
            {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center">
          <Link href="/" className="text-sm font-semibold text-violet-600 hover:text-violet-800">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
