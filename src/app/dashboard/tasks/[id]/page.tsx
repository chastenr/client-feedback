'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  STATUS_LABELS,
  TASK_STATUSES,
  type FeedbackTask,
  type TaskComment,
  type TaskStatus,
} from '@/lib/api/feedback-types';
import { dashboardFetch } from '@/lib/api/client';

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<FeedbackTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const response = await dashboardFetch(`/api/tasks/${params.id}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? 'Unable to load task.');
      return;
    }
    setTask(data.task);
    setComments(data.comments ?? []);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const pinLeftPercent = useMemo(() => {
    if (!task) return 50;
    return Math.min(100, Math.max(0, (Number(task.x) / task.viewport_width) * 100));
  }, [task]);

  const pinTopPercent = useMemo(() => {
    if (!task) return 50;
    return Math.min(100, Math.max(0, (Number(task.y) / task.viewport_height) * 100));
  }, [task]);

  async function patchTask(update: { status?: TaskStatus }) {
    if (!task) return;
    setTask({ ...task, ...update });
    await dashboardFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim() || !task) return;
    setSaving(true);
    const response = await dashboardFetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: comment }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? 'Unable to add comment.');
      return;
    }
    setComments(prev => [...prev, data.comment]);
    setComment('');
  }

  if (error && !task) {
    return (
      <main className="min-h-screen bg-stone-50 p-6">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!task) {
    return <main className="min-h-screen bg-stone-50 p-6 text-sm text-stone-400">Loading task…</main>;
  }

  const isVideo = Boolean(task.screenshot_url && /\.(mp4|webm|mov)(\?|$)/i.test(task.screenshot_url));

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href={`/dashboard/projects/${task.project_id}`} className="text-sm font-semibold text-violet-600 hover:text-violet-800">
              ← Back to board
            </Link>
            <h1 className="mt-1 text-xl font-black text-stone-900 line-clamp-2">
              {task.comment ?? task.description ?? task.title}
            </h1>
            <p className="mt-0.5 text-xs text-stone-400">{task.page_url}</p>
          </div>
          <a
            href={(() => { try { const u = new URL(task.page_url); u.searchParams.set('feedback', '1'); return u.toString(); } catch { return task.page_url; } })()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
          >
            Open page ↗
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">
              {isVideo ? 'Video attachment' : 'Screenshot / Pin preview'}
            </h2>
            {isVideo ? (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950">
                <video src={task.screenshot_url!} controls className="block w-full max-h-[520px]" preload="metadata" />
              </div>
            ) : task.screenshot_url ? (
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={task.screenshot_url} alt="Client captured screenshot with feedback pin" className="block w-full max-w-none" />
                  <div
                    className="task-pin absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-violet-600 shadow-xl ring-8 ring-violet-500/20"
                    style={{ '--pin-left': `${pinLeftPercent}%`, '--pin-top': `${pinTopPercent}%` } as React.CSSProperties}
                    aria-label="Client feedback pin location"
                  />
                </div>
              </div>
            ) : (
              <div className="relative h-[360px] overflow-hidden rounded-xl border border-dashed border-stone-300 bg-gradient-to-br from-violet-50 to-stone-100">
                <div className="absolute left-4 right-4 top-4 rounded-xl bg-white/90 p-3 shadow-sm">
                  <p className="text-sm font-bold text-stone-700">Screenshot was not captured</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    This feedback only has the pin coordinates. New feedback will save the captured screenshot even if image upload fails.
                  </p>
                  <p className="mt-2 break-all text-xs text-stone-400">{task.page_url}</p>
                </div>
                <div
                  className="task-pin absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-violet-600 shadow-xl"
                  style={{ '--pin-left': `${Math.min(96, Math.max(4, pinLeftPercent))}%`, '--pin-top': `${Math.min(92, Math.max(14, pinTopPercent))}%` } as React.CSSProperties}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Feedback comment</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{task.comment || task.description || 'No comment provided.'}</p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">Discussion</h2>
            <div className="space-y-3">
              {comments.map(item => (
                <div key={item.id} className="rounded-xl bg-stone-50 px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-700">{item.author_name || 'Anonymous'}</span>
                    <span className="text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-stone-800">{item.message}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-stone-400">No discussion comments yet.</p>}
            </div>
            <form onSubmit={addComment} className="mt-4 flex gap-2">
              <input
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-60"
              >
                Send
              </button>
            </form>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">Status</h2>
            <select
              aria-label="Task status"
              value={task.status}
              onChange={event => patchTask({ status: event.target.value as TaskStatus })}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            >
              {TASK_STATUSES.map(status => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-stone-400">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="font-semibold text-stone-500">Reporter</dt>
                <dd className="mt-0.5 text-stone-900">{task.reporter_name || 'Anonymous'}{task.reporter_email ? ` · ${task.reporter_email}` : ''}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Page path</dt>
                <dd className="mt-0.5 break-all text-stone-900">{task.page_path || task.page_url}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Selector</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-stone-600">{task.selector || 'None'}</dd>
              </div>
              {task.element_text && (
                <div>
                  <dt className="font-semibold text-stone-500">Element text</dt>
                  <dd className="mt-0.5 break-words text-xs text-stone-600">{task.element_text}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-stone-500">Viewport</dt>
                <dd className="mt-0.5 text-stone-900">{task.viewport_width} × {task.viewport_height}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-500">Coordinates</dt>
                <dd className="mt-0.5 text-stone-900">{Number(task.x).toFixed(0)}, {Number(task.y).toFixed(0)}</dd>
              </div>
              {task.user_agent && (
                <div>
                  <dt className="font-semibold text-stone-500">Browser</dt>
                  <dd className="mt-0.5 break-all text-xs text-stone-500">{task.user_agent}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-stone-500">Created</dt>
                <dd className="mt-0.5 text-stone-900">{new Date(task.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </main>
  );
}
