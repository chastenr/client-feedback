'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@/lib/api/feedback-types';
import { dashboardFetch } from '@/lib/api/client';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [allowedOrigin, setAllowedOrigin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        window.location.href = '/login?next=/dashboard';
        return;
      }
      setAdminEmail(data.session.user.email ?? '');
    });
  }, []);

  async function loadProjects() {
    setLoading(true);
    setError('');
    const response = await dashboardFetch('/api/projects');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error ?? 'Unable to load projects.');
    else {
      setProjects(data.projects ?? []);
      setLocalMode(Boolean(data.localMode));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase?.auth.signOut();
    window.location.href = '/login';
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');
    const response = await dashboardFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, clientName, websiteUrl, allowedOrigin: allowedOrigin || null }),
    });
    const data = await response.json().catch(() => ({}));
    setCreating(false);
    if (!response.ok) {
      setError(data.error ?? 'Unable to create project.');
      return;
    }
    setLocalMode(Boolean(data.localMode));
    setName('');
    setClientName('');
    setWebsiteUrl('');
    setAllowedOrigin('');
    setShowForm(false);
    setProjects(prev => [data.project, ...prev]);
  }

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(project => [
      project.name,
      project.client_name,
      project.website_url,
      project.allowed_origin,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [projects, searchQuery]);

  const installedCount = projects.filter(project => project.widget_last_seen_at).length;
  const clientCount = new Set(projects.map(project => project.client_name).filter(Boolean)).size;

  function safeHost(url: string) {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  return (
    <main className="kaze-workspace min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">K</div>
            <div>
              <h1 className="text-base font-black leading-none text-stone-900">Kaze Snippet</h1>
              {localMode && <p className="mt-0.5 text-xs text-stone-400">Local mode</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {adminEmail && <span className="hidden text-xs font-semibold text-stone-400 sm:inline">{adminEmail}</span>}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
            >
              + New project
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-5 py-8">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Workspace</p>
              <h2 className="mt-2 text-2xl font-black text-stone-900">Projects</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">Find client websites, open boards, and manage installs.</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-stone-50 px-3 py-2">
                  <p className="text-lg font-black text-stone-900">{projects.length}</p>
                  <p className="text-[11px] font-semibold text-stone-400">Sites</p>
                </div>
                <div className="rounded-xl bg-violet-50 px-3 py-2">
                  <p className="text-lg font-black text-violet-700">{installedCount}</p>
                  <p className="text-[11px] font-semibold text-violet-400">Live</p>
                </div>
                <div className="rounded-xl bg-stone-50 px-3 py-2">
                  <p className="text-lg font-black text-stone-900">{clientCount}</p>
                  <p className="text-[11px] font-semibold text-stone-400">Clients</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Quick actions</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
              >
                + New project
              </button>
              <button
                type="button"
                onClick={loadProjects}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
              >
                Refresh projects
              </button>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Project hub</p>
                  <h2 className="text-xl font-black text-stone-900">Client websites</h2>
                </div>
                <div className="relative w-full md:max-w-md">
                  <input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search by site, client, or URL..."
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-stone-500">
                <span className="rounded-full bg-stone-100 px-3 py-1">{filteredProjects.length} shown</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{installedCount} installed</span>
              </div>
            </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-14 text-center">
            <p className="text-sm font-semibold text-stone-500">No projects yet.</p>
            <p className="mt-1 text-sm text-stone-400">Click &quot;New project&quot; to get started.</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
            >
              Create first project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-14 text-center">
            <p className="text-sm font-semibold text-stone-500">No projects match your search.</p>
            <p className="mt-1 text-sm text-stone-400">Try a client name, website URL, or project title.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredProjects.map(project => {
              const installed = Boolean(project.widget_last_seen_at);
              return (
                <article key={project.id} className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${installed ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${installed ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          {installed ? 'Installed' : 'Needs install'}
                        </span>
                        {project.client_name && <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600">{project.client_name}</span>}
                      </div>
                      <h3 className="truncate text-lg font-black text-stone-900">{project.name}</h3>
                      <p className="mt-1 truncate text-sm font-semibold text-stone-500">{safeHost(project.website_url)}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-400">{project.website_url}</p>
                    </div>
                    <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-lg font-black text-sky-700 sm:flex">
                      {safeHost(project.website_url).slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-violet-700"
                    >
                      Open board
                    </Link>
                    <Link
                      href={`/dashboard/projects/${project.id}/install`}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-600 hover:bg-stone-50"
                    >
                      Install
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-xs font-semibold text-stone-400">
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                    {project.widget_last_seen_at && <span>Last seen {new Date(project.widget_last_seen_at).toLocaleDateString()}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
          </section>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={createProject}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-stone-900">New project</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-stone-200 px-2 py-1 text-sm text-stone-500 hover:bg-stone-50">
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-semibold text-stone-700">
                Project name <span className="text-red-500">*</span>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  placeholder="Pipe Surgeons redesign"
                />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Client name
                <input
                  value={clientName}
                  onChange={event => setClientName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  placeholder="Pipe Surgeons LLC"
                />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Website URL <span className="text-red-500">*</span>
                <input
                  value={websiteUrl}
                  onChange={event => setWebsiteUrl(event.target.value)}
                  required
                  type="url"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  placeholder="https://example-client.com"
                />
              </label>
              <label className="block text-sm font-semibold text-stone-700">
                Allowed domain (optional)
                <input
                  value={allowedOrigin}
                  onChange={event => setAllowedOrigin(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  placeholder="https://example-client.com"
                />
                <span className="mt-1 block text-xs font-normal text-stone-400">Only allow feedback from this domain. Leave blank to accept any origin.</span>
              </label>
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={creating}
              className="mt-5 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
