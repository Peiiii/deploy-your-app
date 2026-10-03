import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ADMIN_URL || 'http://localhost:5176';
const production = new URL(base).protocol === 'https:';
const screenshots = process.env.ADMIN_CHART_SCREENSHOT_DIR;
if (screenshots) mkdirSync(screenshots, { recursive: true });
const reservationFile = process.env.ADMIN_QA_RESERVATIONS_FILE;
const savedReservations =
  production && reservationFile && existsSync(reservationFile)
    ? JSON.parse(readFileSync(reservationFile, 'utf8'))
    : [];
const reservations = new Map(
  savedReservations.map((report) => [`${report.path}:${report.generatedAt}`, report])
);
const errors = [];
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CHROME_CHANNEL || 'chrome',
});
const formatted = (n) => n.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
async function open(mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 },
    hasTouch: mobile,
    isMobile: mobile,
  });
  if (production) {
    const qa = JSON.parse(readFileSync(process.env.ADMIN_QA_SESSION_FILE, 'utf8'));
    await context.addCookies([
      {
        name: '__Host-gemigo_admin',
        value: qa.token,
        url: base,
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
  }
  const page = await context.newPage();
  page.reports = [];
  page.reportReads = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (!/\/api\/(growth|report|overview)\?/.test(response.url()) || response.status() !== 200)
      return;
    const read = (async () => {
      try {
        const data = await response.json();
        page.reports.push({ url: response.url(), data });
        if (production && !data.cached && data.reservedReads) {
          const path = new URL(response.url()).pathname;
          reservations.set(`${path}:${data.generatedAt}`, {
            path,
            generatedAt: data.generatedAt,
            reservedReads: data.reservedReads,
          });
          if (reservationFile)
            writeFileSync(reservationFile, JSON.stringify([...reservations.values()]), {
              mode: 0o600,
            });
        }
      } catch {
        /* Page teardown can interrupt an unrelated pending response. */
      }
    })();
    page.reportReads.push(read);
  });
  await page.goto(base);
  if (!production) {
    const credentials = JSON.parse(
      readFileSync(
        process.env.ADMIN_TEST_CREDENTIALS_FILE || '/tmp/gemigo-admin-test-credentials.json',
        'utf8'
      )
    );
    await page.getByLabel('密码', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: '进入管理中心 →', exact: true }).click();
  }
  await page.locator('.home-trends .chart-frame').first().waitFor();
  return { page, context };
}
const reportFor = async (page, endpoint, days) => {
  await Promise.all(page.reportReads);
  const report = page.reports
    .filter(
      (r) =>
        new URL(r.url).pathname === `/api/${endpoint}` &&
        (!days || (r.data.period?.days ?? r.data.days) === days)
    )
    .at(-1)?.data;
  assert.ok(report, `actual ${endpoint} response captured${days ? ` for ${days} days` : ''}`);
  return report;
};
async function inspect(page, frame, index, expected, touch = false, bar = false) {
  await frame.scrollIntoViewIfNeeded();
  const svg = frame.locator('svg');
  await svg.waitFor({ state: 'visible' });
  const box = await svg.boundingBox();
  const axis = await svg.locator('path[stroke="#ddd9e5"]').boundingBox();
  assert.ok(axis, 'native category axis is rendered');
  const x =
    axis.x +
    (bar ? (index + 0.5) / expected.length : index / Math.max(1, expected.length - 1)) * axis.width;
  const hitX = Math.min(axis.x + axis.width - 2, Math.max(axis.x + 2, x));
  const y = box.y + box.height * 0.72;
  if (touch) await page.touchscreen.tap(hitX, y);
  else await page.mouse.move(hitX, y);
  const tooltip = frame.getByRole('tooltip');
  await tooltip.waitFor();
  const text = await tooltip.innerText();
  assert.ok(text.includes(expected[index].day), text);
  for (const value of expected[index].values)
    assert.ok(text.includes(value === null ? '暂无数据' : formatted(value)), text);
  assert.ok(
    (await svg.textContent()).includes(expected[index].day),
    'crosshair date label identifies the selected day'
  );
  const tip = await tooltip.boundingBox(),
    bounds = await frame.boundingBox();
  assert.ok(
    tip.x >= bounds.x && tip.x + tip.width <= bounds.x + bounds.width + 1,
    'tooltip stays within its chart, including edges'
  );
  assert.ok(tip.y + tip.height <= box.y + box.height - 32, 'tooltip leaves the date labels clear');
  if (!bar && expected[index].values[0] !== null) {
    const points = await svg.locator('path').evaluateAll((paths) =>
      paths
        .filter((path) => path.getAttribute('d')?.startsWith('M1 0A1'))
        .map((path) => {
          const box = path.getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        })
    );
    const point = points.find((point) => Math.abs(point.x - x) < 3);
    if (point)
      assert.ok(
        !(
          point.x >= tip.x &&
          point.x <= tip.x + tip.width &&
          point.y >= tip.y &&
          point.y <= tip.y + tip.height
        ),
        'floating tooltip leaves the selected native data point clear'
      );
  }

  const after = await svg.boundingBox();
  assert.ok(
    Math.abs(after.y - box.y) < 1 && Math.abs(after.height - box.height) < 1,
    'selecting a date does not shift or resize the drawing'
  );
  return tooltip;
}
async function keyboard(page, frame, daily, field) {
  const plot = frame.locator('.chart-plot');
  await plot.focus();
  const tooltip = frame.getByRole('tooltip');
  await tooltip.waitFor();
  await plot.press('Home');
  assert.ok((await tooltip.innerText()).includes(daily[0].day));
  if (daily[0][field] === null) assert.ok((await tooltip.innerText()).includes('暂无数据'));
  await plot.press('ArrowRight');
  assert.ok((await tooltip.innerText()).includes(daily[1].day));
  await plot.press('End');
  assert.ok((await tooltip.innerText()).includes(daily.at(-1).day));
  await plot.press('ArrowRight');
  assert.ok((await tooltip.innerText()).includes(daily.at(-1).day), 'right bound clamps');
  await plot.press('Escape');
  await tooltip.waitFor({ state: 'hidden' });
  assert.equal(
    await plot.evaluate((element) => document.activeElement === element),
    true,
    'Escape preserves focus'
  );
  await page
    .getByRole('heading', { name: '经营总览', exact: true })
    .click()
    .catch(() => {});
}
try {
  const { page } = await open();
  const home = page.locator('.home-trends .chart-frame');
  let growth = await reportFor(page, 'growth', 7);
  const expected = growth.daily.map((d) => ({ day: d.day, values: [d.publishers] }));
  const tooltip = await inspect(page, home.first(), 3, expected);
  assert.ok((await tooltip.innerText()).includes('成功发布创作者'));
  await tooltip.hover();
  assert.ok(await tooltip.isVisible(), 'moving into tooltip keeps it visible');
  const selectedPlot = await home.first().locator('svg').boundingBox();
  await page.keyboard.press('Escape');
  await tooltip.waitFor({ state: 'hidden' });
  const idlePlot = await home.first().locator('svg').boundingBox();
  assert.ok(Math.abs(idlePlot.y - selectedPlot.y) < 1, 'closing tooltip does not move the plot');
  await inspect(page, home.first(), 0, expected);
  await page.mouse.move(0, 0);
  await tooltip.waitFor({ state: 'hidden' });
  await inspect(
    page,
    home.nth(1),
    6,
    growth.daily.map((d) => ({ day: d.day, values: [d.appsPv] }))
  );
  if (screenshots) await page.screenshot({ path: join(screenshots, 'desktop-tooltip.png') });
  await keyboard(page, home.first(), growth.daily, 'publishers');
  await page.getByRole('button', { name: '官网观测 UV', exact: true }).click();
  assert.equal(await page.getByRole('tooltip').count(), 0, 'metric switch clears prior tooltip');
  await inspect(
    page,
    home.nth(1),
    2,
    growth.daily.map((d) => ({ day: d.day, values: [d.uv] }))
  );
  assert.ok((await home.nth(1).getByRole('tooltip').innerText()).includes('浏览器标识'));
  await page.getByRole('button', { name: '近 30 天', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('.home-trends .chart-plot')
      ?.getAttribute('aria-label')
      ?.includes('30个日期')
  );
  growth = await reportFor(page, 'growth', 30);
  await keyboard(page, home.nth(1), growth.daily, 'uv');
  const previousDay = growth.daily.at(-1).day;
  await page.getByRole('button', { name: '近 7 天', exact: true }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('.home-trends .chart-plot')
      ?.getAttribute('aria-label')
      ?.includes('7个日期')
  );
  assert.equal(await page.getByRole('tooltip').count(), 0, 'range switch dismisses old selection');
  await page.getByRole('button', { name: '刷新数据 ↻', exact: true }).waitFor();
  const diagnostics = page.locator('.home-diagnostics');
  await diagnostics.locator(':scope > summary').click();
  const overview = await reportFor(page, 'overview', 7);
  assert.equal(overview.days, 7, 'diagnostics must finish its own range request');
  await inspect(
    page,
    diagnostics.locator('.chart-frame'),
    6,
    overview.daily.map((d) => ({ day: d.day, values: [d.total, d.succeeded] })),
    false,
    true
  );
  const diagnosticText = await diagnostics.getByRole('tooltip').innerText();
  assert.ok(diagnosticText.includes('全部尝试') && diagnosticText.includes('成功尝试'));
  await page.locator('aside nav').getByRole('button', { name: '增长大盘', exact: true }).click();
  await page.locator('.growth-console .chart-frame').first().waitFor();
  growth = await reportFor(page, 'growth', 7);
  for (const [index, metric] of ['pv', 'uv', 'registrations', 'cliAttempts'].entries()) {
    const frame = page.locator('.growth-console .chart-frame').nth(index);
    await inspect(
      page,
      frame,
      6,
      growth.daily.map((d) => ({ day: d.day, values: [d[metric]] }))
    );
    await page.keyboard.press('Escape');
  }
  await page.locator('.nav-details summary').click();
  const firstReport = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/report'
  );
  await page.locator('aside nav').getByRole('button', { name: '使用概览', exact: true }).click();
  const initialReport = await firstReport;
  await initialReport.finished();
  await page.getByRole('button', { name: '应用筛选 / 刷新', exact: true }).waitFor();
  if (production) {
    // Verify the existing bars on one real UTC day without requiring a costly seven-day report.
    await page
      .getByLabel('开始日期（UTC）', { exact: true })
      .fill(new Date().toISOString().slice(0, 10));
    const narrowedReport = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/report'
    );
    await page.getByRole('button', { name: '应用筛选 / 刷新', exact: true }).click();
    const response = await narrowedReport;
    assert.equal(
      response.status(),
      200,
      'one-day production report loads within the shared budget'
    );
  }
  await page.getByRole('heading', { name: '使用趋势', exact: true }).waitFor();
  const analytics = await reportFor(page, 'report');
  if (analytics.daily.length)
    await inspect(
      page,
      page.locator('.chart-frame'),
      analytics.daily.length - 1,
      analytics.daily.map((d) => ({ day: d.day, values: [d.events, d.visitors] })),
      false,
      true
    );
  const { page: mobile, context } = await open(true);
  const mframe = mobile.locator('.home-trends .chart-frame').first();
  growth = await reportFor(mobile, 'growth', 7);
  const last = growth.daily.map((d) => ({ day: d.day, values: [d.publishers] }));
  await inspect(mobile, mframe, 6, last, true);
  assert.ok((await mframe.getByRole('tooltip').innerText()).includes(previousDay));
  if (screenshots) await mobile.screenshot({ path: join(screenshots, 'mobile-tooltip.png') });
  await mobile.getByRole('heading', { name: '经营总览', exact: true }).tap();
  await mframe.getByRole('tooltip').waitFor({ state: 'hidden' });
  await mobile.getByRole('button', { name: '近 30 天', exact: true }).tap();
  await mobile.waitForFunction(() =>
    document
      .querySelector('.home-trends .chart-plot')
      ?.getAttribute('aria-label')
      ?.includes('30个日期')
  );
  await mframe.scrollIntoViewIfNeeded();
  const scroll = mframe.locator('.chart-plot');
  assert.ok(
    await scroll.evaluate((e) => e.scrollWidth <= e.clientWidth),
    'the complete 30-day chart fits the mobile viewport'
  );
  const box = await scroll.boundingBox(),
    cdp = await context.newCDPSession(mobile);
  const start = box.x + 50,
    y = box.y + box.height * 0.75;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start, y }],
  });
  for (let step = 1; step <= 6; step++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start + step * 20, y }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mframe.getByRole('tooltip').waitFor({ state: 'hidden' });
  const beforePan = await mobile.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start, y }],
  });
  for (let step = 1; step <= 6; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start, y: y - step * 20 }],
    });
    await mobile.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForFunction((previous) => scrollY > previous + 20, beforePan);
  await mframe.getByRole('tooltip').waitFor({ state: 'hidden' });

  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.setViewportSize({ width: 320, height: 844 });
  await mobile.getByRole('button', { name: '近 7 天', exact: true }).tap();
  await mobile.waitForFunction(() =>
    document
      .querySelector('.home-trends .chart-plot')
      ?.getAttribute('aria-label')
      ?.includes('7个日期')
  );
  growth = await reportFor(mobile, 'growth', 7);
  await inspect(
    mobile,
    mframe,
    6,
    growth.daily.map((d) => ({ day: d.day, values: [d.publishers] })),
    true
  );
  assert.ok(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '320px tooltip and chart fit the viewport'
  );
  if (screenshots) await mobile.screenshot({ path: join(screenshots, 'compact-tooltip.png') });
  await mobile.getByRole('button', { name: '刷新数据 ↻', exact: true }).waitFor();
  const compactDiagnostics = mobile.locator('.home-diagnostics');
  await compactDiagnostics.locator(':scope > summary').tap();
  const compactOverview = await reportFor(mobile, 'overview', 7);
  await inspect(
    mobile,
    compactDiagnostics.locator('.chart-frame'),
    6,
    compactOverview.daily.map((d) => ({ day: d.day, values: [d.total, d.succeeded] })),
    true,
    true
  );
  if (screenshots) await mobile.screenshot({ path: join(screenshots, 'compact-bars.png') });
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${production ? 'production' : 'local'} charts: broad hover/date/values/units, tooltip hover and leave/Escape, keyboard bounds and visible selection, 7/30+metric reset, null/zero, all curve+bar consumers, real touch/tap/outside/swipe, native crosshairs and compact floating tooltips, responsive full-period charts with stable layout, no clipping/root overflow/JS errors.`
  );
} finally {
  await browser.close();
}
