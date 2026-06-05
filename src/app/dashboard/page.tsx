'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Project } from '@/lib/api/feedback-types';
import { dashboardFetch } from '@/lib/api/client';

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

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-black text-white">K</div>
            <div>
              <h1 className="text-base font-black leading-none text-stone-900">Kaze Snippet</h1>
              {localMode && <p className="mt-0.5 text-xs text-stone-400">Local mode</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
            >
              + New project
            </button>
            <Link href="/login" className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50">
              Login
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900">Projects</h2>
          <button
            type="button"
            onClick={loadProjects}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            Refresh
          </button>
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
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <div key={project.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="mb-4">
                  <h3 className="font-bold text-stone-900">{project.name}</h3>
                  {project.client_name && <p className="mt-0.5 text-xs font-semibold text-stone-400">{project.client_name}</p>}
                  <p className="mt-1 truncate text-xs text-stone-400">{project.website_url}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-violet-700"
                  >
                    Open board
                  </Link>
                  <Link
                    href={`/dashboard/projects/${project.id}/install`}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-500 hover:bg-stone-50"
                  >
                    Install
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
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
