'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

interface ClientProject {
  id: string;
  name: string;
  client_name: string | null;
  website_url: string;
  public_token: string;
  share_token?: string | null;
}

export default function ClientPortalPage() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      window.location.href = '/client/login?next=/client/portal';
      return null;
    }
    setEmail(data.session.user.email ?? '');
    return data.session.access_token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await getToken();
    if (!token) return;

    const response = await fetch('/api/client/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? 'Unable to load client projects.');
    else setProjects(data.projects ?? []);
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase?.auth.signOut();
    window.location.href = '/client/login';
  }

  function clientLink(project: ClientProject) {
    const token = project.share_token ?? project.public_token;
    return `/client/${token}`;
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Client portal</p>
            <h1 className="text-xl font-black text-stone-900">Your assigned websites</h1>
            {email && <p className="mt-0.5 text-xs text-stone-400">{email}</p>}
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
            Loading assigned websites...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <p className="font-bold text-stone-900">No websites assigned yet</p>
            <p className="mt-1 text-sm text-stone-500">Ask your project admin to add this client account to a project.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map(project => (
              <article key={project.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{project.client_name || 'Website review'}</p>
                <h2 className="mt-1 text-lg font-black text-stone-900">{project.name}</h2>
                <p className="mt-1 truncate text-sm text-stone-500">{project.website_url}</p>
                <a
                  href={clientLink(project)}
                  className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
                >
                  Open review
                </a>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
