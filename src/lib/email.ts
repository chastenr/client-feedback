interface ProjectDeletedEmail {
  projectName: string;
  projectUrl?: string | null;
  deletedBy: string;
  deletedAt: string;
  taskCount: number;
}

export function isAdminEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_ALERT_EMAIL);
}

export async function sendProjectDeletedEmail(input: ProjectDeletedEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_ALERT_EMAIL;
  const from = process.env.EMAIL_FROM || 'Kaze Snippet <onboarding@resend.dev>';

  if (!apiKey || !to) {
    return { ok: false, skipped: true, error: 'Email alerts are not configured.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Project deleted: ${input.projectName}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
            <h2>Project deleted</h2>
            <p><strong>Project:</strong> ${input.projectName}</p>
            ${input.projectUrl ? `<p><strong>Website:</strong> ${input.projectUrl}</p>` : ''}
            <p><strong>Deleted by:</strong> ${input.deletedBy}</p>
            <p><strong>Deleted at:</strong> ${input.deletedAt}</p>
            <p><strong>Tasks removed:</strong> ${input.taskCount}</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Kaze] Email alert failed:', error);
      return { ok: false, skipped: false, error };
    }

    return { ok: true, skipped: false };
  } catch (error) {
    console.error('[Kaze] Email alert failed:', error);
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : 'Email alert failed.' };
  }
}
