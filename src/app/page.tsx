import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-white shadow-sm">
          K
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Kaze Snippet</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Visual feedback, organized.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
          Review website feedback, screenshots, comments, and client requests in one clean workspace.
        </p>

        <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            Admin login
          </Link>
          <Link
            href="/client/login"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Client login
          </Link>
        </div>

        <p className="mt-5 text-xs text-slate-400">
          Private access only. Use the account or client link provided to you.
        </p>
      </section>
    </main>
  );
}
