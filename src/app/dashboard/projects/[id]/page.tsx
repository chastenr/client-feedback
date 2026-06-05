'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS, TASK_STATUSES, type FeedbackTask, type Project, type TaskStatus } from '@/lib/api/feedback-types';
import { dashboardFetch } from '@/lib/api/client';

type Tab = 'tasks' | 'install' | 'settings';

export default function ProjectBoardPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<FeedbackTask[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedReviewLink, setCopiedReviewLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [projectResponse, tasksResponse] = await Promise.all([
      dashboardFetch(`/api/projects/${params.id}`),
      dashboardFetch(`/api/projects/${params.id}/tasks`),
    ]);
    const projectData = await projectResponse.json().catch(() => ({}));
    const tasksData = await tasksResponse.json().catch(() => ({}));
    if (!projectResponse.ok) setError(projectData.error ?? 'Unable to load project.');
    else setProject(projectData.project);
    if (!tasksResponse.ok) setError(tasksData.error ?? 'Unable to load tasks.');
    else setTasks(tasksData.tasks ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    return TASK_STATUSES.reduce<Record<TaskStatus, FeedbackTask[]>>((acc, status) => {
      acc[status] = tasks.filter(task => task.status === status);
      return acc;
    }, {} as Record<TaskStatus, FeedbackTask[]>);
  }, [tasks]);

  async function moveTask(taskId: string, status: TaskStatus) {
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, status } : task));
    await dashboardFetch(`/api/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  function getReviewLink() {
    if (!project || typeof window === 'undefined') return '';
    const token = project.share_token ?? project.public_token;
    return `${window.location.origin}/review/${token}`;
  }

  function getSnippet() {
    if (!project) return '';
    const token = project.share_token ?? project.public_token;
    return `<script\n  src="${widgetBase}/widget.js"\n  data-project-id="${token}"\n></script>`;
  }

  async function copyReviewLink() {
    await navigator.clipboard.writeText(getReviewLink());
    setCopiedReviewLink(true);
    setTimeout(() => setCopiedReviewLink(false), 1600);
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(getSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 1600);
  }

  const isInstalled = Boolean(project?.widget_last_seen_at);

  function getWidgetBase() {
    const envUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
    if (envUrl) return envUrl.replace(/\/widget\.js$/, '');
    return typeof window !== 'undefined' ? window.location.origin : 'https://YOUR-APP.vercel.app';
  }

  const widgetBase = getWidgetBase();
  const projectToken = project ? (project.share_token ?? project.public_token) : 'PROJECT_ID';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'install', label: 'Install' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-violet-600 hover:text-violet-800">
              ← Dashboard
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-stone-900">{project?.name ?? 'Project'}</h1>
              {project && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  isInstalled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isInstalled ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  {isInstalled ? 'Widget installed' : 'Not installed yet'}
                </span>
              )}
            </div>
            {project?.website_url && <p className="text-xs text-stone-400">{project.website_url}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {project && (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
              >
                Share review link
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-screen-2xl gap-1 px-5 pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-violet-600 text-violet-700'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-5 py-6">
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {activeTab === 'tasks' && (
          <>
            {project && tasks.length === 0 && !loading && (
              <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4">
                <p className="font-bold text-violet-900">No feedback yet</p>
                <p className="mt-1 text-sm text-violet-700">
                  Install the snippet on the website, then share the review link with your client.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('install')}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                  >
                    View install instructions
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShare(true)}
                    className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50"
                  >
                    Share review link
                  </button>
                </div>
              </div>
            )}
            {loading ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
                Loading board…
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-6">
                {TASK_STATUSES.map(status => (
                  <section key={status} className="min-h-[560px] w-[300px] flex-shrink-0">
                    <div className="mb-3 flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm">
                      <h2 className="text-sm font-bold text-stone-700">{STATUS_LABELS[status]}</h2>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">{grouped[status].length}</span>
                    </div>
                    <div
                      className="min-h-[500px] space-y-3 rounded-2xl border border-dashed border-stone-200 bg-stone-100/50 p-3"
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        const taskId = event.dataTransfer.getData('text/task-id');
                        if (taskId) moveTask(taskId, status);
                      }}
                    >
                      {grouped[status].map(task => (
                        <article
                          key={task.id}
                          draggable
                          onDragStart={event => event.dataTransfer.setData('text/task-id', task.id)}
                          className="rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <Link href={`/dashboard/tasks/${task.id}`} className="block">
                            {task.screenshot_url ? (
                              <div className="relative h-32 overflow-hidden rounded-t-2xl bg-stone-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={task.screenshot_url} alt="" className="h-full w-full object-cover object-top" />
                                <div
                                  className="task-pin absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-violet-600 shadow-lg"
                                  style={{
                                    '--pin-left': `${Math.min(96, Math.max(4, (Number(task.x) / task.viewport_width) * 100))}%`,
                                    '--pin-top': `${Math.min(92, Math.max(8, (Number(task.y) / task.viewport_height) * 100))}%`,
                                  } as React.CSSProperties}
                                />
                              </div>
                            ) : (
                              <div className="relative h-32 overflow-hidden rounded-t-2xl bg-gradient-to-br from-violet-50 to-stone-100">
                                <div className="absolute left-3 right-3 top-3 truncate rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold text-stone-500 shadow-sm">
                                  {task.page_path ?? task.page_url}
                                </div>
                                <div
                                  className="task-pin absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-violet-600 shadow-lg"
                                  style={{
                                    '--pin-left': `${Math.min(96, Math.max(4, (Number(task.x) / task.viewport_width) * 100))}%`,
                                    '--pin-top': `${Math.min(92, Math.max(20, (Number(task.y) / task.viewport_height) * 100))}%`,
                                  } as React.CSSProperties}
                                />
                              </div>
                            )}
                            <div className="p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                {task.reporter_name && (
                                  <span className="truncate rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{task.reporter_name}</span>
                                )}
                                <span className="ml-auto text-[11px] text-stone-400">{new Date(task.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="line-clamp-2 text-sm font-semibold text-stone-900">{task.comment ?? task.description ?? task.title}</p>
                              <p className="mt-1 truncate text-xs text-stone-400">{task.page_path ?? task.page_url}</p>
                            </div>
                          </Link>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'install' && project && (
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Status banner */}
            <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
              isInstalled
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}>
              <div>
                <p className={`font-bold text-sm ${isInstalled ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {isInstalled ? 'Widget detected on target site' : 'Widget not detected yet'}
                </p>
                <p className={`text-xs mt-0.5 ${isInstalled ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isInstalled
                    ? `Last seen: ${new Date(project.widget_last_seen_at!).toLocaleString()}`
                    : 'Install the snippet below, then reload the target site to confirm.'}
                </p>
              </div>
              <span className={`text-lg ${isInstalled ? 'text-emerald-500' : 'text-amber-400'}`}>
                {isInstalled ? '✓' : '○'}
              </span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-stone-900">Install script</h2>
              <p className="mt-1 text-sm text-stone-500">
                Paste this once on <strong>{project.website_url}</strong> before the closing{' '}
                <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">{`</body>`}</code> tag.
              </p>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Script snippet</p>
                <pre className="overflow-x-auto rounded-xl bg-stone-950 p-4 text-sm text-stone-100 select-all"><code>{`<script\n  src="${widgetBase}/widget.js"\n  data-project-id="${projectToken}"\n></script>`}</code></pre>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="mt-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                >
                  {copiedSnippet ? 'Copied!' : 'Copy snippet'}
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Next.js App Router</p>
                  <pre className="overflow-x-auto rounded-xl bg-stone-950 p-4 text-sm text-stone-100 select-all"><code>{`import Script from "next/script";\n\n<Script\n  src="${widgetBase}/widget.js"\n  data-project-id="${projectToken}"\n  strategy="afterInteractive"\n/>`}</code></pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Plain HTML · WordPress · Webflow</p>
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    Paste the script tag just before the closing{' '}
                    <code className="rounded bg-stone-200 px-1 text-xs">{`</body>`}</code> tag,
                    or in the platform&apos;s Custom Code area.
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                After installing, share the review link — the client just opens the site and clicks Feedback.
                <button
                  type="button"
                  onClick={() => setShowShare(true)}
                  className="mt-2 block rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                >
                  Share review link
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && project && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-stone-900">Project settings</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="font-bold text-stone-500">Project name</dt>
                  <dd className="mt-0.5 text-stone-900">{project.name}</dd>
                </div>
                {project.client_name && (
                  <div>
                    <dt className="font-bold text-stone-500">Client name</dt>
                    <dd className="mt-0.5 text-stone-900">{project.client_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-bold text-stone-500">Website URL</dt>
                  <dd className="mt-0.5 text-stone-900">{project.website_url}</dd>
                </div>
                {project.allowed_origin && (
                  <div>
                    <dt className="font-bold text-stone-500">Allowed origin</dt>
                    <dd className="mt-0.5 text-stone-900">{project.allowed_origin}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-bold text-stone-500">Project token</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-stone-600">{project.share_token ?? project.public_token}</dd>
                </div>
                <div>
                  <dt className="font-bold text-stone-500">Created</dt>
                  <dd className="mt-0.5 text-stone-900">{new Date(project.created_at).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>

      {project && showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-stone-900">Share review link</h2>
                <p className="mt-1 text-sm text-stone-500">Send this to your client. They just open the website and click Feedback — no setup needed on their end.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShare(false)}
                className="rounded-lg border border-stone-200 px-2 py-1 text-sm text-stone-500 hover:bg-stone-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              <p className="font-bold text-stone-800">What your client sees:</p>
              <ol className="mt-2 space-y-1 pl-4 text-sm">
                <li>1. Open the website review link.</li>
                <li>2. Click the <strong>Feedback</strong> button.</li>
                <li>3. Click the page area to comment on.</li>
                <li>4. Type a comment and submit.</li>
              </ol>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-stone-400">Review link</p>
              <div className="break-all rounded-xl bg-stone-950 px-4 py-3 text-sm text-white">{getReviewLink()}</div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={copyReviewLink}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
              >
                {copiedReviewLink ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href={getReviewLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50"
              >
                Open preview
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
