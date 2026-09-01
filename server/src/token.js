import crypto from 'node:crypto';
import { config } from './config.js';

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Signed, expiring token that authorizes the hidden render/payload route. */
export function signExportToken(jobId) {
  const expires = Date.now() + TOKEN_TTL_MS;
  const sig = crypto
    .createHmac('sha256', config.exportTokenSecret)
    .update(`${jobId}.${expires}`)
    .digest('hex');
  return `${expires}.${sig}`;
}

export function verifyExportToken(jobId, token) {
  if (!token || typeof token !== 'string') return false;
  const [expiresStr, sig] = token.split('.');
  const expires = Number(expiresStr);
  if (!expires || !sig || Date.now() > expires) return false;
  const expected = crypto
    .createHmac('sha256', config.exportTokenSecret)
    .update(`${jobId}.${expires}`)
    .digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
