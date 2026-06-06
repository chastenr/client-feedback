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
import ThemeToggle from '@/components/ThemeToggle';

type Tab = 'tasks' | 'install' | 'settings';

interface ProjectMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
  profiles?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    username?: string | null;
  } | {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    username?: string | null;
  }[] | null;
}

const MEMBER_ROLE_LABELS: Record<ProjectMember['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Editor',
  viewer: 'Viewer',
};

type IconName = 'board' | 'feedback' | 'install' | 'settings' | 'members' | 'pages' | 'user' | 'search' | 'external' | 'refresh' | 'share';

const ICON_PATHS: Record<IconName, string> = {
  board: 'M4 5h16v14H4V5Zm4 0v14M4 10h16',
  feedback: 'M4 4l15 6-7 2-3 7-2-6-3-2Z',
  install: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1',
  members: 'M16 11a4 4 0 1 0-8 0m8 0a4 4 0 0 1-8 0m8 0c2.4.5 4 2 4 4v2H4v-2c0-2 1.6-3.5 4-4m10-3a3 3 0 0 1 0 6M6 8a3 3 0 0 0 0 6',
  pages: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M8 12h8M8 16h8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  search: 'M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21',
  external: 'M14 4h6v6M20 4l-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5',
  refresh: 'M20 6v5h-5M4 18v-5h5M18 9a6 6 0 0 0-10-3L4 10m16 4-4 4a6 6 0 0 1-10-3',
  share: 'M18 8a3 3 0 1 0-2.8-4M6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8.7 15.4l6.6-3.8M8.7 18.6l6.6 3.8',
};

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export default function ProjectBoardPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<FeedbackTask[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedReviewLink, setCopiedReviewLink] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('all');
  const [reporterFilter, setReporterFilter] = useState('all');
  const [clientEmail, setClientEmail] = useState('');
  const [clientUsername, setClientUsername] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientFullName, setClientFullName] = useState('');
  const [clientAccessMessage, setClientAccessMessage] = useState('');
  const [clientAccessError, setClientAccessError] = useState('');
  const [clientAccessSaving, setClientAccessSaving] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberFullName, setMemberFullName] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [memberMessage, setMemberMessage] = useState('');
  const [memberError, setMemberError] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);
  const [slackConfigured, setSlackConfigured] = useState(false);
  const [slackMessage, setSlackMessage] = useState('');
  const [slackError, setSlackError] = useState('');
  const [slackTesting, setSlackTesting] = useState(false);

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
    const [projectResponse, tasksResponse, membersResponse, slackResponse] = await Promise.all([
      dashboardFetch(`/api/projects/${params.id}`),
      dashboardFetch(`/api/projects/${params.id}/tasks`),
      dashboardFetch(`/api/projects/${params.id}/members`),
      dashboardFetch('/api/integrations/slack'),
    ]);
    const projectData = await projectResponse.json().catch(() => ({}));
    const tasksData = await tasksResponse.json().catch(() => ({}));
    const membersData = await membersResponse.json().catch(() => ({}));
    const slackData = await slackResponse.json().catch(() => ({}));
    if (!projectResponse.ok) setError(projectData.error ?? 'Unable to load project.');
    else setProject(projectData.project);
    if (!tasksResponse.ok) setError(tasksData.error ?? 'Unable to load tasks.');
    else setTasks(tasksData.tasks ?? []);
    if (membersResponse.ok) setMembers(membersData.members ?? []);
    if (slackResponse.ok) setSlackConfigured(Boolean(slackData.configured));
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const pageOptions = useMemo(() => {
    return Array.from(new Set(tasks.map(task => task.page_path || safePath(task.page_url)).filter(Boolean))).sort();
  }, [tasks]);

  const reporterOptions = useMemo(() => {
    return Array.from(new Set(tasks.map(task => task.reporter_name || 'Anonymous'))).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter(task => {
      const page = task.page_path || safePath(task.page_url);
      const reporter = task.reporter_name || 'Anonymous';
      const searchable = [
        task.title,
        task.comment,
        task.description,
        task.page_url,
        task.page_path,
        task.selector,
        task.element_text,
        reporter,
      ].filter(Boolean).join(' ').toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (pageFilter !== 'all' && page !== pageFilter) return false;
      if (reporterFilter !== 'all' && reporter !== reporterFilter) return false;
      return true;
    });
  }, [pageFilter, reporterFilter, searchQuery, tasks]);

  const grouped = useMemo(() => {
    return TASK_STATUSES.reduce<Record<TaskStatus, FeedbackTask[]>>((acc, status) => {
      acc[status] = filteredTasks.filter(task => task.status === status);
      return acc;
    }, {} as Record<TaskStatus, FeedbackTask[]>);
  }, [filteredTasks]);

  const boardStats = useMemo(() => {
    const open = tasks.filter(task => task.status !== 'done').length;
    const withAttachments = tasks.filter(task => task.attachment_url).length;
    const pages = new Set(tasks.map(task => task.page_path || safePath(task.page_url))).size;
    return { open, withAttachments, pages };
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

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setMemberSaving(true);
    setMemberMessage('');
    setMemberError('');

    const response = await dashboardFetch(`/api/projects/${project.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: memberEmail,
        fullName: memberFullName || null,
        role: memberRole,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMemberSaving(false);

    if (!response.ok) {
      setMemberError(data.error ?? 'Unable to add member.');
      return;
    }

    setMembers(prev => {
      const next = prev.filter(member => member.id !== data.member.id);
      return [...next, data.member];
    });
    setMemberMessage(data.invited ? `Invite sent to ${memberEmail}.` : `${memberEmail} can now access this project.`);
    setMemberEmail('');
    setMemberFullName('');
  }

  async function removeMember(memberId: string) {
    if (!project) return;
    const response = await dashboardFetch(`/api/projects/${project.id}/members/${memberId}`, {
      method: 'DELETE',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMemberError(data.error ?? 'Unable to remove member.');
      return;
    }
    setMembers(prev => prev.filter(member => member.id !== memberId));
  }

  async function testSlack() {
    if (!project) return;
    setSlackTesting(true);
    setSlackMessage('');
    setSlackError('');

    const response = await dashboardFetch('/api/integrations/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    });
    const data = await response.json().catch(() => ({}));
    setSlackTesting(false);

    if (!response.ok) {
      setSlackError(data.error ?? 'Slack test failed.');
      return;
    }

    setSlackMessage('Test sent to Slack.');
  }

  function memberProfile(member: ProjectMember) {
    return Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
  }

  const isInstalled = Boolean(project?.widget_last_seen_at);

  function getWidgetBase() {
    const envUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
    if (envUrl) return envUrl.replace(/\/widget\.js$/, '').replace(/\/$/, '');
    return typeof window !== 'undefined' ? window.location.origin : 'https://YOUR-APP.vercel.app';
  }

  const widgetBase = getWidgetBase();
  const projectToken = project ? (project.share_token ?? project.public_token) : 'PROJECT_ID';

  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'tasks', label: 'Task Board', icon: 'board' },
    { id: 'install', label: 'Integrations', icon: 'install' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
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

  function safePath(url: string) {
    try {
      return new URL(url).pathname || '/';
    } catch {
      return url;
    }
  }

  function shortId(id: string) {
    return id.slice(0, 8);
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
    <main className="kaze-workspace min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-violet-600 hover:text-violet-800">
              ← Dashboard
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-stone-900">{project?.name ?? 'Project'}</h1>
              {project && (
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black shadow-sm ${
                  isInstalled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
                  title={isInstalled ? 'Widget installed' : 'Widget not installed yet'}
                  aria-label={isInstalled ? 'Widget installed' : 'Widget not installed yet'}
                >
                  {isInstalled ? '✓' : '!'}
                </span>
              )}
            </div>
            {project?.website_url && <p className="text-xs text-stone-400">{project.website_url}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {project && (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
              >
                <Icon name="share" className="h-4 w-4" />
                Share client link
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              <Icon name="refresh" className="h-4 w-4" />
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
              <span className="inline-flex items-center gap-2">
                <Icon name={tab.icon} className="h-4 w-4" />
              {tab.label}
              </span>
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
              <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="space-y-4 lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto lg:pr-1">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-stone-900 text-sm font-black text-white">
                        K
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-900">Kaze Snippet</p>
                        <p className="truncate text-xs text-stone-400">{project?.name ?? 'Project workspace'}</p>
                      </div>
                    </div>
                    <nav className="space-y-1">
                      {tabs.map(tab => {
                        const count = tab.id === 'tasks' ? tasks.length : tab.id === 'settings' ? members.length : null;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                              activeTab === tab.id
                                ? 'bg-sky-100 text-sky-800 shadow-sm'
                                : 'text-sky-700 hover:bg-sky-50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <Icon name={tab.icon} className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{tab.label}</span>
                            </span>
                            {count !== null && (
                              <span className="rounded-full bg-sky-200/80 px-2 py-0.5 text-xs font-black text-sky-900">{count}</span>
                            )}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-sky-700 transition hover:bg-sky-50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Icon name="members" className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">Members</span>
                        </span>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-800">{members.length}</span>
                      </button>
                    </nav>
                    {project?.website_url && (
                      <a
                        href={project.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-4 text-sm font-bold text-sky-700 hover:text-sky-900"
                      >
                        <Icon name="external" className="h-4 w-4" />
                        Open website
                      </a>
                    )}
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Board overview</p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-stone-50 px-3 py-2">
                        <p className="text-lg font-black text-stone-900">{tasks.length}</p>
                        <p className="text-[11px] font-semibold text-stone-400">Total</p>
                      </div>
                      <div className="rounded-xl bg-violet-50 px-3 py-2">
                        <p className="text-lg font-black text-violet-700">{boardStats.open}</p>
                        <p className="text-[11px] font-semibold text-violet-400">Open</p>
                      </div>
                      <div className="rounded-xl bg-stone-50 px-3 py-2">
                        <p className="text-lg font-black text-stone-900">{boardStats.withAttachments}</p>
                        <p className="text-[11px] font-semibold text-stone-400">Files</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {TASK_STATUSES.map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setPageFilter('all');
                            setReporterFilter('all');
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-stone-600 hover:bg-stone-50"
                        >
                          <span className="flex items-center gap-2">
                            <Icon name="board" className="h-3.5 w-3.5 text-sky-500" />
                            {STATUS_LABELS[status]}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">{tasks.filter(task => task.status === status).length}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Pages</p>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">{boardStats.pages}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      <button
                        type="button"
                        onClick={() => setPageFilter('all')}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm ${pageFilter === 'all' ? 'bg-violet-50 font-bold text-violet-700' : 'text-stone-600 hover:bg-stone-50'}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon name="pages" className="h-3.5 w-3.5 flex-shrink-0 text-sky-500" />
                          All pages
                        </span>
                        <span>{tasks.length}</span>
                      </button>
                      {pageOptions.slice(0, 8).map(page => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setPageFilter(page)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${pageFilter === page ? 'bg-violet-50 font-bold text-violet-700' : 'text-stone-600 hover:bg-stone-50'}`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon name="pages" className="h-3.5 w-3.5 flex-shrink-0 text-sky-500" />
                            <span className="truncate">{page}</span>
                          </span>
                          <span className="text-xs">{tasks.filter(task => (task.page_path || safePath(task.page_url)) === page).length}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Reporters</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setReporterFilter('all')}
                        className={`rounded-full px-3 py-1 text-xs font-bold ${reporterFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                      >
                        All
                      </button>
                      {reporterOptions.slice(0, 8).map(reporter => (
                        <button
                          key={reporter}
                          type="button"
                          onClick={() => setReporterFilter(reporter)}
                          className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1 text-xs font-bold ${reporterFilter === reporter ? 'bg-violet-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                        >
                          <Icon name="user" className="h-3 w-3 flex-shrink-0" />
                          {reporter}
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>

                <div className="min-w-0">
                  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm md:flex-row md:items-center lg:sticky lg:top-[150px] lg:z-10">
                    <div className="relative flex-1">
                      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder="Search feedback, page, reporter, selector..."
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
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
                    <select
                      value={pageFilter}
                      onChange={event => setPageFilter(event.target.value)}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      aria-label="Filter by page"
                    >
                      <option value="all">All pages</option>
                      {pageOptions.map(page => <option key={page} value={page}>{page}</option>)}
                    </select>
                    <select
                      value={reporterFilter}
                      onChange={event => setReporterFilter(event.target.value)}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                      aria-label="Filter by reporter"
                    >
                      <option value="all">All reporters</option>
                      {reporterOptions.map(reporter => <option key={reporter} value={reporter}>{reporter}</option>)}
                    </select>
                    <span className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-bold text-stone-500">
                      {filteredTasks.length} shown
                    </span>
                  </div>

                  <div className="kaze-board flex gap-4 overflow-x-auto pb-4">
                    {TASK_STATUSES.map(status => (
                      <section key={status} className="flex h-[calc(100vh-265px)] min-h-[500px] max-h-[760px] w-[310px] flex-shrink-0 flex-col rounded-2xl bg-sky-50/70 p-3">
                        <div className="mb-3 flex items-center justify-between px-1">
                          <h2 className="text-sm font-black uppercase tracking-wide text-stone-700">{STATUS_LABELS[status]}</h2>
                          <span className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-black text-stone-600">{grouped[status].length}</span>
                        </div>
                        <div
                          className="kaze-column-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
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
                              className="group cursor-pointer rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                              onClick={() => openDrawer(task)}
                            >
                              {task.screenshot_url ? (
                                <div className="relative h-28 overflow-hidden rounded-t-xl bg-stone-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={task.screenshot_url} alt="" className="h-full w-full object-cover object-top transition group-hover:scale-[1.02]" />
                                  <div className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-black text-stone-500 shadow-sm">#{shortId(task.id)}</div>
                                  <div
                                    className="task-pin absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-violet-600 shadow-lg"
                                    style={{
                                      '--pin-left': `${Math.min(96, Math.max(4, (Number(task.x) / task.viewport_width) * 100))}%`,
                                      '--pin-top': `${Math.min(92, Math.max(8, (Number(task.y) / task.viewport_height) * 100))}%`,
                                    } as React.CSSProperties}
                                  />
                                </div>
                              ) : (
                                <div className="relative h-28 overflow-hidden rounded-t-xl bg-gradient-to-br from-violet-50 to-stone-100">
                                  <div className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-black text-stone-500 shadow-sm">#{shortId(task.id)}</div>
                                  <div className="absolute left-3 right-3 top-10 truncate rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold text-stone-500 shadow-sm">
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
                                  <span className={`truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                    task.last_editor_name
                                      ? 'bg-sky-50 text-sky-700'
                                      : 'bg-stone-100 text-stone-500'
                                  }`}>
                                    {task.last_editor_name ? `Last: ${task.last_editor_name}` : 'No editor yet'}
                                  </span>
                                  <span className="ml-auto text-[11px] text-stone-400">{new Date(task.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="line-clamp-3 text-sm font-semibold leading-5 text-stone-900">{task.comment ?? task.description ?? task.title}</p>
                                <p className="mt-2 truncate text-xs text-stone-400">{task.page_path ?? safePath(task.page_url)}</p>
                                {task.last_editor_message && (
                                  <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-sky-600">
                                    {task.last_editor_message}
                                  </p>
                                )}
                                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-[11px] font-bold text-stone-400">
                                  <span>{task.attachment_url ? 'Attachment' : task.screenshot_url ? 'Screenshot' : 'Pin only'}</span>
                                  <span>{task.element_text ? 'Element text' : 'Selector'}</span>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
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
          <div className="mx-auto max-w-3xl">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon name="install" className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-stone-900">Integrations</h2>
                    <p className="mt-1 text-sm leading-6 text-stone-500">
                      Notify your team when clients leave feedback or reply to a task.
                    </p>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  slackConfigured
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  Slack {slackConfigured ? 'enabled' : 'not connected'}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-stone-900">Slack notifications</p>
                    <p className="mt-1 text-sm leading-6 text-stone-500">
                      Sends a message with a direct task link when a client creates feedback or comments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={testSlack}
                    disabled={!slackConfigured || slackTesting}
                    className="w-fit rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {slackTesting ? 'Sending...' : 'Send test'}
                  </button>
                </div>

                {!slackConfigured && (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Add <code className="rounded bg-white/70 px-1 py-0.5 text-xs">SLACK_WEBHOOK_URL</code> in Vercel environment variables, then redeploy.
                  </div>
                )}
                {slackMessage && (
                  <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{slackMessage}</p>
                )}
                {slackError && (
                  <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{slackError}</p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-stone-900">Members</h2>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Add admins, developers, editors, or viewers for this project only.
                  </p>
                </div>
                <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                  {members.length} people
                </span>
              </div>

              <form onSubmit={inviteMember} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]">
                <label className="block text-sm font-semibold text-stone-700">
                  Email
                  <input
                    value={memberEmail}
                    onChange={event => setMemberEmail(event.target.value)}
                    type="email"
                    required
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="developer@example.com"
                  />
                </label>

                <label className="block text-sm font-semibold text-stone-700">
                  Name
                  <input
                    value={memberFullName}
                    onChange={event => setMemberFullName(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                    placeholder="Optional"
                  />
                </label>

                <label className="block text-sm font-semibold text-stone-700">
                  Role
                  <select
                    value={memberRole}
                    onChange={event => setMemberRole(event.target.value as 'admin' | 'member' | 'viewer')}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="member">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={memberSaving}
                    className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                  >
                    {memberSaving ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>

              <div className="mt-3 grid gap-2 text-xs text-stone-500 sm:grid-cols-3">
                <p className="rounded-xl bg-stone-50 px-3 py-2"><strong className="text-stone-700">Admin:</strong> manage this project and tasks.</p>
                <p className="rounded-xl bg-stone-50 px-3 py-2"><strong className="text-stone-700">Editor:</strong> update tasks and leave comments.</p>
                <p className="rounded-xl bg-stone-50 px-3 py-2"><strong className="text-stone-700">Viewer:</strong> client-style access for review.</p>
              </div>

              {memberMessage && (
                <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{memberMessage}</p>
              )}
              {memberError && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{memberError}</p>
              )}

              <div className="mt-5 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
                {members.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-stone-400">No members added yet.</p>
                ) : members.map(member => {
                  const profile = memberProfile(member);
                  const displayName = profile?.full_name || profile?.username || profile?.email || 'Unknown user';
                  return (
                    <div key={member.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-stone-900">{displayName}</p>
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">
                            {MEMBER_ROLE_LABELS[member.role]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-stone-400">{profile?.email || member.user_id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        disabled={member.role === 'owner'}
                        className="w-fit rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
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

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Details</p>
                  <dl className="grid gap-2 rounded-xl border border-stone-100 bg-white px-4 py-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-bold uppercase tracking-wide text-stone-400">Task</dt>
                      <dd className="font-mono text-stone-700">#{shortId(drawerTask.id)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-bold uppercase tracking-wide text-stone-400">Created</dt>
                      <dd className="text-right text-stone-700">{new Date(drawerTask.created_at).toLocaleString()}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-bold uppercase tracking-wide text-stone-400">Page</dt>
                      <dd className="max-w-[70%] break-words text-right text-stone-700">{drawerTask.page_path || safePath(drawerTask.page_url)}</dd>
                    </div>
                    {drawerTask.selector && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold uppercase tracking-wide text-stone-400">Selector</dt>
                        <dd className="max-w-[70%] break-words text-right font-mono text-[11px] text-stone-600">{drawerTask.selector}</dd>
                      </div>
                    )}
                    {drawerTask.element_text && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold uppercase tracking-wide text-stone-400">Text</dt>
                        <dd className="max-w-[70%] break-words text-right text-stone-700">{drawerTask.element_text}</dd>
                      </div>
                    )}
                    {drawerTask.user_agent && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-bold uppercase tracking-wide text-stone-400">Browser</dt>
                        <dd className="max-w-[70%] truncate text-right text-stone-500">{drawerTask.user_agent}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Attachment — shown below feedback as a downloadable file */}
                {drawerTask.attachment_url && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">Attachment</p>
                    {isVideoUrl(drawerTask.attachment_url) ? (
                      <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950">
                        <video src={drawerTask.attachment_url} controls className="block w-full max-h-[220px]" preload="metadata" />
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
                          <img src={drawerTask.attachment_url} alt="Client attachment" className="block max-h-[180px] w-full object-contain" />
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
