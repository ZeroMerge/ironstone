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
export async function renderPdf({ projectId, jobId, token, format = 'a4-landscape' }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const isScreen = format === 'screen-16-9';
    const isPortrait = format === 'a4-portrait';
    
    // Set high-DPI rendering viewport matching format geometry
    if (isScreen) {
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    } else if (isPortrait) {
      await page.setViewport({ width: 1200, height: 1697, deviceScaleFactor: 2 });
    } else {
      await page.setViewport({ width: 1697, height: 1200, deviceScaleFactor: 2 });
    }

    const url = `${config.frontendBaseUrl}/export-render/${projectId}?job=${encodeURIComponent(
      jobId,
    )}&token=${encodeURIComponent(token)}`;

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('[data-render-ready="true"]', { timeout: 60000 });
    await page.emulateMediaType('print');
    
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
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
