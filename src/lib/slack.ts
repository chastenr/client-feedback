interface SlackNotification {
  type: 'feedback' | 'comment' | 'project_deleted';
  projectName?: string | null;
  projectUrl?: string | null;
  taskId?: string;
  taskUrl?: string;
  pageUrl?: string | null;
  pagePath?: string | null;
  authorName?: string | null;
  message: string;
  deletedAt?: string;
}

export function isSlackConfigured() {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

function truncate(value: string, max = 240) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function slackEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendSlackNotification(notification: SlackNotification) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { ok: false, skipped: true, error: 'Slack webhook is not configured.' };

  const title = notification.type === 'feedback'
    ? 'New client feedback'
    : notification.type === 'comment'
      ? 'New client comment'
      : 'Project deleted';
  const project = notification.projectName || notification.projectUrl || 'Project';
  const author = notification.authorName || (notification.type === 'project_deleted' ? 'Admin' : 'Client');
  const page = notification.pagePath || notification.pageUrl || 'Unknown page';
  const message = truncate(notification.message.trim());
  const contextElements = notification.type === 'project_deleted'
    ? [
      { type: 'mrkdwn', text: `*Deleted by:* ${slackEscape(author)}` },
      { type: 'mrkdwn', text: `*Deleted at:* ${slackEscape(notification.deletedAt || new Date().toISOString())}` },
    ]
    : [
      { type: 'mrkdwn', text: `*Reporter:* ${slackEscape(author)}` },
      { type: 'mrkdwn', text: `*Page:* ${slackEscape(page)}` },
    ];
  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${slackEscape(project)}*\n${slackEscape(message)}`,
      },
    },
    {
      type: 'context',
      elements: contextElements,
    },
  ];

  if (notification.taskUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View task' },
          url: notification.taskUrl,
        },
      ],
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${title} from ${author}: ${message}`,
        blocks,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Kaze] Slack notification failed:', error);
      return { ok: false, skipped: false, error };
    }
    return { ok: true, skipped: false };
  } catch (error) {
    console.error('[Kaze] Slack notification failed:', error);
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : 'Slack notification failed.' };
  }
}
