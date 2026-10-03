import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run against the full frontend dev server. Only HTTP data and the embedded
// test application are fixtures; layout, focus, animation and UI are real.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.PREVIEW_TEST_URL || 'http://localhost:5191';
const screenshotDir = process.env.PREVIEW_SCREENSHOT_DIR || tmpdir();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let user = null;
  let posts = 0;
  let frameLoads = 0;
  let commentReads = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  let comments = Array.from({ length: 45 }, (_, index) => ({
    id: `c${index}`, projectId: 'preview-app', content: `评论 ${index}：边用应用边交流。`,
    createdAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z',
    author: { id: 'me', handle: 'demo-user', displayName: 'Demo', avatarUrl: null },
    replyTo: null, canDelete: true,
  }));
  const app = {
    id: 'preview-app', ownerId: 'me', name: '元素周期表', description: '互动学习应用',
    status: 'Live', repoUrl: 'demo.html', sourceType: 'html', framework: 'Unknown',
    url: `${baseUrl}/fixture-app`, category: 'learning',
    createdAt: '2026-10-03T00:00:00Z', lastDeployed: '刚刚', appLanguage: { languages: ['zh'] },
    publicAuthor: { kind: 'profile', label: 'Demo', handle: 'demo-user', profileIdentifier: 'demo-user', identityKey: 'demo', anonymousCode: null },
  };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/v1/me') return json({ user });
    if (path.includes('/comments')) {
      if (request.method() === 'POST') {
        posts++;
        const input = request.postDataJSON();
        const created = { ...comments[0], id: `new${posts}`, content: input.content, replyTo: input.replyToCommentId ? { commentId: input.replyToCommentId, handle: 'demo-user' } : null };
        comments.unshift(created);
        return json({ comment: created });
      }
      if (request.method() === 'DELETE') {
        comments = comments.filter(comment => !path.endsWith(comment.id));
        return json({ success: true });
      }
      commentReads++;
      const currentPage = Number(url.searchParams.get('page') || 1);
      return json({ items: comments.slice((currentPage - 1) * 30, currentPage * 30), total: comments.length, page: currentPage, pageSize: 30 });
    }
    if (path === '/api/v1/projects/reactions') return json({});
    if (path.endsWith('/reactions')) return json({ likesCount: 0, favoritesCount: 0, likedByCurrentUser: false, favoritedByCurrentUser: false });
    if (path === '/api/v1/projects/explore' || path === '/api/v1/projects') return json({ items: [app, { ...app, id: 'other-app', ownerId: 'other', name: '第二个应用' }], total: 2, page: 1, pageSize: 100 });
    if (path.includes('/favorites')) return json({ projectIds: [] });
    return json({ items: [], total: 0, page: 1, pageSize: 30 });
  });
  await page.route('**/fixture-app', route => {
    frameLoads++;
    return route.fulfill({ contentType: 'text/html', body: '<html><body style="background:#f5fafc;font-family:sans-serif;padding:24px"><h1>元素周期表</h1><div style="background:#abe6db;border-radius:20px;width:90px;padding:24px;font-size:50px">H</div><p>评论打开时，应用仍然可以操作。</p><button id="counter" onclick="this.textContent=String(Number(this.textContent)+1)">0</button></body></html>' });
  });
  await page.goto(baseUrl);
  const card = page.locator('[data-preview-app-id="preview-app"]');
  await card.waitFor();
  const cardLike = card.getByRole('button', { name: '点赞', exact: true });
  const hitArea = await cardLike.boundingBox();
  assert.ok(hitArea.width >= 32 && hitArea.height >= 32, 'Card like has a padded target of at least 32px');
  const restingColor = await cardLike.evaluate(element => getComputedStyle(element).backgroundColor);
  await cardLike.hover();
  await page.getByRole('tooltip').waitFor();
  const hoveredStyle = await cardLike.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, radius: parseFloat(getComputedStyle(element).borderRadius) }));
  assert.notEqual(hoveredStyle.background, restingColor, 'Card like has visible hover feedback');
  assert.ok(hoveredStyle.radius >= 6, 'Card like feedback is a rounded rectangle');
  const likeRequest = page.waitForRequest(request => request.method() === 'POST' && /\/like$/.test(new URL(request.url()).pathname));
  await cardLike.click({ position: { x: 2, y: 2 } });
  await likeRequest;
  assert.equal(await page.locator('iframe').count(), 0, 'Clicking like padding does not open the card preview');
  await card.click();
  const frame = page.locator('iframe[title="元素周期表"]');
  const iframeIdentity = await frame.elementHandle();
  const counter = page.frameLocator('iframe[title="元素周期表"]').locator('#counter');
  await counter.click();
  assert.equal(await counter.innerText(), '1');
  const toggle = page.getByRole('button', { name: '评论', exact: true });
  await page.waitForTimeout(350);
  const expectTooltip = async (target, name) => {
    const dialogBox = await page.getByRole('dialog').count() ? await page.getByRole('dialog').boundingBox() : null;
    const away = dialogBox ? { x: dialogBox.x + 40, y: dialogBox.y + 80 } : { x: 400, y: 700 };
    await page.mouse.move(away.x, away.y, { steps: 8 });
    await page.mouse.move(away.x + 10, away.y);
    await page.waitForTimeout(100);
    await target.hover();
    const tip = page.getByRole('tooltip');
    await tip.waitFor({ timeout: 4000 });
    assert.ok((await tip.innerText()).includes(name), `Tooltip names ${name}`);
    const content = page.locator('[data-radix-popper-content-wrapper]').filter({ has: tip });
    const box = await content.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width && box.y + box.height <= page.viewportSize().height, 'Tooltip stays in viewport');
    assert.equal(await target.getAttribute('title'), null, 'No duplicate native tooltip');

    await page.mouse.move(away.x, away.y, { steps: 8 });
    await page.mouse.move(away.x + 10, away.y);
    await tip.waitFor({ state: 'detached' });
  };
  await expectTooltip(page.getByRole('button', { name: '点赞', exact: true }).last(), '点赞');
  await expectTooltip(toggle, '评论');
  await expectTooltip(page.getByRole('link', { name: 'GitHub', exact: true }), 'GitHub');
  await toggle.focus();
  await page.getByRole('tooltip').waitFor();
  assert.ok((await page.getByRole('tooltip').innerText()).includes('评论'), 'Keyboard focus shows the same name');
  await toggle.press('Escape');
  await page.getByRole('tooltip').waitFor({ state: 'detached' });
  const handle = page.getByRole('button', { name: '应用操作', exact: true });
  const dockRoot = handle.locator('..').locator('..');
  const dockBox = await dockRoot.boundingBox();
  const parkedStyle = await dockRoot.getAttribute('style');
  await dockRoot.click({ position: { x: dockBox.width - 1, y: 60 } });
  await page.waitForTimeout(100);
  assert.equal(await dockRoot.getAttribute('style'), parkedStyle, 'Edge clicks never start docking');
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 20, handleBox.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(100);
  assert.equal(await dockRoot.getAttribute('style'), parkedStyle, 'Press without movement keeps docking');
  assert.notEqual(await frame.evaluate(e => getComputedStyle(e.parentElement).pointerEvents), 'none');
  await page.mouse.move(handleBox.x + 22, handleBox.y + 22);
  assert.equal(await dockRoot.getAttribute('style'), parkedStyle, 'Small pointer jitter is a click');
  await page.mouse.up();
  await handle.click({ button: 'right' });
  assert.equal(await dockRoot.getAttribute('style'), parkedStyle, 'Right-click never drags');
  const initialX = (await frame.boundingBox()).x;
  const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
  await page.evaluate(() => {
    window.previewAnimationPositions = [];
    const start = performance.now();
    const observe = () => {
      window.previewAnimationPositions.push(document.querySelector('iframe[title="元素周期表"]').getBoundingClientRect().x);
      if (performance.now() - start < 600) requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  await toggle.click();
  const panel = page.getByRole('complementary', { name: /^评论/ });
  await panel.locator('article').first().waitFor();
  await page.waitForTimeout(300);
  const finalX = (await frame.boundingBox()).x;
  console.log('Drawer geometry', { initialX, finalX }, await panel.evaluate(element => ({width:element.getBoundingClientRect().width, margin:getComputedStyle(element.parentElement).marginLeft})));
  await page.screenshot({path:join(screenshotDir,'comments-sidepanel-opening.png')});
  assert.ok(finalX - initialX > 180, 'The app makes space next to the left panel');
  const positions = await page.evaluate(() => window.previewAnimationPositions);
  assert.ok(positions.some(x => x > initialX + 1 && x < finalX - 1), `Opening has an intermediate layout position: ${positions}`);
  const panelBox = await panel.boundingBox();
  assert.ok(Math.abs(panelBox.x + panelBox.width - finalX) < 2, 'Comments are directly adjacent to the app');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.body.style.overflow), bodyOverflow);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '评论', 'No autofocus jump into comments');
  await counter.click();
  assert.equal(await counter.innerText(), '2', 'Iframe remains interactive without forcing clicks');
  const search = page.getByPlaceholder('搜索应用...');
  await search.fill('测试');
  assert.equal(await search.inputValue(), '测试', 'Main page remains interactive');
  await search.fill('');
  const input = panel.getByRole('textbox');
  await input.fill('保留这段草稿');
  const scroll = panel.locator('[aria-busy]');
  await scroll.evaluate(element => { element.scrollTop = 300; });
  const scrollTop = await scroll.evaluate(element => element.scrollTop);
  const footerY = (await panel.locator('form').boundingBox()).y;
  await scroll.evaluate(element => { element.scrollTop += 200; });
  assert.equal((await panel.locator('form').boundingBox()).y, footerY, 'Composer is fixed below independent list scrolling');
  await scroll.evaluate((element, value) => { element.scrollTop = value; }, scrollTop);
  const readCount = commentReads;
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByRole('complementary', { name: /^评论/ }).count(), 0, 'Closed panel is removed from the accessibility tree');
  await toggle.click();
  await page.waitForTimeout(300);
  assert.equal(await input.inputValue(), '保留这段草稿');
  assert.equal(await scroll.evaluate(element => element.scrollTop), scrollTop);
  assert.equal(commentReads, readCount, 'Reopening preserves the same loaded discussion');
  assert.equal(await frame.evaluate((element, previous) => element === previous, iframeIdentity), true);
  assert.equal(frameLoads, 1, 'Opening/closing never reloads the app');
  await panel.getByRole('button', { name: '加载更多', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-preview-comments="open"] article').length === 45);
  await input.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-preview-comments="open"]') !== null), false, 'Tab can leave the panel');
  await input.focus();
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true, 'Close restores focus when it was inside the panel');
  await toggle.click();
  await input.fill('游客评论草稿');
  await panel.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('dialog').getByRole('heading', { name: '登录', exact: true }).waitFor();
  const passwordToggle = page.getByRole('dialog').getByRole('button', { name: '显示密码', exact: true });
  await expectTooltip(passwordToggle, '显示密码');
  await passwordToggle.click();
  await page.waitForTimeout(100);
  const hidePassword = page.getByRole('dialog').getByRole('button', { name: '隐藏密码', exact: true });
  await expectTooltip(hidePassword, '隐藏密码');
  await page.getByRole('dialog').getByRole('textbox').first().focus();
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'Login Escape does not close the adjacent comments');
  assert.equal(await input.inputValue(), '游客评论草稿');
  user = { id: 'me', email: 'demo@example.com', displayName: 'Demo', handle: 'demo-user', avatarUrl: null, providers: { email: true, google: false, github: false } };
  await page.reload();
  await page.locator('[data-preview-app-id="preview-app"]').click();
  await toggle.click();
  await panel.locator('article').first().waitFor();
  await panel.getByRole('button', { name: '回复', exact: true }).first().click();
  await input.fill('并排面板中的回复');
  await panel.getByRole('button', { name: '发送', exact: true }).click();
  const reply = panel.locator('article').filter({ hasText: '并排面板中的回复' });
  await reply.waitFor();
  assert.equal(posts, 1);
  await reply.getByRole('button', { name: '删除', exact: true }).click();
  await reply.waitFor({ state: 'detached' });
  await scroll.evaluate(element => { element.scrollTop = 0; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(screenshotDir, 'comments-sidepanel-half.png') });
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await page.getByRole('button', { name: '退出全屏', exact: true }).waitFor();
  await input.focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '退出全屏', exact: true }).count(), 1);
  await toggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(screenshotDir, 'comments-sidepanel-fullscreen.png') });
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  assert.ok((await frame.boundingBox()).width > 240);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(screenshotDir, 'comments-sidepanel-narrow.png') });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(screenshotDir, 'comments-sidepanel-dark.png') });
  await expectTooltip(toggle, '评论');
  await expectTooltip(panel.getByRole('button', { name: '关闭', exact: true }), '关闭');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await panel.evaluate(element => getComputedStyle(element.parentElement).transitionProperty), 'none');
  const logo = page.getByRole('button', { name: '应用操作', exact: true });
  const beforeDrag = await logo.boundingBox();
  await page.mouse.move(beforeDrag.x + 20, beforeDrag.y + 20);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 20, beforeDrag.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  assert.ok((await logo.boundingBox()).y - beforeDrag.y > 50, 'Dock dragging still works beside comments');
  const parkedAfterDrag = await dockRoot.getAttribute('style');
  const cancelStart = await handle.boundingBox();
  await page.mouse.move(cancelStart.x + 20, cancelStart.y + 20);
  await page.mouse.down();
  await page.mouse.move(cancelStart.x + 20, cancelStart.y + 50, { steps: 4 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('iframe').parentElement).pointerEvents === 'none');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await dockRoot.getAttribute('style'), parkedAfterDrag, 'Blur cancels dragging back to its parked position');
  assert.notEqual(await frame.evaluate(e => getComputedStyle(e.parentElement).pointerEvents), 'none');
  await input.fill('这个应用的草稿');
  await page.locator('[data-preview-app-id="other-app"]').click();
  await toggle.click();
  assert.equal(await panel.getByRole('textbox').inputValue(), '', 'Switching apps does not reuse the draft');
  assert.equal(await page.getByRole('button', { name: '应用设置', exact: true }).count(), 0);
  await page.locator('[data-preview-app-id="preview-app"]').click();
  await toggle.click();
  await page.getByRole('button', { name: '应用设置', exact: true }).click();
  await page.waitForURL('**/projects/preview-app');
  assert.equal(await page.locator('iframe[title="元素周期表"]').count(), 0);
  await page.goto(baseUrl);
  const expandSidebar = page.getByRole('button', { name: '展开侧边栏', exact: true });
  await expectTooltip(expandSidebar, '展开侧边栏');
  await expectTooltip(page.getByRole('button', { name: '探索应用', exact: true }), '探索应用');
  assert.deepEqual(errors, []);
  console.log('Padded card like, icon Tooltip and adjacent comments UI passed: nonmodal interactions, animation, iframe identity, draft/scroll preservation, pagination, focus/Escape/auth, reply/delete, fullscreen/narrow/dark/reduced-motion.');
} finally {
  await browser.close();
}
