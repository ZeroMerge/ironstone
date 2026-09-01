import fs from 'node:fs';
import path from 'node:path';

// Minimal .env loader — no dependency, keeps the backend lean.
function readEnvFile() {
  try {
    const file = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env is optional */
  }
}
readEnvFile();

export const config = {
  port: Number(process.env.PORT ?? 4100),
  frontendBaseUrl: (process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  exportTokenSecret: process.env.EXPORT_TOKEN_SECRET ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFrom: process.env.RESEND_FROM ?? 'Ironstone <onboarding@resend.dev>',
  pinterestAccessToken: process.env.PINTEREST_ACCESS_TOKEN ?? '',
  maxExportsPerIpPerDay: Number(process.env.MAX_EXPORTS_PER_IP_PER_DAY ?? 10),
  maxConcurrentExports: Number(process.env.MAX_CONCURRENT_EXPORTS ?? 2),
};

export function configWarnings() {
  const warnings = [];
  if (!config.exportTokenSecret) {
    warnings.push('EXPORT_TOKEN_SECRET is not set — the export render route is unsigned. Set it before deploying.');
  }
  if (!config.resendApiKey) {
    warnings.push('RESEND_API_KEY is not set — email delivery is disabled (PDF download still works).');
  }
  if (!config.pinterestAccessToken) {
    warnings.push('PINTEREST_ACCESS_TOKEN is not set — Pinterest import is disabled.');
  }
  return warnings;
}

