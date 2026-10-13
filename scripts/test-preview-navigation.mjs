import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
const faviconSource = readFileSync(new URL('../workers/r2-gateway/smart-favicon.ts', import.meta.url), 'utf8').split('String.raw`')[1].split('`;')[0];

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
  await page.route('**/favicon.ico', route => route.fulfill({ status: 404, body: '' }));
  await page.route('**/fixture-*', route => {
    const id = new URL(route.request().url()).pathname.slice(-1);
    const icon = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${id === 'a' ? 'red' : id === 'b' ? 'green' : 'blue'}"/></svg>`);
    return route.fulfill({ contentType: 'text/html', body: `<html><head><title>网站 ${id}</title><link rel="icon" href="${icon}"></head><body style="padding:100px"><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button><script>addEventListener('message',event=>{if(event.data?.type==='gemigo:request-favicon')window.lastIconRequest=event.data.requestId});${faviconSource}</script></body></html>` });
  });
  const previous = page.getByRole('button', { name: '上一个网站', exact: true });
  const next = page.getByRole('button', { name: '下一个网站', exact: true });
  const nav = page.getByRole('toolbar', { name: '切换网站', exact: true });
  const handle = page.getByRole('img', { name: 'GemiGo', exact: true });
  const dock = handle.locator('..').locator('..');
  const expectFrame = async id => {
    await page.locator(`iframe[title="网站 ${id}"]`).waitFor();
    assert.equal(await page.locator('iframe').count(), 1);
    await page.frameLocator(`iframe[title="网站 ${id}"]`).locator('#counter').click();
    assert.equal(await page.frameLocator(`iframe[title="网站 ${id}"]`).locator('#counter').innerText(), '1');
    const identity = nav.getByRole('img', { name: `网站 ${id}`, exact: true });
    await identity.waitFor();
    await page.waitForFunction(({ id }) => {
      const image = document.querySelector('[role="toolbar"][aria-label="切换网站"] img');
      return image?.src.startsWith('data:image/svg+xml,') && decodeURIComponent(image.src).includes(id === 'a' ? 'red' : id === 'b' ? 'green' : 'blue') && image.naturalWidth > 0;
    }, { id });

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
    const topAction = dock.getByRole('button', { name: '评论', exact: true, includeHidden: true });
    const bottomAction = next;
    const buttonStyle = locator => locator.evaluate(element => {
      const style = getComputedStyle(element);
      const icon = element.querySelector('svg').getBoundingClientRect();
      const feedback = getComputedStyle(element, '::before');
      return Object.fromEntries(['width', 'height', 'paddingLeft', 'paddingRight', 'borderRadius', 'color', 'backgroundColor', 'outlineStyle', 'boxShadow'].map(key => [key, style[key]]).concat([['iconWidth', icon.width], ['iconHeight', icon.height], ['feedbackWidth', feedback.width], ['feedbackHeight', feedback.height], ['feedbackBackground', feedback.backgroundColor], ['feedbackShadow', feedback.boxShadow]]));
    });
    const actionAreaPadding = await nav.locator('[data-floating-dock-actions]').evaluate(element => ({ top: getComputedStyle(element).paddingTop, bottom: getComputedStyle(element).paddingBottom }));
    assert.deepEqual(actionAreaPadding, { top: '4px', bottom: '4px' }, `${label}: symmetric vertical padding`);
    const feedbackSize = await buttonStyle(bottomAction);
    assert.equal(feedbackSize.feedbackWidth, '24px');
    assert.equal(feedbackSize.feedbackHeight, '24px');
    assert.equal(feedbackSize.width, '32px', 'Hit area remains unchanged');
    assert.deepEqual(await buttonStyle(topAction), await buttonStyle(bottomAction), `${label}: shared action geometry and resting feedback`);
    await handle.hover();
    await topAction.hover();
    await page.waitForTimeout(750);
    const topHover = await buttonStyle(topAction);
    assert.equal(topHover.backgroundColor, 'rgba(0, 0, 0, 0)', 'Hover never paints the entire hit area');
    assert.notEqual(topHover.feedbackBackground, 'rgba(0, 0, 0, 0)', 'Hover paints the smaller feedback');
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
    if (path === '/') {
      await previous.hover();
      await page.waitForTimeout(750);
      await nav.screenshot({ path: join(tmpdir(), 'gemigo-navigation-feedback-hover.png') });
      await previous.focus();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(750);
      await nav.screenshot({ path: join(tmpdir(), 'gemigo-navigation-feedback-focus.png') });
    }
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    await next.click();
    await expectFrame(order[2]);
    assert.equal(await next.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '退出全屏', exact: true, includeHidden: true }).count(), 1);
    await previous.click();
    await expectFrame(order[1]);
    await previous.click();
    await expectFrame(order[0]);
    await handle.focus(); // Identity focus exposes actions without button behavior.
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
    const detached = await dock.locator('[data-floating-dock-surface]').evaluate(element => { const s = getComputedStyle(element); return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius, s.borderLeftWidth, s.borderRightWidth]; });
    assert.ok(detached.slice(0, 4).every(radius => parseFloat(radius) > 0), 'Detached capsule rounds all four corners');
    assert.deepEqual(detached.slice(4), ['1px', '1px'], 'Detached capsule has a complete border');
    await page.mouse.up();
    await noOverlap(`${path} after drop`);
    const docked = await dock.locator('[data-floating-dock-surface]').evaluate(element => getComputedStyle(element).borderTopLeftRadius);
    assert.equal(docked, '0px', 'Left docking restores the flush edge');
    await page.setViewportSize({ width: 1100, height: 240 });
    await noOverlap(`${path} resize after drop`);
    await dock.hover();
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
  const identity = nav.getByRole('img', { name: '网站 b', exact: true });
  const actualFrame = page.frames().find(frame => frame.parentFrame() === page.mainFrame());
  const requestId = await actualFrame.evaluate(() => window.lastIconRequest);
  const beforeSpoof = await identity.locator('img').getAttribute('src');
  await page.evaluate(requestId => window.dispatchEvent(new MessageEvent('message', {
    source: document.querySelector('iframe').contentWindow, origin: 'https://wrong.test',
    data: { type: 'gemigo:favicon', requestId, href: 'https://wrong.test/icon.png' },
  })), requestId);
  await actualFrame.evaluate(() => parent.postMessage({ type: 'gemigo:favicon', requestId: 'old-document', href: 'https://wrong.test/stale.png' }, location.origin));
  await page.waitForTimeout(100);
  assert.equal(await identity.locator('img').getAttribute('src'), beforeSpoof, 'Wrong origin and stale document nonce are rejected');
  await page.route('**/missing-favicon.png', route => route.fulfill({ status: 404, body: '' }));
  await actualFrame.evaluate(requestId => parent.postMessage({ type: 'gemigo:favicon', requestId, href: location.origin + '/missing-favicon.png' }, location.origin), requestId);
  await identity.locator('img').waitFor({ state: 'detached' });
  assert.equal(await identity.locator('svg').count(), 1, 'Broken favicon falls back to a website marker');
  await actualFrame.evaluate(({ requestId, href }) => parent.postMessage({ type: 'gemigo:favicon', requestId, href }, location.origin), { requestId, href: beforeSpoof });
  await identity.locator('img').waitFor();
  await identity.hover();
  await page.getByRole('tooltip').waitFor();
  assert.equal(await page.getByRole('tooltip').innerText(), '网站 b', 'Current application name tooltip');
  assert.equal(await identity.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Identity hover is passive');
  await identity.click();
  assert.equal(await identity.getAttribute('aria-expanded'), null, 'Identity never toggles expansion');
  await page.mouse.move(600, 400);
  await identity.evaluate(element => element.blur());
  await identity.focus();
  await page.getByRole('tooltip').waitFor();
  assert.equal(await page.getByRole('tooltip').innerText(), '网站 b', 'Identity keyboard focus also names the application');
  await handle.hover();
  assert.equal(await handle.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Brand identity never has button hover feedback');
  await page.screenshot({ path: join(tmpdir(), 'gemigo-preview-navigation-half.png') });
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await handle.focus();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await noOverlap('dark expanded');
  const disabledOpacity = await next.evaluate(element => getComputedStyle(element).opacity);
  assert.equal(disabledOpacity, '0.4', 'Shared disabled style');
  await next.hover();
  await page.waitForTimeout(750);
  assert.equal(await next.evaluate(element => getComputedStyle(element, '::before').backgroundColor), 'rgba(0, 0, 0, 0)', 'Disabled action has no hover feedback');
  await page.screenshot({ path: join(tmpdir(), 'gemigo-preview-navigation-dark.png') });
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: home/explore/dashboard order, keyboard, boundaries, single/URL-less apps, fullscreen retention, iframe interaction, close, resize/expand/drag collision, dark mode');
} finally {
  await browser.close();
}
