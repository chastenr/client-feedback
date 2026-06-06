import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Visual feedback tool
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Point. Click. Leave feedback.
            <br />
            <span className="text-violet-600">Tasks appear instantly.</span>
          </h1>
          <p className="mt-5 text-lg leading-8 text-stone-500">
            Install one script on your website. Share a client link with your client.
            They click the Feedback button, pick any element, and type a comment — it shows up on your dashboard as a task.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
              Admin login
            </Link>
            <Link href="/client/login" className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-bold text-stone-700 shadow-sm hover:bg-stone-100">
              Client login
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">
              A
            </div>
            <h2 className="font-bold text-stone-900">Admin view</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">Log in to create projects, install snippets, and manage feedback tasks.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-stone-900 text-sm font-black text-white shadow-sm">
              C
            </div>
            <h2 className="font-bold text-stone-900">Client view</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">Clients use the private client link you send them, like /client/[token]. No admin login needed.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {([
            ['1', 'Create project', 'Add your client\'s website URL in the dashboard.'],
            ['2', 'Install snippet', 'Paste one <script> tag on the target website.'],
            ['3', 'Share client link', 'Send the client a simple /client/… link.'],
            ['4', 'Review tasks', 'Feedback lands in your Kanban board automatically.'],
          ] as const).map(([step, title, text]) => (
            <div key={step} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white shadow-sm">
                {step}
              </div>
              <h2 className="font-bold text-stone-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
