'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@/lib/api/feedback-types';
import { dashboardFetch } from '@/lib/api/client';

function getWidgetBaseUrl(): string {
  // NEXT_PUBLIC_WIDGET_URL takes priority — set this to your deployed domain in production.
  // e.g. https://your-app.vercel.app/widget.js
  const envUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
  if (envUrl) return envUrl.replace(/\/widget\.js$/, '');

  // Dev fallback: use current origin. Never reaches here in production if env var is set.
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://YOUR-APP.vercel.app';
}

export default function InstallSnippetPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedNextjs, setCopiedNextjs] = useState(false);

  useEffect(() => {
    dashboardFetch(`/api/projects/${params.id}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Unable to load project.');
        setProject(data.project);
      })
      .catch(err => setError(err.message));
  }, [params.id]);

  const widgetBase = getWidgetBaseUrl();

  const projectToken = useMemo(() => {
    if (!project) return 'YOUR_PROJECT_ID';
    return project.share_token ?? project.public_token;
  }, [project]);

  const snippet = useMemo(() => (
    `<script\n  src="${widgetBase}/widget.js"\n  data-project-id="${projectToken}"\n></script>`
  ), [widgetBase, projectToken]);

  const nextjsSnippet = useMemo(() => (
    `import Script from "next/script";\n\n<Script\n  src="${widgetBase}/widget.js"\n  data-project-id="${projectToken}"\n  strategy="afterInteractive"\n/>`
  ), [widgetBase, projectToken]);

  const isInstalled = Boolean(project?.widget_last_seen_at);
  const lastSeen = project?.widget_last_seen_at
    ? new Date(project.widget_last_seen_at).toLocaleString()
    : null;

  async function copy(text: string, setter: (v: boolean) => void) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1600);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href={`/dashboard/projects/${params.id}`} className="text-sm font-semibold text-violet-600 hover:text-violet-800">
          ← Back to board
        </Link>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 space-y-5">

          {/* Header card */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-stone-900">Install script</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Paste this once on{' '}
                  {project ? (
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-600 hover:underline">
                      {project.website_url}
                    </a>
                  ) : (
                    'the target website'
                  )}
                  . Your client only receives the review link — they never see code.
                </p>
              </div>

              {/* Install status badge */}
              {project && (
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                  isInstalled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${isInstalled ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  {isInstalled ? 'Installed' : 'Not detected yet'}
                </div>
              )}
            </div>

            {isInstalled && lastSeen && (
              <p className="mt-2 text-xs text-stone-400">Widget last seen on the target site: {lastSeen}</p>
            )}

            {!isInstalled && project && (
              <p className="mt-2 text-xs text-stone-400">
                This badge turns green once the widget loads on {project.website_url} for the first time.
              </p>
            )}
          </div>

          {/* Role explanation */}
          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm text-violet-800">
            <p className="font-bold">Admin → installs script once → shares review link</p>
            <p className="mt-1 font-bold">Client → opens review link → clicks Feedback → leaves comment → done</p>
            <p className="mt-2 text-violet-600">Clients never see script tags, Supabase, env vars, or any developer instructions.</p>
          </div>

          {/* Snippet */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Script snippet</p>
            <pre className="overflow-x-auto rounded-xl bg-stone-950 p-5 text-sm leading-relaxed text-stone-100 select-all">
              <code>{project ? snippet : 'Loading…'}</code>
            </pre>
            <button
              type="button"
              onClick={() => copy(snippet, setCopied)}
              disabled={!project}
              className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {copied ? 'Copied!' : 'Copy snippet'}
            </button>
          </div>

          {/* Installation examples */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-base font-black text-stone-900">Installation examples</h2>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Next.js App Router</p>
              <pre className="overflow-x-auto rounded-xl bg-stone-950 p-5 text-sm leading-relaxed text-stone-100 select-all">
                <code>{nextjsSnippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => copy(nextjsSnippet, setCopiedNextjs)}
                disabled={!project}
                className="mt-3 rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {copiedNextjs ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Plain HTML · WordPress · Webflow</p>
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-600 space-y-1.5">
                <p>Paste the snippet just before the closing <code className="rounded bg-stone-200 px-1 py-0.5 text-xs font-mono">{`</body>`}</code> tag.</p>
                <p><span className="font-semibold">WordPress:</span> use a plugin like <em>Insert Headers and Footers</em>.</p>
                <p><span className="font-semibold">Webflow:</span> Project Settings → Custom Code → Footer Code.</p>
                <p><span className="font-semibold">Squarespace:</span> Settings → Advanced → Code Injection → Footer.</p>
              </div>
            </div>

            {/* Production note */}
            {!process.env.NEXT_PUBLIC_WIDGET_URL && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                <p className="font-bold">Deploy note</p>
                <p className="mt-1">
                  Set <code className="rounded bg-amber-100 px-1 font-mono text-xs">NEXT_PUBLIC_WIDGET_URL=https://your-app.vercel.app/widget.js</code> in your Vercel environment variables. Without it, the snippet will fall back to <code className="rounded bg-amber-100 px-1 font-mono text-xs">window.location.origin</code> which shows localhost in local development.
                </p>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
            <p className="font-bold text-stone-900">What happens after install</p>
            <ol className="mt-3 space-y-2 text-sm text-stone-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700">1</span>
                A purple <strong>Feedback</strong> button appears permanently on the right side of the target website.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700">2</span>
                Send your client the <Link href={`/dashboard/projects/${params.id}`} className="font-semibold text-violet-600 hover:underline">review link</Link> from the board. They just open the website and click Feedback.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700">3</span>
                Their feedback appears in your <Link href={`/dashboard/projects/${params.id}`} className="font-semibold text-violet-600 hover:underline">Tasks board</Link> instantly.
              </li>
            </ol>
          </div>

        </div>
      </div>
    </main>
  );
}
