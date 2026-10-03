import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.BOOTSTRAP_TEST_URL || 'http://127.0.0.1:5311';
const screenshots = process.env.BOOTSTRAP_SCREENSHOT_DIR || tmpdir();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const bootstrap = page => page.locator('.app-bootstrap');

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: width === 390 ? 'reduce' : 'no-preference',
    });
    if (width === 1440) {
      await page.addInitScript(() => localStorage.setItem('gemigo-ui-preferences',
        JSON.stringify({ state: { sidebarCollapsed: true }, version: 0 })));
    }
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/index-*.js', async route => {
      await ready;
      await route.continue();
    });
    // Observe real rendered frames throughout module download and React commit.
    await page.addInitScript(() => {
      window.startupFrames = [];
      const inspect = () => {
        const intro = document.querySelector('#root > .seo-content');
        if (intro) {
          const rect = intro.getBoundingClientRect();
          window.startupFrames.push(rect.width > 0 && rect.height > 0);
        }
        if (!document.querySelector('#root button')) requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    });
    await page.goto(baseUrl + '/explore?lang=zh-CN', { waitUntil: 'commit' });
    await bootstrap(page).waitFor({ state: 'visible' });
    assert.equal(await page.locator('#root > .seo-content').isVisible(), false);
    await page.waitForTimeout(200);
    const shell = await bootstrap(page).boundingBox();
    assert.ok(shell.width <= width && shell.height >= 900, 'Startup fits viewport');
    if (width === 1440) {
      assert.equal(await page.locator('.app-bootstrap-sidebar').evaluate(el => el.getBoundingClientRect().width), 64);
    } else {
      assert.equal(await page.locator('.app-bootstrap-sidebar').isVisible(), false);
      assert.equal(await page.locator('.app-bootstrap-card').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    }
    await page.screenshot({ path: join(screenshots, 'page-bootstrap-' + width + '.png') });
    release();
    await page.getByRole('button', { name: '视频流模式', exact: true }).waitFor();
    assert.equal(await bootstrap(page).isVisible(), false);
    const frames = await page.evaluate(() => window.startupFrames);
    assert.ok(frames.length > 2, 'Recorded actual pre-commit frames');
    assert.ok(frames.every(visible => !visible), 'Static intro never flashes in a painted frame');
    await page.getByRole('button', { name: '视频流模式', exact: true }).click();
    assert.equal(await bootstrap(page).isVisible(), false, 'Navigation cannot revive startup shell');
    await page.close();
  }

  const failed = await browser.newPage();
  await failed.route('**/assets/index-*.js', route => route.abort('failed'));
  await failed.goto(baseUrl, { waitUntil: 'load' });
  await failed.locator('#root > .seo-content').waitFor({ state: 'visible' });
  assert.equal(await bootstrap(failed).isVisible(), false, 'Failed module restores readable fallback');
  assert.ok(await failed.getByRole('link', { name: 'Publish an app', exact: true }).count());
  await failed.close();

  const denied = await browser.newPage();
  await denied.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  });
  await denied.goto(baseUrl);
  await denied.locator('#root > .seo-content').waitFor({ state: 'visible' });
  assert.equal(await bootstrap(denied).isVisible(), false, 'An upstream startup error must not leave an indefinite skeleton');
  await denied.close();

  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(baseUrl);
  assert.equal(await noJs.locator('#root > .seo-content').isVisible(), true);
  assert.equal(await bootstrap(noJs).isVisible(), false);
  assert.ok((await noJs.locator('h1').innerText()).length > 0);
  await noJs.close();

  console.log('Page bootstrap: slow module frames, desktop/mobile, collapsed sidebar, denied storage, handoff, failure and no-JS passed');
} finally {
  await browser.close();
}
