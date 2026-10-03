import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Full product UI with controlled HTTP latency; no store or DOM state injection.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.PREVIEW_TEST_URL || 'http://127.0.0.1:5194';
const screenshots = process.env.PREVIEW_SCREENSHOT_DIR || tmpdir();
const appPattern = 'https://preview-loading-*.gemigo.test/**';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    await page.clock.install();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const app = {
        id: 'loading-a', name: '元素周期表', description: '互动学习应用',
        status: 'Live', repoUrl: 'demo.html', sourceType: 'html', framework: 'Unknown',
        url: 'https://preview-loading-a.gemigo.test/app', category: 'learning',
        createdAt: '2026-10-03T00:00:00Z', lastDeployed: '刚刚', appLanguage: { languages: ['zh'] },
        publicAuthor: { kind: 'profile', label: 'Demo', handle: 'demo-user', profileIdentifier: 'demo-user', identityKey: 'demo', anonymousCode: null },
    };
    const otherApp = { ...app, id: 'loading-b', name: '第二个应用', url: 'https://preview-loading-b.gemigo.test/app' };
    await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
        if (path === '/api/v1/me') return json({ user: null });
        if (path.endsWith('/reactions')) return json({});
        if (path.includes('/favorites')) return json({ projectIds: [] });
        if (path === '/api/v1/projects/explore' || path === '/api/v1/projects') return json({ items: [app, otherApp], total: 2, page: 1, pageSize: 100 });
        return json({ items: [], total: 0, page: 1, pageSize: 30 });
    });
    const pending = [];
    await page.context().route(appPattern, route => route.fulfill({ contentType: 'text/html', body: '<h1>New tab app</h1>' }));
    await page.route(appPattern, async route => {
        if (!route.request().isNavigationRequest()) return route.fulfill({ status: 404, body: '' });
        await new Promise(resolve => pending.push({ route, resolve }));
        try {
            await route.fulfill({ contentType: 'text/html', body: '<html><body style="background:#f5fafc;font-family:sans-serif;padding:24px"><h1>应用已打开</h1><button id="counter" onclick="this.textContent=String(Number(this.textContent)+1)">0</button></body></html>' });
        } catch { /* A superseded navigation can already have been cancelled. */ }
    });
    const waitRequests = async count => {
        for (let index = 0; index < 100 && pending.length < count; index++) await page.waitForTimeout(20);
        assert.equal(pending.length, count);
    };
    const state = name => page.locator(`[data-preview-state="${name}"]`);
    const a = page.locator('[data-preview-app-id="loading-a"]');
    const b = page.locator('[data-preview-app-id="loading-b"]');
    await page.goto(baseUrl);
    await a.waitFor();
    await a.hover();
    const hint = page.locator('head link[data-app-preview-preconnect]');
    assert.equal(await hint.getAttribute('href'), new URL(app.url).origin);
    await b.hover();
    assert.equal(await hint.count(), 1, 'Connection hint stays bounded across cards');
    assert.equal(await hint.getAttribute('href'), new URL(otherApp.url).origin);
    assert.equal(pending.length, 0, 'Hover does not load or execute any app');

    await a.click();
    await state('loading').waitFor();
    await waitRequests(1);
    assert.match(await page.getByRole('status').innerText(), /正在打开应用/);
    const frame = page.locator('iframe');
    const identity = await frame.elementHandle();
    assert.equal(await frame.getAttribute('inert'), '');
    assert.equal(await frame.evaluate(element => getComputedStyle(element).opacity), '0');
    await page.screenshot({ path: join(screenshots, 'preview-loading-light.png') });
    const jawStart = await page.locator('.preview-sprite-jaw').evaluate(element => getComputedStyle(element).clipPath);
    await page.waitForTimeout(170);
    assert.notEqual(await page.locator('.preview-sprite-jaw').evaluate(element => getComputedStyle(element).clipPath), jawStart, 'The single mouth opening actually animates');

    await page.getByRole('button', { name: '评论', exact: true }).click();
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    assert.ok(await identity.evaluate(element => element === document.querySelector('iframe')));
    assert.equal(pending.length, 1, 'Comments and fullscreen never reload the waiting app');
    await page.getByRole('button', { name: '退出全屏', exact: true }).click();
    await page.getByRole('button', { name: '评论', exact: true }).click();
    await page.clock.fastForward(10_001);
    await state('slow').waitFor();
    await page.screenshot({ path: join(screenshots, 'preview-loading-slow.png') });
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: '在新窗口打开', exact: true }).last().click();
    const popup = await popupPromise;
    await popup.waitForURL(app.url);
    assert.equal(popup.url(), app.url);
    await popup.close();
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await state('loading').waitFor();
    await waitRequests(2);
    assert.ok(!(await identity.evaluate(element => element.isConnected)), 'Retry starts a fresh iframe navigation');
    pending[0].resolve();
    await page.waitForTimeout(100);
    assert.equal(await state('loading').count(), 1, 'A cancelled attempt cannot reveal the current one');
    pending[1].resolve();
    await state('visible').waitFor();
    assert.equal(await page.getByRole('status').count(), 0);
    assert.equal(await frame.getAttribute('inert'), null);
    const counter = page.frameLocator('iframe').locator('#counter');
    await counter.click();
    assert.equal(await counter.innerText(), '1');
    const loadedIdentity = await frame.elementHandle();
    await page.getByRole('button', { name: '评论', exact: true }).click();
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    assert.ok(await loadedIdentity.evaluate(element => element === document.querySelector('iframe')));
    assert.equal(await counter.innerText(), '1', 'App interaction progress survives layout changes');
    await page.getByRole('button', { name: '退出全屏', exact: true }).click();

    // Switch to a slow app; reduced motion and dark theme use product settings.
    await b.click();
    await waitRequests(3);
    await state('loading').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '切换主题', exact: true }).click();
    assert.ok(await page.locator('html').evaluate(element => element.classList.contains('dark')));
    assert.equal(await page.locator('.preview-sprite-jaw').evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.screenshot({ path: join(screenshots, 'preview-loading-dark.png') });
    await page.setViewportSize({ width: 1100, height: 820 });
    await page.clock.fastForward(10_001);
    await state('slow').waitFor();
    await page.screenshot({ path: join(screenshots, 'preview-loading-narrow.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: '直接显示应用', exact: true }).click();
    await state('visible').waitFor();
    assert.equal(await frame.evaluate(element => document.activeElement === element), true, 'Reveal keeps keyboard focus usable');
    pending[2].resolve();
    await page.frameLocator('iframe').locator('#counter').waitFor();

    // A previous app finishes after switching: it must not dismiss the new loader.
    await a.click();
    await waitRequests(4);
    await b.click();
    await waitRequests(5);
    pending[3].resolve();
    await page.waitForTimeout(100);
    assert.equal(await state('loading').count(), 1);
    assert.equal(await frame.getAttribute('title'), otherApp.name);
    pending[4].resolve();
    await state('visible').waitFor();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await frame.waitFor({ state: 'detached' });

    // A fast app has no artificial minimum hold. Fulfill on navigation immediately.
    await page.unroute('https://preview-loading-*.gemigo.test/**');
    await page.route('https://preview-loading-*.gemigo.test/**', route => route.fulfill({ contentType: 'text/html', body: '<button id="fast">Ready</button>' }));
    await a.click();
    await state('visible').waitFor();
    await page.frameLocator('iframe').locator('#fast').click();
    assert.equal(await page.getByRole('status').count(), 0);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '语言设置 / Language settings', exact: true }).click();
    await page.getByRole('group', { name: '网站显示语言', exact: true }).getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: '语言设置 / Language settings', exact: true }).click();
    await page.route('https://preview-loading-*.gemigo.test/**', route => new Promise(resolve => pending.push({ route, resolve })));
    await a.click();
    await state('loading').waitFor();
    assert.match(await page.getByRole('status').innerText(), /Opening app/);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const mobilePopupPromise = page.waitForEvent('popup');
    await a.click();
    const mobilePopup = await mobilePopupPromise;
    await mobilePopup.waitForURL(app.url);
    assert.equal(mobilePopup.url(), app.url);
    assert.equal(await page.locator('iframe').count(), 0, 'Mobile still opens a new tab');
    await mobilePopup.close();
    assert.deepEqual(errors, []);
    console.log('PASS: immediate feedback, animation, load reveal, slow/retry/show/new-tab, stale navigation, layout preservation, reduced motion, responsive UI, languages, bounded preconnect and mobile.');
} finally {
    await browser.close();
}
