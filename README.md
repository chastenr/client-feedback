# Visual Feedback System

BugHerd-style visual feedback for real client websites.

Primary local workflow: Chrome extension injection. No script is pasted into the target website.

## Local Test Without Supabase

```bash
npm run dev
```

When Supabase env vars are missing, the app automatically uses local test mode and saves data to `.local-data/feedback.json`.

## Chrome Extension Setup

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this repo's `extension` folder.

The extension injects the feedback UI into the real website when the review link is opened.

## Test Flow

1. Open `/dashboard`.
2. Create a project with the real website URL.
3. Open the project board.
4. Click **Share Client Review**.
5. Open the review link.
6. Click **Open Website**.
7. Click **Feedback** on the real website.
8. Click the page area.
9. Type a comment and submit.
10. Return to the dashboard board.
11. Open the task and confirm the screenshot, pin, URL, and browser info.

## Supabase Setup

Create `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WIDGET_URL=https://YOUR-VERCEL-APP.vercel.app/widget.js
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Run the SQL migrations in `supabase/migrations`.

## Optional Script Fallback

If you later want feedback without a browser extension, install the generated `widget.js` snippet once on the target website from **Extension setup**. For live HTTPS websites, the widget URL must also be HTTPS.
