import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { createQueue } from '../queue.js';
import { checkAndIncrement } from '../ratelimit.js';
import { signExportToken, verifyExportToken } from '../token.js';
import { renderPdf } from '../render.js';
import { emailEnabled, sendPdfEmail } from '../email.js';

const blockSchema = z.object({
  id: z.string().max(64),
  type: z.enum([
    'title',
    'subtitle',
    'text',
    'caption',
    'image',
    'card',
    'quote',
    'specSheet',
    'moodTag',
    'divider',
    'palette',
    'colorSwatch',
  ]),
  x: z.number().int().min(0).max(48),
  y: z.number().int().min(0).max(64),
  w: z.number().int().min(1).max(48),
  h: z.number().int().min(1).max(64),
  zIndex: z.number().optional(),
  content: z.string().max(50000).optional().default(''),
  style: z.record(z.any()).optional(),
  data: z.record(z.any()).optional(),
});

const projectStylesSchema = z.object({
  cornerRadius: z.number().optional(),
  gridGap: z.number().optional(),
  margin: z.number().optional(),
  fontPairing: z.enum(['sans', 'serif', 'mono']).optional(),
  canvasTone: z.enum(['studio', 'linen', 'slate', 'obsidian']).optional(),
}).optional();

const payloadSchema = z.object({
  project: z.object({
    id: z.string().max(64),
    name: z.string().min(1).max(200),
    createdAt: z.number(),
    orientation: z.enum(['landscape', 'portrait']),
    palette: z.array(z.string().max(32)).max(50).optional(),
    styles: projectStylesSchema,
  }),
  pages: z.array(
    z.object({
      id: z.string().max(64),
      projectId: z.string().max(64),
      order: z.number().int().min(0).max(500),
      blocks: z.array(blockSchema).max(200),
    }),
  ).min(1).max(100),
  images: z.array(
    z.object({
      id: z.string().max(64),
      dataUrl: z.string().startsWith('data:image/').max(30_000_000),
    }),
  ).max(300),
  palette: z.array(z.string().max(32)).max(50).optional().default([]),
  styles: projectStylesSchema,
  format: z.enum(['a4-landscape', 'a4-portrait', 'screen-16-9']).optional().default('a4-landscape'),
  email: z.string().email().max(320).optional(),
});

/** jobId -> transient job record (never persisted, cleaned aggressively) */
const jobs = new Map();
const JOB_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}, 60 * 1000).unref();

async function processJob(job) {
  job.status = 'processing';
  try {
    const token = signExportToken(job.id);
    const pdf = await renderPdf({
      projectId: job.payload.project.id,
      jobId: job.id,
      token,
      format: job.payload.format || 'a4-landscape',
      payload: job.payload,
    });
    if (job.payload.email) {
      if (!emailEnabled()) {
        // No email credential: fall back to download so the user is never stuck.
        job.pdf = pdf;
        job.status = 'done';
        job.emailed = false;
        job.note = 'Email is not configured on this server; download instead.';
        return;
      }
      await sendPdfEmail({ to: job.payload.email, projectName: job.payload.project.name, pdf });
      job.status = 'done';
      job.emailed = true;
      job.pdf = null;
    } else {
      job.pdf = pdf;
      job.status = 'done';
      job.emailed = false;
    }
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Render failed';
  } finally {
    // The full export payload (with image data) is discarded as soon as the
    // render finishes — the backend never keeps user data.
    job.payload = null;
  }
}

const queue = createQueue(processJob);

export const exportRouter = Router();

exportRouter.post('/export', (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid export payload', details: parsed.error.issues.slice(0, 5) });
  }
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const budget = checkAndIncrement(ip);
  if (!budget.allowed) {
    return res.status(429).json({ error: `You've reached the daily export limit. Try again tomorrow.` });
  }
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    payload: parsed.data,
    projectName: parsed.data.project.name,
    pdf: null,
    emailed: false,
    error: null,
    note: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  queue.push(job);
  res.status(202).json({ jobId: id });
});

exportRouter.get('/export/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ status: 'failed', error: 'Export job not found or expired.' });
  if (job.status === 'done') {
    return res.json({
      status: 'done',
      emailed: job.emailed,
      note: job.note,
      downloadUrl: job.pdf ? `/export/download/${job.id}` : null,
    });
  }
  if (job.status === 'failed') {
    return res.json({ status: 'failed', error: job.error ?? 'PDF generation failed.' });
  }
  res.json({ status: job.status, position: queue.positionOf(job.id) });
});

exportRouter.get('/export/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== 'done' || !job.pdf) {
    return res.status(404).json({ error: 'PDF not available (expired or emailed).' });
  }
  const safeName = (job.projectName || 'moodboard').replace(/[^a-zA-Z0-9_-]/g, '_');
  const name = `${safeName}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(job.pdf);
  // One-shot download: free memory immediately.
  job.pdf = null;
});

/**
 * Internal, token-signed endpoint used ONLY by the hidden frontend render
 * route while Puppeteer captures the document. Payload is served once.
 */
exportRouter.get('/export/payload/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.payload) return res.status(404).json({ error: 'Payload not found or already consumed.' });
  if (!verifyExportToken(req.params.jobId, req.query.token?.toString())) {
    return res.status(403).json({ error: 'Invalid or expired export token.' });
  }
  res.json(job.payload);
});

