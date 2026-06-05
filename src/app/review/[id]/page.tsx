'use client';

import { useEffect, useState } from 'react';

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
    fetch(`/api/public/review/${params.id}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Review link not found.');
        setProject(data.project);
      })
      .catch(err => setError(err.message));
  }, [params.id]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-black text-stone-900">Link unavailable</h1>
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
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Website feedback</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-black text-stone-900">{displayName}</h1>
          <p className="mt-2 text-sm text-stone-500">
            Follow these steps to leave feedback on the website.
          </p>

          <ol className="mt-6 space-y-4">
            {[
              ['Open the website', 'Click the button below to open the website in a new tab.'],
              ['Click Feedback', 'A purple Feedback button will be on the right side of the screen.'],
              ['Click any element', 'Hover over the part of the page you want to comment on, then click it.'],
              ['Write your comment', 'Type your feedback, add your name and email if you like, then hit Send.'],
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
              Open {displayName}
              <span className="opacity-75">↗</span>
            </a>
          ) : (
            <div className="mt-8 h-11 animate-pulse rounded-xl bg-stone-100" />
          )}
        </div>

        <p className="mt-5 text-center text-xs text-stone-400">
          Powered by Kaze Snippet
        </p>
      </div>
    </main>
  );
}
