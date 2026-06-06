'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type FeedbackTask,
  type Project,
  type TaskComment,
  type TaskStatus,
} from '@/lib/api/feedback-types';
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
  const [clientEmail, setClientEmail] = useState('');
  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientFullName, setClientFullName] = useState('');
  const [clientAccessMessage, setClientAccessMessage] = useState('');
  const [clientAccessError, setClientAccessError] = useState('');
  const [clientAccessSaving, setClientAccessSaving] = useState(false);

  // Drawer state
  const [drawerTask, setDrawerTask] = useState<FeedbackTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerComments, setDrawerComments] = useState<TaskComment[]>([]);
  const [drawerCommentsLoading, setDrawerCommentsLoading] = useState(false);
  const [drawerComment, setDrawerComment] = useState('');
  const [drawerSaving, setDrawerSaving] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const screenshotScrollRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState(false);

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
    if (drawerTask?.id === taskId) setDrawerTask(prev => prev ? { ...prev, status } : prev);
    await dashboardFetch(`/api/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  function openDrawer(task: FeedbackTask) {
    setDrawerTask(task);
    setDrawerComments([]);
    setDrawerComment('');
    setDrawerOpen(true);
    setLightbox(false);
    setDrawerCommentsLoading(true);
    dashboardFetch(`/api/tasks/${task.id}`)
      .then(r => r.json().catch(() => ({})))
      .then(data => {
        setDrawerComments(data.comments ?? []);
        setDrawerCommentsLoading(false);
      })
      .catch(() => setDrawerCommentsLoading(false));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setTimeout(() => setDrawerTask(null), 280);
  }

  async function addDrawerComment(event: React.FormEvent) {
    event.preventDefault();
    if (!drawerComment.trim() || !drawerTask) return;
    setDrawerSaving(true);
    const response = await dashboardFetch(`/api/tasks/${drawerTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: drawerComment }),
    });
    const data = await response.json().catch(() => ({}));
    setDrawerSaving(false);
    if (response.ok && data.comment) {
      setDrawerComments(prev => [...prev, data.comment]);
      setDrawerComment('');
    }
  }

  function getReviewLink() {
    if (!project || typeof window === 'undefined') return '';
    const token = project.share_token ?? project.public_token;
    return `${window.location.origin}/client/${token}`;
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

  async function createClientAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setClientAccessSaving(true);
    setClientAccessMessage('');
    setClientAccessError('');

    const response = await dashboardFetch(`/api/projects/${project.id}/client-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: clientEmail,
        username: clientUsername || null,
        password: clientPassword,
        fullName: clientFullName || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setClientAccessSaving(false);

    if (!response.ok) {
      setClientAccessError(data.error ?? 'Unable to create client access.');
      return;
    }

    const loginName = data.client?.username || data.client?.email || clientEmail;
    setClientAccessMessage(`Client account ready for ${loginName}. Send them the client login and password.`);
    setClientPassword('');
  }

  const isInstalled = Boolean(project?.widget_last_seen_at);

  function getWidgetBase() {
    const envUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
    if (envUrl) return envUrl.replace(/\/widget\.js$/, '').replace(/\/$/, '');
    return typeof window !== 'undefined' ? window.location.origin : 'https://YOUR-APP.vercel.app';
  }

  const widgetBase = getWidgetBase();
  const projectToken = project ? (project.share_token ?? project.public_token) : 'PROJECT_ID';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'install', label: 'Install' },
    { id: 'settings', label: 'Settings' },
  ];

  const pinLeftPercent = drawerTask
    ? Math.min(100, Math.max(0, (Number(drawerTask.x) / drawerTask.viewport_width) * 100))
    : 50;
  const pinTopPercent = drawerTask
    ? Math.min(100, Math.max(0, (Number(drawerTask.y) / drawerTask.viewport_height) * 100))
    : 50;

  function isVideoUrl(url: string) {
    return /\.(mp4|webm|mov)(\?|$)/i.test(url);
  }

  function isImageUrl(url: string) {
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
  }

  function isPdfUrl(url: string) {
    return /\.pdf(\?|$)/i.test(url);
  }

  function getPageUrl() {
    if (!drawerTask) return '#';
    try {
      const u = new URL(drawerTask.page_url);
      u.searchParams.set('feedback', '1');
      return u.toString();
    } catch {
      return drawerTask.page_url;
    }
  }

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
                Share client link
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
                  Install the snippet on the website, then share the client link with your client.
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
                    Share client link
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
                          className="cursor-pointer rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          onClick={() => openDrawer(task)}
                        >
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
                After installing, share the client link. The client opens the site and clicks Feedback.
                <button
                  type="button"
                  onClick={() => setShowShare(true)}
                  className="mt-2 block rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                >
                  Share client link
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

            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-stone-900">Client account</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                Create a login for this client. They will only see this website in the client portal.
              </p>

              <form onSubmit={createClientAccess} className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-stone-700">
                  Client name
                  <input
                    value={clientFullName}
                    onChange={event => setClientFullName(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder={project.client_name || 'Client name'}
                  />
                </label>

                <label className="block text-sm font-semibold text-stone-700">
                  Client email <span className="text-red-500">*</span>
                  <input
                    value={clientEmail}
                    onChange={event => setClientEmail(event.target.value)}
                    type="email"
                    required
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="client@example.com"
                  />
                </label>

                <label className="block text-sm font-semibold text-stone-700">
                  Username
                  <input
                    value={clientUsername}
                    onChange={event => setClientUsername(event.target.value.toLowerCase())}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="short-name"
                    pattern="[a-z0-9._-]{3,40}"
                    title="Use 3-40 lowercase letters, numbers, dots, dashes, or underscores."
                  />
                  <span className="mt-1 block text-xs font-normal text-stone-400">
                    Optional. Clients can log in with this instead of typing their email.
                  </span>
                </label>

                <label className="block text-sm font-semibold text-stone-700">
                  Temporary password <span className="text-red-500">*</span>
                  <input
                    value={clientPassword}
                    onChange={event => setClientPassword(event.target.value)}
                    type="password"
                    required
                    minLength={6}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="Minimum 6 characters"
                  />
                </label>

                {clientAccessMessage && (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{clientAccessMessage}</p>
                )}

                {clientAccessError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{clientAccessError}</p>
                )}

                <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                  Client login URL: <span className="font-mono text-xs">{typeof window !== 'undefined' ? `${window.location.origin}/client/login` : '/client/login'}</span>
                </div>

                <button
                  type="submit"
                  disabled={clientAccessSaving}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  {clientAccessSaving ? 'Saving...' : 'Create client access'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Task detail drawer ─────────────────────────────────────────────── */}
      {drawerTask && (
        <>
          <div
            className={`fixed inset-0 z-30 bg-stone-950/20 transition-opacity duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={closeDrawer}
          />
          <aside
            className={`fixed right-0 top-0 bottom-0 z-40 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform duration-[260ms] ease-[cubic-bezier(.4,0,.2,1)] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            {/* Drawer header */}
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-stone-400">{drawerTask.page_path ?? drawerTask.page_url}</p>
                <h2 className="mt-0.5 line-clamp-2 text-base font-black text-stone-900">
                  {drawerTask.comment ?? drawerTask.description ?? drawerTask.title}
                </h2>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <a
                  href={getPageUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                >
                  Open page ↗
                </a>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm font-bold text-stone-400 hover:bg-stone-50 hover:text-stone-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
                {/* Screenshot / attachment preview */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                      {drawerTask.screenshot_url && isVideoUrl(drawerTask.screenshot_url) ? 'Video attachment' : 'Screenshot'}
                    </p>
                    {drawerTask.screenshot_url && !isVideoUrl(drawerTask.screenshot_url) && (
                      <button
                        type="button"
                        onClick={() => setLightbox(true)}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-800"
                      >
                        View full ↗
                      </button>
                    )}
                  </div>
                  {drawerTask.screenshot_url && isVideoUrl(drawerTask.screenshot_url) ? (
                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950">
                      <video
                        src={drawerTask.screenshot_url}
                        controls
                        className="block w-full max-h-[420px]"
                        preload="metadata"
                      />
                    </div>
                  ) : drawerTask.screenshot_url ? (
                    <div
                      ref={screenshotScrollRef}
                      className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl border border-stone-200 bg-stone-100 cursor-zoom-in"
                      onClick={() => setLightbox(true)}
                    >
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={drawerTask.screenshot_url}
                          alt="Screenshot with feedback pin"
                          className="block w-full"
                          onLoad={() => {
                            const el = screenshotScrollRef.current;
                            if (!el) return;
                            const img = el.querySelector('img') as HTMLImageElement | null;
                            if (!img) return;
                            const scrollTarget = (pinTopPercent / 100) * img.offsetHeight - el.clientHeight / 2;
                            el.scrollTop = Math.max(0, scrollTarget);
                          }}
                        />
                        <div
                          className="task-pin absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-violet-600 shadow-xl ring-8 ring-violet-500/20"
                          style={{ '--pin-left': `${pinLeftPercent}%`, '--pin-top': `${pinTopPercent}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-40 overflow-hidden rounded-xl border border-dashed border-stone-300 bg-gradient-to-br from-violet-50 to-stone-100">
                      <div className="absolute left-4 right-4 top-4 rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                        <p className="text-xs font-bold text-stone-600">No screenshot captured</p>
                        <p className="mt-0.5 truncate text-xs text-stone-400">{drawerTask.page_url}</p>
                      </div>
                      <div
                        className="task-pin absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-violet-600 shadow-xl"
                        style={{ '--pin-left': `${Math.min(96, Math.max(4, pinLeftPercent))}%`, '--pin-top': `${Math.min(88, Math.max(18, pinTopPercent))}%` } as React.CSSProperties}
                      />
                    </div>
                  )}
                </div>

                {/* Status + details row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-stone-400">Status</p>
                    <select
                      aria-label="Task status"
                      value={drawerTask.status}
                      onChange={e => moveTask(drawerTask.id, e.target.value as TaskStatus)}
                      className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                    >
                      {TASK_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-stone-400">Reporter</p>
                    <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
                      {drawerTask.reporter_name || 'Anonymous'}
                    </p>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Feedback</p>
                  <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                      {drawerTask.comment || drawerTask.description || 'No comment provided.'}
                    </p>
                  </div>
                </div>

                {/* Attachment — shown below feedback as a downloadable file */}
                {drawerTask.attachment_url && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Attachment</p>
                    {isVideoUrl(drawerTask.attachment_url) ? (
                      <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950">
                        <video src={drawerTask.attachment_url} controls className="block w-full max-h-[280px]" preload="metadata" />
                        <div className="px-4 py-2">
                          <a href={drawerTask.attachment_url} target="_blank" rel="noopener noreferrer" download className="text-xs font-bold text-violet-400 hover:text-violet-300">
                            Download video ↓
                          </a>
                        </div>
                      </div>
                    ) : isImageUrl(drawerTask.attachment_url) ? (
                      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                        <a href={drawerTask.attachment_url} target="_blank" rel="noopener noreferrer" className="block bg-stone-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={drawerTask.attachment_url} alt="Client attachment" className="block max-h-[280px] w-full object-contain" />
                        </a>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-stone-700">Attached image</p>
                          <div className="flex flex-shrink-0 gap-3">
                            <a href={drawerTask.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-violet-600 hover:text-violet-800">
                              View ↗
                            </a>
                            <a href={drawerTask.attachment_url} download target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-stone-500 hover:text-stone-700">
                              Download ↓
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-xs font-black uppercase text-stone-500">
                          {isPdfUrl(drawerTask.attachment_url) ? 'PDF' : 'FILE'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-700">
                            {isPdfUrl(drawerTask.attachment_url) ? 'Attached PDF' : 'Attached file'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-stone-400">{drawerTask.attachment_url}</p>
                          <div className="mt-2 flex gap-3">
                            <a href={drawerTask.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-violet-600 hover:text-violet-800">
                              View ↗
                            </a>
                            <a href={drawerTask.attachment_url} download target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-stone-500 hover:text-stone-700">
                              Download ↓
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Discussion */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Discussion</p>
                  {drawerCommentsLoading ? (
                    <p className="text-center text-sm text-stone-400 py-4">Loading comments…</p>
                  ) : drawerComments.length === 0 ? (
                    <p className="text-sm text-stone-400">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {drawerComments.map(c => (
                        <div key={c.id} className="rounded-xl bg-stone-50 px-4 py-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-700">{c.author_name || 'Anonymous'}</span>
                            <span className="text-xs text-stone-400">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-stone-800">{c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comment input footer */}
            <form
              onSubmit={addDrawerComment}
              className="flex flex-shrink-0 items-center gap-2 border-t border-stone-100 bg-white px-4 py-3"
            >
              <input
                ref={commentInputRef}
                value={drawerComment}
                onChange={e => setDrawerComment(e.target.value)}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={drawerSaving || !drawerComment.trim()}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </aside>
        </>
      )}

      {/* Screenshot lightbox */}
      {lightbox && drawerTask?.screenshot_url && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/90 p-6"
          onClick={() => setLightbox(false)}
        >
          <div className="relative mx-auto my-auto" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-stone-700 shadow-lg hover:bg-stone-100"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="relative overflow-hidden rounded-xl shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={drawerTask.screenshot_url}
                alt="Full page screenshot"
                className="block max-w-[90vw]"
                style={{ width: `${drawerTask.viewport_width}px`, maxWidth: '90vw' }}
              />
              <div
                className="task-pin absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-violet-600 shadow-xl ring-8 ring-violet-500/20"
                style={{ '--pin-left': `${pinLeftPercent}%`, '--pin-top': `${pinTopPercent}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {project && showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-stone-900">Share client link</h2>
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
                <li>1. Open the client review link.</li>
                <li>2. Click the <strong>Feedback</strong> button.</li>
                <li>3. Click the page area to comment on.</li>
                <li>4. Type a comment and submit.</li>
              </ol>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-stone-400">Client link</p>
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
