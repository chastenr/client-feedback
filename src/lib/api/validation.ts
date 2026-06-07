import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from './feedback-types';

const base64Image = z
  .string()
  .startsWith('data:image/')
  .max(8_000_000)
  .optional()
  .nullable();

export const publicFeedbackSchema = z.object({
  projectToken: z.string().min(8).optional(),
  reviewToken: z.string().min(8).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  comment: z.string().trim().max(5000).optional().nullable(),
  pageUrl: z.string().url().max(2048),
  pagePath: z.string().trim().max(2048).optional().nullable(),
  pageTitle: z.string().trim().max(240).optional().nullable(),
  selector: z.string().trim().max(1200).optional().nullable(),
  elementText: z.string().trim().max(500).optional().nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  elementOffsetX: z.number().finite().optional().nullable(),
  elementOffsetY: z.number().finite().optional().nullable(),
  elementWidth: z.number().finite().positive().optional().nullable(),
  elementHeight: z.number().finite().positive().optional().nullable(),
  scrollX: z.number().finite().default(0),
  scrollY: z.number().finite().default(0),
  viewportWidth: z.number().int().positive().max(10000),
  viewportHeight: z.number().int().positive().max(10000),
  screenshot: base64Image,
  browser: z.string().trim().max(120).optional().nullable(),
  os: z.string().trim().max(120).optional().nullable(),
  device: z.string().trim().max(80).optional().nullable(),
  userAgent: z.string().trim().max(1200).optional().nullable(),
  consoleErrors: z.array(z.string().max(2000)).max(20).optional().default([]),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  reporterName: z.string().trim().max(120).optional().nullable(),
  reporterEmail: z.string().trim().email().max(180).optional().or(z.literal('')).nullable(),
}).refine(data => data.projectToken || data.reviewToken, {
  message: 'projectToken or reviewToken is required',
  path: ['projectToken'],
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(140),
  clientName: z.string().trim().max(140).optional().nullable(),
  websiteUrl: z.string().url().max(2048),
  allowedOrigin: z.string().trim().max(2048).optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().refine(data => Object.keys(data).length > 0, {
  message: 'At least one project field is required.',
});

export const clientAccessSchema = z.object({
  email: z.string().trim().email().max(180),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]+$/, 'Use letters, numbers, dots, dashes, or underscores only.').min(3).max(40).optional().or(z.literal('')).nullable(),
  password: z.string().min(6).max(120),
  fullName: z.string().trim().max(140).optional().nullable(),
});

export const projectMemberSchema = z.object({
  email: z.string().trim().email().max(180),
  fullName: z.string().trim().max(140).optional().nullable(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const widgetFeedbackSchema = z.object({
  project_id: z.string().min(8),
  comment: z.string().trim().min(1).max(5000),
  reporter_name: z.string().trim().max(120).optional().nullable(),
  reporter_email: z.string().trim().email().max(180).optional().or(z.literal('')).nullable(),
  page_url: z.string().url().max(2048),
  page_path: z.string().trim().max(2048).optional().nullable(),
  selector: z.string().trim().max(1200).optional().nullable(),
  element_text: z.string().trim().max(500).optional().nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  element_offset_x: z.number().finite().optional().nullable(),
  element_offset_y: z.number().finite().optional().nullable(),
  element_width: z.number().finite().positive().optional().nullable(),
  element_height: z.number().finite().positive().optional().nullable(),
  scroll_x: z.number().finite().default(0),
  scroll_y: z.number().finite().default(0),
  viewport_width: z.number().int().positive().max(10000),
  viewport_height: z.number().int().positive().max(10000),
  user_agent: z.string().trim().max(1200).optional().nullable(),
  screenshot: base64Image,
  attachment_url: z.string().url().max(2048).optional().nullable(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const statusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});

export const assigneeSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

export const commentSchema = z.object({
  message: z.string().trim().max(5000).default(''),
  attachmentUrl: z.string().url().max(2048).optional().nullable(),
  attachmentName: z.string().trim().max(240).optional().nullable(),
  attachmentType: z.string().trim().max(120).optional().nullable(),
}).refine(data => data.message.length > 0 || Boolean(data.attachmentUrl), {
  message: 'Comment or attachment is required.',
  path: ['message'],
});
