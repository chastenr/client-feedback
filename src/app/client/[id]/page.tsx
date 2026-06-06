'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

interface ReviewProject {
  id: string;
  name: string;
  client_name: string | null;
  website_url: string;
  review_token: string;
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ReviewProject | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) {
        setError('Client login is not configured yet.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = `/client/login?next=${encodeURIComponent(`/client/${params.id}`)}`;
        return;
      }

      fetch(`/api/client/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
        .then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error ?? 'Client project not found.');
          setProject(data.project);
        })
        .catch(err => setError(err.message));
    }

    load();
  }, [params.id]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-black text-stone-900">Client access unavailable</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  const displayName = project?.client_name || project?.name || 'Website feedback';

  function getWebsiteUrl() {
    if (!project) return '#';
    try {
      const url = new URL(project.website_url);
      url.searchParams.set('feedback', '1');
      return url.toString();
    } catch {
      return project.website_url;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white shadow-sm">
            K
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Client feedback view</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-black text-stone-900">Review {displayName}</h1>
          <p className="mt-2 text-sm text-stone-500">
            Open the website, click Feedback, and leave comments directly on the page.
          </p>

          <ol className="mt-6 space-y-4">
            {[
              ['Open the website', 'Click the button below to open the website.'],
              ['Click Feedback', 'A purple Feedback button will be on the right side of the screen.'],
              ['Pin the exact spot', 'Click the image, text, button, or section you want to comment on.'],
              ['Send feedback', 'Type your comment, add your name if you like, then send it.'],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold text-stone-900">{title}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{desc}</p>
                </div>
              </li>
            ))}
          </ol>

          {project ? (
            <a
              href={getWebsiteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
            >
              Start review
              <span className="opacity-75">↗</span>
            </a>
          ) : (
            <div className="mt-8 h-11 animate-pulse rounded-xl bg-stone-100" />
          )}
        </div>

        <p className="mt-5 text-center text-xs text-stone-400">
          Client-only review link
        </p>
      </div>
    </main>
  );
}
