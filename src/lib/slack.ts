interface SlackNotification {
  type: 'feedback' | 'comment';
  projectName?: string | null;
  projectUrl?: string | null;
  taskId: string;
  taskUrl: string;
  pageUrl?: string | null;
  pagePath?: string | null;
  authorName?: string | null;
  message: string;
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
  if (!webhookUrl) return;

  const title = notification.type === 'feedback' ? 'New client feedback' : 'New client comment';
  const project = notification.projectName || notification.projectUrl || 'Project';
  const author = notification.authorName || 'Client';
  const page = notification.pagePath || notification.pageUrl || 'Unknown page';
  const message = truncate(notification.message.trim());

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${title} from ${author}: ${message}`,
        blocks: [
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
            elements: [
              { type: 'mrkdwn', text: `*Reporter:* ${slackEscape(author)}` },
              { type: 'mrkdwn', text: `*Page:* ${slackEscape(page)}` },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View task' },
                url: notification.taskUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[Kaze] Slack notification failed:', await response.text());
    }
  } catch (error) {
    console.error('[Kaze] Slack notification failed:', error);
  }
}
