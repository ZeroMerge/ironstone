import puppeteer from 'puppeteer';
import { config } from './config.js';

/**
 * Single shared headless browser, one tab per render job.
 * Memory-conscious flags for Render's free tier.
 */
let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-default-apps',
        '--mute-audio',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-breakpad',
        '--disable-sync',
        '--disable-translate',
      ],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browserPromise = puppeteer.launch(launchOptions);
    browserPromise.catch((err) => {
      console.error('[ironstone] Failed to launch Chromium:', err);
      browserPromise = null; // allow retry on next job
    });
  }
  return browserPromise;
}

/** Pre-warms the Chromium process in the background so export jobs don't wait for browser boot. */
export function warmBrowser() {
  getBrowser().catch(() => {});
}

/**
 * Renders a moodboard to PDF by driving the frontend's hidden print route.
 * The route pulls the transient payload itself (signed token in the URL), so
 * the PDF always matches the editor's HTML/CSS exactly.
 */
export async function renderPdf({ projectId, jobId, token, format = 'a4-landscape', payload }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    page.on('console', msg => console.log('[puppeteer page]', msg.text()));
    page.on('pageerror', err => console.error('[puppeteer error]', err));

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

    // Direct memory injection: avoids any cross-origin network fetch failure inside the headless browser
    if (payload) {
      await page.evaluateOnNewDocument((data) => {
        window.__EXPORT_PAYLOAD__ = data;
      }, payload);
    }

    const url = `${config.frontendBaseUrl}/export-render/${projectId}?job=${encodeURIComponent(
      jobId,
    )}&token=${encodeURIComponent(token)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-render-ready="true"]', { timeout: 30000 });

    const errorEl = await page.$('[data-render-error]');
    if (errorEl) {
      const errMsg = await page.evaluate(el => el.getAttribute('data-render-error'), errorEl);
      throw new Error(`Client render error: ${errMsg}`);
    }

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
