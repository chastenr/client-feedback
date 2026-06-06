import { NextResponse } from 'next/server';
import { getAdminClient, jsonError } from '@/lib/supabase/server';
import { getLocalTask, getLocalTaskComments, isLocalMode } from '@/lib/local-store';
import type { FeedbackTask, TaskComment } from '@/lib/api/feedback-types';

export const runtime = 'nodejs';

function firstMeaningfulLine(value?: string | null) {
  return value?.split('\n').map(line => line.trim()).find(Boolean) ?? '';
}

function fallbackSummary(task: FeedbackTask, comments: TaskComment[]) {
  const request = firstMeaningfulLine(task.comment || task.description || task.title) || 'Review the selected page element.';
  const target = task.element_text
    ? `Target element: "${task.element_text}".`
    : task.selector
      ? 'Target element is identified by the saved selector.'
      : 'Target element is the pinned location on the screenshot.';
  const page = task.page_path || task.page_url;
  const latestEditor = [...comments].reverse().find(comment => comment.author_name && comment.author_name !== task.reporter_name);

  return [
    `Client wants: ${request}`,
    target,
    `Page: ${page}.`,
    latestEditor ? `Latest team note: ${latestEditor.message}` : 'Next step: inspect the pinned area and make the requested update.',
  ].join(' ');
}

async function openAiSummary(task: FeedbackTask, comments: TaskComment[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_SUMMARY_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: 'Summarize website feedback for a developer. Be concise, specific, and actionable. Do not invent details.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            client_feedback: task.comment || task.description || task.title,
            page: task.page_path || task.page_url,
            selected_text: task.element_text,
            selector: task.selector,
            status: task.status,
            discussion: comments.map(comment => ({
              author: comment.author_name,
              message: comment.message,
              created_at: comment.created_at,
            })),
          }),
        },
      ],
      max_output_tokens: 120,
    }),
  });

  if (!response.ok) {
    console.error('[Kaze] AI summary failed:', await response.text());
    return null;
  }

  const data = await response.json().catch(() => null);
  const outputText = typeof data?.output_text === 'string' ? data.output_text.trim() : '';
  return outputText || null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (isLocalMode()) {
    const task = await getLocalTask(params.id);
    if (!task) return jsonError('Task not found.', 404);
    const comments = await getLocalTaskComments(params.id);
    return NextResponse.json({ summary: fallbackSummary(task, comments), ai: false });
  }

  const result = await getAdminClient(request);
  if (result instanceof NextResponse) return result;

  const { data: task, error } = await result.client
    .from('feedback_tasks')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !task) return jsonError('Task not found.', 404);

  const { data: comments } = await result.client
    .from('task_comments')
    .select('*')
    .eq('task_id', params.id)
    .order('created_at', { ascending: true });

  const safeComments = comments ?? [];
  const aiSummary = await openAiSummary(task, safeComments);

  return NextResponse.json({
    summary: aiSummary || fallbackSummary(task, safeComments),
    ai: Boolean(aiSummary),
  });
}
