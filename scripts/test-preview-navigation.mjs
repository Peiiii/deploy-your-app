import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.PREVIEW_TEST_URL || 'http://127.0.0.1:5191';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const apps = ['a', 'b', 'c'].map(id => ({
    id, ownerId: 'other', name: `网站 ${id}`, description: '导航验证', status: 'Live',
    repoUrl: 'demo.html', sourceType: 'html', framework: 'Unknown',
    url: `${baseUrl}/fixture-${id}`, category: 'learning',
    createdAt: '2026-10-03T00:00:00Z', lastDeployed: '刚刚', appLanguage: { languages: ['zh'] },
  }));
  let items = apps;
  let user = null;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/me')) return json({ user });
    if (path.endsWith('/projects/explore') || path.endsWith('/projects')) return json({ items, total: items.length, page: 1, pageSize: 100 });
    if (path.endsWith('/reactions')) return json({ likesCount: 0, favoritesCount: 0, likedByCurrentUser: false, favoritedByCurrentUser: false });
    return json({ items: [], total: 0, page: 1, pageSize: 30 });
  });
  await page.route('**/fixture-*', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="padding:100px"><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button></body></html>' }));
  const previous = page.getByRole('button', { name: '上一个网站', exact: true });
  const next = page.getByRole('button', { name: '下一个网站', exact: true });
  const nav = page.getByRole('toolbar', { name: '切换网站', exact: true });
  const handle = page.getByRole('button', { name: '应用操作', exact: true });
  const dock = handle.locator('..').locator('..');
  const expectFrame = async id => {
    await page.locator(`iframe[title="网站 ${id}"]`).waitFor();
    assert.equal(await page.locator('iframe').count(), 1);
    await page.frameLocator(`iframe[title="网站 ${id}"]`).locator('#counter').click();
    assert.equal(await page.frameLocator(`iframe[title="网站 ${id}"]`).locator('#counter').innerText(), '1');
  };
  const noOverlap = async label => {
    await page.waitForTimeout(350);
    const n = await nav.boundingBox();
    const d = await dock.boundingBox();
    assert.ok(n && d, label);
    assert.ok(d.y + d.height <= n.y - 8, `${label}: dock ${JSON.stringify(d)} above navigation ${JSON.stringify(n)}`);
    assert.ok(n.y >= 0 && n.y + n.height <= page.viewportSize().height, `${label}: navigation visible`);
  };
  const sameAppearance = async label => {
    await page.mouse.move(600, 400);
    await page.waitForTimeout(750);
    assert.equal(await dock.getAttribute('role'), 'toolbar', `${label}: matching semantics`);
    assert.equal(await nav.getAttribute('aria-orientation'), 'vertical');
    assert.equal((await nav.boundingBox()).width, (await dock.boundingBox()).width, `${label}: identical outer width`);
    const surfaceStyle = locator => locator.evaluate(element => {
      const style = getComputedStyle(element);
      return Object.fromEntries(['width', 'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderColor', 'borderTopLeftRadius', 'borderTopRightRadius', 'backgroundColor', 'boxShadow', 'backdropFilter'].map(key => [key, style[key]]));
    });
    assert.deepEqual(await surfaceStyle(nav.locator('[data-floating-dock-surface]')), await surfaceStyle(dock.locator('[data-floating-dock-surface]')), `${label}: shared surface`);
    const topAction = dock.getByRole('button', { name: '评论', exact: true });
    const bottomAction = next;
    const buttonStyle = locator => locator.evaluate(element => {
      const style = getComputedStyle(element);
      const icon = element.querySelector('svg').getBoundingClientRect();
      return Object.fromEntries(['width', 'height', 'paddingLeft', 'paddingRight', 'borderRadius', 'color', 'backgroundColor', 'outlineStyle', 'boxShadow'].map(key => [key, style[key]]).concat([['iconWidth', icon.width], ['iconHeight', icon.height]]));
    });
    assert.deepEqual(await buttonStyle(topAction), await buttonStyle(bottomAction), `${label}: shared action geometry and resting feedback`);
    await topAction.hover();
    await page.waitForTimeout(750);
    const topHover = await buttonStyle(topAction);
    await bottomAction.hover();
    await page.waitForTimeout(750);
    assert.deepEqual(topHover, await buttonStyle(bottomAction), `${label}: identical hover feedback`);
    await page.mouse.move(600, 400);
    await topAction.focus();
    await page.waitForTimeout(750);
    const topFocus = await buttonStyle(topAction);
    await bottomAction.focus();
    await page.waitForTimeout(750);
    assert.deepEqual(topFocus, await buttonStyle(bottomAction), `${label}: identical keyboard focus feedback`);
    await bottomAction.evaluate(element => element.blur());
  };
  const open = async path => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}${path}?lang=zh-CN`);
    await page.locator('[data-preview-app-id]').first().waitFor();
    const order = await page.locator('[data-preview-app-id]').evaluateAll(cards => cards.map(card => card.dataset.previewAppId));
    await page.locator('[data-preview-app-id]').first().click();
    await expectFrame(order[0]);
    return order;
  };
  for (const path of ['/', '/explore']) {
    const order = await open(path);
    assert.equal(await previous.isDisabled(), true);
    await noOverlap(`${path} half`);
    await sameAppearance(`${path} half`);
    const frameIdentity = await page.locator('iframe').elementHandle();
    await page.getByRole('button', { name: '评论', exact: true }).click();
    await page.locator('[data-preview-comments="open"]').waitFor();
    assert.equal(await frameIdentity.evaluate(element => element.isConnected), true, 'Comments preserve iframe');
    await page.getByRole('button', { name: '评论', exact: true }).click();
    await next.focus();
    await page.keyboard.press('Enter');
    await expectFrame(order[1]);
    assert.equal(await previous.isEnabled(), true);
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    await next.click();
    await expectFrame(order[2]);
    assert.equal(await next.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '退出全屏', exact: true, includeHidden: true }).count(), 1);
    await previous.click();
    await expectFrame(order[1]);
    await previous.click();
    await expectFrame(order[0]);
    await handle.click(); // Pin expanded in fullscreen.
    await sameAppearance(`${path} fullscreen`);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await sameAppearance(`${path} dark`);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    for (const [width, height] of [[1440, 900], [1100, 360], [1100, 240], [800, 300]]) {
      await page.setViewportSize({ width, height });
      await noOverlap(`${path} fullscreen ${width}x${height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, 890, { steps: 15 });
    await noOverlap(`${path} while dragging to bottom`);
    await page.mouse.up();
    await noOverlap(`${path} after drop`);
    await page.setViewportSize({ width: 1100, height: 240 });
    await noOverlap(`${path} resize after drop`);
    await dock.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByRole('button', { name: '退出全屏', exact: true }).click();
    await noOverlap(`${path} short half`);
    await dock.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    assert.equal(await nav.count(), 0);
  }
  user = { id: 'me', email: 'demo@example.com', displayName: 'Demo', handle: 'demo-user', avatarUrl: null, providers: { email: true } };
  items = apps.map(app => ({ ...app, ownerId: 'me' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/dashboard?lang=zh-CN`);
  const previewButtons = page.getByRole('button', { name: /^预览应用:/ });
  await previewButtons.first().waitFor();
  const dashboardOrder = await previewButtons.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label').slice(-1)));
  await previewButtons.first().click();
  await expectFrame(dashboardOrder[0]);
  await next.click();
  await expectFrame(dashboardOrder[1]);
  await next.click();
  await expectFrame(dashboardOrder[2]);
  assert.equal(await next.isDisabled(), true, 'Dashboard follows displayed ordering');
  await noOverlap('owner dock with settings');
  user = null;
  items = [apps[0], { ...apps[1], url: null }, apps[2]];
  await open('/');
  await next.click();
  await expectFrame('c');
  assert.equal(await next.isDisabled(), true, 'Skip inaccessible websites');
  items = [apps[1]];
  await open('/');
  assert.equal(await previous.isDisabled(), true);
  assert.equal(await next.isDisabled(), true);
  await page.screenshot({ path: join(tmpdir(), 'gemigo-preview-navigation-half.png') });
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await handle.click();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await noOverlap('dark expanded');
  const disabledOpacity = await next.evaluate(element => getComputedStyle(element).opacity);
  assert.equal(disabledOpacity, '0.4', 'Shared disabled style');
  await page.screenshot({ path: join(tmpdir(), 'gemigo-preview-navigation-dark.png') });
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: home/explore/dashboard order, keyboard, boundaries, single/URL-less apps, fullscreen retention, iframe interaction, close, resize/expand/drag collision, dark mode');
} finally {
  await browser.close();
}
