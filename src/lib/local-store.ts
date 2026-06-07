import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { AuditLog } from '@/lib/audit';
import type { FeedbackTask, Project, TaskComment, TaskPriority, TaskStatus } from '@/lib/api/feedback-types';

interface LocalDb {
  projects: Project[];
  tasks: FeedbackTask[];
  comments: TaskComment[];
  logs?: AuditLog[];
}

const DATA_DIR = process.env.VERCEL
  ? '/tmp/kaze-local-data'
  : path.join(process.cwd(), '.local-data');
const DATA_FILE = path.join(DATA_DIR, 'feedback.json');

export function isLocalMode() {
  return process.env.LOCAL_FEEDBACK_MODE === 'true' || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function token() {
  return `local_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function readDb(): Promise<LocalDb> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as LocalDb;
  } catch {
    return { projects: [], tasks: [], comments: [], logs: [] };
  }
}

async function writeDb(db: LocalDb) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

function withProject(task: FeedbackTask, project?: Project): FeedbackTask {
  return project
    ? { ...task, projects: { id: project.id, name: project.name, website_url: project.website_url, public_token: project.public_token, share_token: project.share_token ?? project.public_token } }
    : task;
}

export async function listLocalProjects() {
  const db = await readDb();
  return db.projects.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createLocalProject(input: { name: string; websiteUrl: string; clientName?: string | null; allowedOrigin?: string | null }) {
  const db = await readDb();
  const now = new Date().toISOString();
  const publicToken = token();
  const project: Project = {
    id: crypto.randomUUID(),
    name: input.name,
    client_name: input.clientName || null,
    website_url: input.websiteUrl,
    allowed_origin: input.allowedOrigin || null,
    widget_last_seen_at: null,
    public_token: publicToken,
    share_token: publicToken,
    created_by: null,
    created_at: now,
  };
  db.projects.unshift(project);
  await writeDb(db);
  return project;
}

export async function getLocalProject(id: string) {
  const db = await readDb();
  return db.projects.find(project => project.id === id) ?? null;
}

export async function deleteLocalProject(id: string) {
  const db = await readDb();
  const project = db.projects.find(item => item.id === id);
  if (!project) return false;
  const taskIds = new Set(db.tasks.filter(task => task.project_id === id).map(task => task.id));
  db.projects = db.projects.filter(item => item.id !== id);
  db.tasks = db.tasks.filter(task => task.project_id !== id);
  db.comments = db.comments.filter(comment => !taskIds.has(comment.task_id));
  await writeDb(db);
  return true;
}

export async function getLocalProjectByToken(tokenValue: string) {
  const db = await readDb();
  return db.projects.find(project => project.public_token === tokenValue || project.share_token === tokenValue) ?? null;
}

export async function updateLocalProjectWidgetSeen(tokenValue: string) {
  const db = await readDb();
  const idx = db.projects.findIndex(p => p.public_token === tokenValue || p.share_token === tokenValue);
  if (idx === -1) return null;
  db.projects[idx] = { ...db.projects[idx], widget_last_seen_at: new Date().toISOString() };
  await writeDb(db);
  return db.projects[idx];
}

export async function updateLocalProject(id: string, updates: { name?: string; clientName?: string | null; websiteUrl?: string; allowedOrigin?: string | null }) {
  const db = await readDb();
  const index = db.projects.findIndex(project => project.id === id);
  if (index === -1) return null;
  db.projects[index] = {
    ...db.projects[index],
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.clientName !== undefined ? { client_name: updates.clientName || null } : {}),
    ...(updates.websiteUrl !== undefined ? { website_url: updates.websiteUrl } : {}),
    ...(updates.allowedOrigin !== undefined ? { allowed_origin: updates.allowedOrigin || null } : {}),
  };
  await writeDb(db);
  return db.projects[index];
}

export async function createLocalAuditLog(input: Omit<AuditLog, 'id' | 'created_at'> & { created_at?: string }) {
  const db = await readDb();
  const log: AuditLog = {
    ...input,
    id: crypto.randomUUID(),
    created_at: input.created_at ?? new Date().toISOString(),
  };
  db.logs = [log, ...(db.logs ?? [])];
  await writeDb(db);
  return log;
}

export async function listLocalAuditLogs(projectId: string) {
  const db = await readDb();
  return (db.logs ?? [])
    .filter(log => log.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listLocalTasks(projectId: string) {
  const db = await readDb();
  const project = db.projects.find(item => item.id === projectId);
  return db.tasks
    .filter(task => task.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(task => withProject(task, project));
}

export async function getLocalTask(id: string) {
  const db = await readDb();
  const task = db.tasks.find(item => item.id === id);
  if (!task) return null;
  const project = db.projects.find(item => item.id === task.project_id);
  return withProject(task, project);
}

export async function getLocalTaskComments(taskId: string) {
  const db = await readDb();
  return db.comments
    .filter(comment => comment.task_id === taskId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createLocalTask(input: {
  projectToken: string;
  title: string;
  description: string | null;
  pagePath?: string | null;
  pageUrl: string;
  pageTitle: string | null;
  selector: string | null;
  elementText?: string | null;
  x: number;
  y: number;
  elementOffsetX?: number | null;
  elementOffsetY?: number | null;
  elementWidth?: number | null;
  elementHeight?: number | null;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  screenshot: string | null | undefined;
  browser: string | null;
  os: string | null;
  device: string | null;
  userAgent: string | null;
  consoleErrors: unknown[];
  priority: TaskPriority;
  reporterName: string | null;
  reporterEmail: string | null;
}) {
  const db = await readDb();
  const project = db.projects.find(item => item.public_token === input.projectToken || item.share_token === input.projectToken);
  if (!project) return null;
  const now = new Date().toISOString();
  const task: FeedbackTask = {
    id: crypto.randomUUID(),
    project_id: project.id,
    title: input.title,
    description: input.description,
    comment: input.description,
    page_url: input.pageUrl,
    page_path: input.pagePath ?? null,
    page_title: input.pageTitle,
    selector: input.selector,
    element_text: input.elementText ?? null,
    x: input.x,
    y: input.y,
    element_offset_x: input.elementOffsetX ?? null,
    element_offset_y: input.elementOffsetY ?? null,
    element_width: input.elementWidth ?? null,
    element_height: input.elementHeight ?? null,
    scroll_x: input.scrollX,
    scroll_y: input.scrollY,
    viewport_width: input.viewportWidth,
    viewport_height: input.viewportHeight,
    screenshot_url: input.screenshot ?? null,
    browser: input.browser,
    os: input.os,
    device: input.device,
    user_agent: input.userAgent,
    console_errors: input.consoleErrors,
    status: 'backlog',
    priority: input.priority,
    assignee_id: null,
    reporter_name: input.reporterName,
    reporter_email: input.reporterEmail,
    created_at: now,
    updated_at: now,
  };
  db.tasks.unshift(task);
  await writeDb(db);
  return withProject(task, project);
}

export async function updateLocalTask(id: string, updates: { status?: TaskStatus; priority?: TaskPriority; assignee_id?: string | null; title?: string; description?: string | null }) {
  const db = await readDb();
  const index = db.tasks.findIndex(task => task.id === id);
  if (index === -1) return null;
  db.tasks[index] = { ...db.tasks[index], ...updates, updated_at: new Date().toISOString() };
  await writeDb(db);
  const project = db.projects.find(item => item.id === db.tasks[index].project_id);
  return withProject(db.tasks[index], project);
}

export async function createLocalComment(taskId: string, message: string, authorName?: string | null) {
  const db = await readDb();
  if (!db.tasks.some(task => task.id === taskId)) return null;
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    task_id: taskId,
    user_id: null,
    author_name: authorName ?? null,
    message,
    created_at: new Date().toISOString(),
  };
  db.comments.push(comment);
  await writeDb(db);
  return comment;
}
