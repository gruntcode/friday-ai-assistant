/**
 * Renders static/images/friday-banner.html to static/images/friday-banner.png.
 *
 * The banner is committed as a PNG so the README works everywhere, but the source
 * of truth is the HTML — edit that, then re-run this to regenerate.
 *
 * Usage:
 *   npm install --no-save playwright   # or: npx playwright install chromium
 *   node scripts/render-banner.js
 *
 * Renders at deviceScaleFactor 2 so the image stays crisp on retina displays.
 */

const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'static', 'images', 'friday-banner.html');
const OUT = path.join(ROOT, 'static', 'images', 'friday-banner.png');

const WIDTH = 1200;
const HEIGHT = 420;

(async () => {
  // Prefer a locally installed Chrome; fall back to Playwright's bundled Chromium.
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    browser = await chromium.launch();
  }

  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  await page.goto('file://' + SRC, { waitUntil: 'load' });
  // Let gradients, blurs and webfonts settle before capturing.
  await page.waitForTimeout(600);

  await page.locator('.banner').screenshot({ path: OUT });
  await browser.close();

  console.log(`Wrote ${path.relative(ROOT, OUT)} at ${WIDTH * 2}x${HEIGHT * 2}`);
})().catch((err) => {
  console.error('Banner render failed:', err.message);
  process.exit(1);
});
