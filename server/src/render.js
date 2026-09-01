import puppeteer from 'puppeteer';
import { config } from './config.js';

/**
 * Single shared headless browser, one tab per render job.
 * Memory-conscious flags for Render's free tier.
 */
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    browserPromise.catch(() => {
      browserPromise = null; // allow retry on next job
    });
  }
  return browserPromise;
}

/**
 * Renders a moodboard to PDF by driving the frontend's hidden print route.
 * The route pulls the transient payload itself (signed token in the URL), so
 * the PDF always matches the editor's HTML/CSS exactly.
 */
export async function renderPdf({ projectId, jobId, token }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    const url = `${config.frontendBaseUrl}/export-render/${projectId}?job=${encodeURIComponent(
      jobId,
    )}&token=${encodeURIComponent(token)}`;
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('[data-render-ready="true"]', { timeout: 60000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    if (browser) await browser.close().catch(() => {});
  }
}
