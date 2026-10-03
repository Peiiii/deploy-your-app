import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Exercise actual product entry points and getUserMedia, using synthetic devices.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const baseUrl = process.env.PREVIEW_TEST_URL || 'http://127.0.0.1:5207';
const baseline = process.env.PREVIEW_MEDIA_BASELINE === '1';
const appOrigin = 'https://preview-media.gemigo.test';
const app = {
    id: 'media-app', name: '摄像头测试', description: '摄像头和麦克风权限验证',
    status: 'Live', sourceType: 'html', framework: 'Unknown', repoUrl: 'demo.html',
    url: `${appOrigin}/`, category: 'learning', createdAt: '2026-10-03T00:00:00Z',
    appLanguage: { languages: ['zh'] },
    publicAuthor: { kind: 'profile', label: 'Demo', handle: 'demo-user', profileIdentifier: 'demo-user', identityKey: 'demo', anonymousCode: null },
};
const fixture = `<!doctype html><html><head><meta charset="utf-8"></head><body style="padding:120px">
<button id="start">开启摄像头和麦克风</button><output id="result">idle</output>
<a id="navigate" href="https://preview-media-other.gemigo.test/">另一个域名</a>
<script>
document.querySelector('#start').onclick = async () => {
  const output = document.querySelector('#result');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    output.textContent = JSON.stringify({video: stream.getVideoTracks().length, audio: stream.getAudioTracks().length});
    stream.getTracks().forEach(track => track.stop());
  } catch (error) { output.textContent = error.name; }
};
</script></body></html>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] });
try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.grantPermissions(['camera', 'microphone']);
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
    await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
        if (path === '/api/v1/me') return json({ user: null });
        if (path.endsWith('/explore-feed')) return route.fulfill({ status: 404, body: '' });
        if (path.includes('/reactions')) return json({});
        if (path.includes('/favorites')) return json({ projectIds: [] });
        if (path === '/api/v1/projects/explore' || path === '/api/v1/projects') return json({ items: [app], total: 1, page: 1, pageSize: 100 });
        return json({ items: [], total: 0, page: 1, pageSize: 30 });
    });
    await page.route('https://preview-media*.gemigo.test/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const checkMedia = async (entry) => {
        const frame = page.frameLocator('iframe');
        await frame.locator('#start').waitFor();
        await page.waitForTimeout(400); // Let the existing preview entrance transition settle before clicking.
        const policy = await frame.locator('body').evaluate(() => ({
            camera: document.featurePolicy.allowsFeature('camera'),
            microphone: document.featurePolicy.allowsFeature('microphone'),
        }));
        assert.deepEqual(policy, { camera: !baseline, microphone: !baseline }, entry);
        await frame.locator('#start').click();
        await frame.locator('#result').filter({ hasNotText: 'idle' }).waitFor();
        assert.equal(await frame.locator('#result').innerText(), baseline ? 'NotAllowedError' : '{"video":1,"audio":1}', entry);
        console.log(`${entry}: ${JSON.stringify(policy)}; ${await frame.locator('#result').innerText()}`);
    };
    await page.goto(baseUrl);
    await page.locator('[data-preview-app-id="media-app"]').click();
    await checkMedia('Home preview');
    if (!baseline) {
        // Delegation must not bypass a browser-level denial.
        await context.clearPermissions();
        await context.grantPermissions([]);
        await page.frameLocator('iframe').locator('#start').click();
        await page.frameLocator('iframe').locator('#result').filter({ hasText: 'NotAllowedError' }).waitFor();
        console.log('Browser denial: NotAllowedError');
        // A frame navigating away cannot transfer src-scoped delegation.
        await context.grantPermissions(['camera', 'microphone']);
        const [navigated] = await Promise.all([
            page.waitForEvent('framenavigated', frame => frame.url().startsWith('https://preview-media-other.gemigo.test')),
            page.frameLocator('iframe').locator('#navigate').click(),
        ]);
        await navigated.waitForLoadState();
        assert.equal(await navigated.evaluate(() => document.featurePolicy.allowsFeature('camera')), false);
        assert.equal(await navigated.evaluate(() => document.featurePolicy.allowsFeature('microphone')), false);
        console.log('Cross-origin navigation: media delegation denied');
        await context.grantPermissions(['camera', 'microphone']);
    }
    await page.goto(`${baseUrl}/explore`);
    await page.getByRole('button', { name: '视频流模式', exact: true }).click();
    await page.getByRole('button', { name: '点击进入应用', exact: true }).click();
    await checkMedia('Explore feed');
} finally {
    await browser.close();
}
