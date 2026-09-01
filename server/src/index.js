import express from 'express';
import cors from 'cors';
import { config, configWarnings } from './config.js';
import { exportRouter } from './routes/export.js';
import { pinterestRouter } from './routes/pinterest.js';
import { closeBrowser } from './render.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '40mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'ironstone-server' }));

app.use(exportRouter);
app.use(pinterestRouter);

// Central error handler — never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Export payload too large. Remove some images and try again.' });
  }
  console.error('[ironstone] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const server = app.listen(config.port, () => {
  console.log(`[ironstone] backend listening on http://localhost:${config.port}`);
  for (const w of configWarnings()) console.warn(`[ironstone] warning: ${w}`);
});

async function shutdown() {
  server.close();
  await closeBrowser();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
