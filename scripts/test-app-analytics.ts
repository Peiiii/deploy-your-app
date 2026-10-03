import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { analyticsRepository } from '../workers/api/src/repositories/analytics.repository';
import { analyticsService } from '../workers/api/src/services/analytics.service';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { SourceType } from '../workers/api/src/types/project';
import analyticsManagerModule from '../frontend/src/managers/analytics.manager';
import analyticsStoreModule from '../frontend/src/stores/analytics.store';
const { AnalyticsManager } = analyticsManagerModule;
const { useAnalyticsStore } = analyticsStoreModule;

const require = createRequire(realpathSync('workers/r2-gateway/node_modules/wrangler/package.json'));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const secret = 'local-analytics-test-secret';
let gateway, api;
let failures = 0;
let statsFailures = 0;
const server = createServer(async (request, outgoing) => {
  try {
    const body = [];
    for await (const chunk of request) body.push(chunk);
    const url = 'http://' + request.headers.host + request.url;
    if (request.url.startsWith('/api/v1/analytics/ping') && failures > 0) {
      failures -= 1; outgoing.writeHead(503); outgoing.end(); return;
    }
    if (request.url.includes('/stats') && statsFailures > 0) {
      statsFailures -= 1; outgoing.writeHead(503, {'content-type':'application/json'}); outgoing.end('{}'); return;
    }
    if (!request.url.startsWith('/api/v1/') && !request.headers.host.includes('.gemigo.localhost')) {
      const pathname=new URL(url).pathname;
      const file=pathname.startsWith('/assets/') ? 'frontend/dist'+pathname : 'frontend/dist/index.html';
      outgoing.writeHead(200,{'content-type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
      outgoing.end(readFileSync(file));return;
    }
    const response = await (request.url.startsWith('/api/v1/') ? api : gateway).fetch(url, {
      method: request.method, headers: request.headers,
      ...(!['GET','HEAD'].includes(request.method) ? { body: Buffer.concat(body) } : {}),
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = slug => 'http://' + slug + '.gemigo.localhost:' + port;
const bundle = async entry => (await build({ entryPoints: [entry], bundle: true, write: false,
  format: 'esm', platform: 'browser', target: 'es2022' })).outputFiles[0].text;
const mf = new Miniflare({ workers: [
  { name: 'gateway', modules: true, script: await bundle('workers/r2-gateway/worker.ts'),
    compatibilityDate: '2026-09-18', r2Buckets: ['ASSETS'], bindings: { APPS_ROOT_DOMAIN: 'gemigo.localhost',
      ANALYTICS_ENABLED: 'true', ANALYTICS_INGEST_SECRET: secret, ANALYTICS_API_BASE_URL: 'http://127.0.0.1:' + port + '/api/v1' } },
  { name: 'api', modules: true, script: await bundle('workers/api/src/index.ts'), compatibilityDate: '2026-09-18',
    d1Databases: { PROJECTS_DB: 'analytics' }, bindings: { ANALYTICS_INGEST_SECRET: secret } },
] });
let browser;
try {
  gateway = await mf.getWorker('gateway'); api = await mf.getWorker('api');
  const db = await mf.getD1Database('PROJECTS_DB', 'api');
  const bucket = await mf.getR2Bucket('ASSETS', 'gateway');
  await analyticsRepository.ensureSchema(db);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0,10);
  await db.prepare('INSERT INTO project_analytics_collection VALUES(1,?)').bind(yesterday + 'T12:00:00.000Z').run();
  const html = '<!doctype html><html><head><title>Analytics App</title></head><body><h1>Real App</h1><script>window.route = path => history.pushState({}, "", path);</script></body></html>';
  for (const slug of ['first','second']) {
    await bucket.put('apps/' + slug + '/current/index.html', html, { httpMetadata: { contentType: 'text/html' } });
    await bucket.put('apps/' + slug + '/current/info.html', html, { httpMetadata: { contentType: 'text/html' } });
    await bucket.put('apps/' + slug + '/current/data.js', 'window.asset=true;', { httpMetadata: { contentType: 'application/javascript' } });
  }
  const signal = { isBot: false, visitorHash: 'a'.repeat(64), sessionHash: 'b'.repeat(64),
    dedupeKey: 'c'.repeat(64), userAgentFamily: 'browser', clientChannel: 'web' };
  await analyticsRepository.recordPageView(db,'range',new Date(yesterday + 'T13:00:00.000Z'),signal);
  await analyticsRepository.recordPageView(db,'range',now,{...signal,dedupeKey:'d'.repeat(64)});
  const stats = await analyticsService.getProjectStatsForSlug(db,'range',7);
  assert.equal(stats.pageViews,2); assert.equal(stats.uniqueVisitors,1);
  assert.equal(stats.points.reduce((sum,point) => sum + (point.uniqueVisitors ?? 0),0),2);
  assert.equal(stats.points[0].views,null); assert.equal(stats.points.at(-2).coverage,'partial');
  assert.equal(stats.coverage.status,'partial');
  const zero = await analyticsService.getProjectStatsForSlug(db,'empty',30);
  assert.equal(zero.pageViews,0); assert.equal(zero.points.at(-1).views,0); assert.equal(zero.points[0].views,null);
  await db.prepare('DELETE FROM project_analytics_collection').run();
  assert.equal((await analyticsService.getProjectStatsForSlug(db,'range',7)).pageViews,null);
  await db.prepare('INSERT INTO project_analytics_collection VALUES(1,?)').bind(yesterday + 'T12:00:00.000Z').run();
  assert.deepEqual(await Promise.all(Array.from({length:10},()=>analyticsRepository.recordPageView(db,'concurrent',now,signal))).then(v=>v.filter(Boolean).length),1);
  assert.equal(await analyticsRepository.recordPageView(db,'another-app',now,signal),true,'dedup is app scoped');
  // Force a projection failure: retry remains possible because event and projections roll back.
  await db.prepare("CREATE TRIGGER fail_projection BEFORE INSERT ON project_daily_stats WHEN NEW.slug='failure' BEGIN SELECT RAISE(ABORT,'test'); END").run();
  await assert.rejects(analyticsRepository.recordPageView(db,'failure',now,signal));
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM project_page_views WHERE slug='failure'").first('n'),0);
  await db.prepare('DROP TRIGGER fail_projection').run();
  assert.equal(await analyticsRepository.recordPageView(db,'failure',now,signal),true);

  // Actual HTTP router enforces owner isolation, expired sessions and internal authentication.
  const user = await authRepository.createUser(db,{ id:crypto.randomUUID(), email: 'owner@example.test',displayName: 'Owner' });
  const other = await authRepository.createUser(db,{ id:crypto.randomUUID(), email: 'other@example.test',displayName: 'Other' });
  const session = await authRepository.createSession(db,user.id);
  const otherSession = await authRepository.createSession(db,other.id);
  const expired = await authRepository.createSession(db,user.id,-60);
  const project = await projectRepository.createProjectRecord(db,{ id:crypto.randomUUID(),ownerId:user.id,
    name:'Own app',url:origin('first')+'/',repoUrl:'html:own',sourceType:SourceType.Html,lastDeployed:now.toISOString(),status:'Live',framework:'HTML',slug:'first' });
  const statsUrl='http://api.local/api/v1/projects/'+project.id+'/stats?range=30d';
  assert.equal((await api.fetch(statsUrl)).status,401);
  assert.equal((await api.fetch(statsUrl,{headers:{cookie:'session_id='+otherSession.id}})).status,404);
  assert.equal((await api.fetch(statsUrl,{headers:{cookie:'session_id='+expired.id}})).status,401);
  const own=await api.fetch(statsUrl,{headers:{cookie:'session_id='+session.id}});
  assert.equal(own.status,200); assert.equal(own.headers.get('cache-control'),'private, no-store');
  assert.equal((await own.json()).range,'30d');
  assert.equal((await api.fetch('http://api.local/api/v1/analytics/ping/first',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(signal)})).status,404);
  const count=async slug=>(await db.prepare('SELECT COUNT(*) AS n FROM project_page_views WHERE slug=?').bind(slug).first()).n;
  for (const method of ['GET','HEAD']) await gateway.fetch(origin('first')+'/',{method});
  await gateway.fetch(origin('first')+'/unknown/scanner-path');
  await gateway.fetch(origin('first')+'/data.js');
  assert.equal(await count('first'),0,'requests without a browser script never count');
  const beacon=origin('first')+'/__gemigo/page-view';
  const browserHeaders={origin:origin('first'),'sec-fetch-site':'same-origin','content-type':'application/json','user-agent':'Mozilla/5.0 Chrome/131.0'};
  const payload=JSON.stringify({eventId:crypto.randomUUID(),visitorId:crypto.randomUUID()});
  assert.equal((await gateway.fetch(beacon,{method:'POST',headers:{...browserHeaders,origin:origin('second')},body:payload})).status,403);
  assert.equal((await gateway.fetch(beacon,{method:'POST',headers:browserHeaders,body:'x'.repeat(513)})).status,413);
  assert.equal((await gateway.fetch(beacon,{method:'POST',headers:browserHeaders,body:'{}'})).status,400);
  await gateway.fetch(beacon,{method:'POST',headers:{...browserHeaders,'user-agent':'Googlebot'},body:payload});
  assert.equal(await count('first'),0);

  browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{}),
    args:['--host-resolver-rules=MAP *.gemigo.localhost 127.0.0.1','--no-proxy-server']});
  const context=await browser.newContext({userAgent:'Mozilla/5.0 Chrome/131.0 Safari/537.36'});
  // Exercise real browser collection; webdriver filtering is tested separately below.
  await context.addInitScript('window.__name = (value) => value;');
  await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
  const page=await context.newPage();
  page.on('pageerror',error=>console.error('browser error',error.message));
  page.on('response',response=>{if(response.url().includes('page-view') && response.status()!==204)console.error('beacon status',response.status());});
  const waitCount=async (slug,n)=>{ for(let i=0;i<50;i++){if(await count(slug)===n)return;await new Promise(r=>setTimeout(r,100));} assert.equal(await count(slug),n); };
  await page.goto(origin('first')+'/'); await waitCount('first',1);
  const firstId=await page.evaluate(()=>localStorage.getItem('gemigo.app.visitor.v2'));
  await page.reload(); await waitCount('first',2);
  await page.evaluate(()=>window.route('/details')); await waitCount('first',3);
  await page.evaluate(()=>{history.replaceState({},'','/details?private=never-collected');});
  await new Promise(r=>setTimeout(r,100)); assert.equal(await count('first'),3);
  await page.evaluate(()=>{location.hash='chapter';}); await waitCount('first',4);
  await page.goto(origin('first')+'/info.html'); await waitCount('first',5);
  assert.equal(await page.evaluate(()=>localStorage.getItem('gemigo.app.visitor.v2')),firstId);
  const collected=await analyticsService.getProjectStatsForSlug(db,'first',7);
  assert.equal(collected.pageViews,5);assert.equal(collected.uniqueVisitors,1);
  assert.equal(await (await bucket.get('apps/first/current/index.html')).text(),html);
  const a=await page.evaluate(()=>fetch('/').then(r=>r.headers.get('etag')));
  const delivery=await gateway.fetch(origin('first')+'/',{headers:{'if-none-match':a}});
  assert.equal(delivery.status,304);assert.equal(await count('first'),5);
  await page.reload();await waitCount('first',6);
  await page.goto(origin('second')+'/');await waitCount('second',1);
  assert.notEqual(await page.evaluate(()=>localStorage.getItem('gemigo.app.visitor.v2')),firstId);
  const hashes=await db.prepare("SELECT slug,visitor_hash FROM project_page_views WHERE slug IN ('first','second') GROUP BY slug").all();
  assert.notEqual(hashes.results[0].visitor_hash,hashes.results[1].visitor_hash);
  await page.evaluate(src=>{const frame=document.createElement('iframe');frame.src=src;document.body.append(frame);},origin('first')+'/');
  await waitCount('first',7);
  failures=1;
  await page.reload();await waitCount('second',2);
  // Disabled storage keeps PV but explicitly reports unidentified visits.
  const noStorage=await browser.newContext({userAgent:'Mozilla/5.0 Chrome/131.0 Safari/537.36'});
  await noStorage.addInitScript('window.__name = (value) => value;');
  await noStorage.addInitScript(()=>{Object.defineProperty(navigator,'webdriver',{get:()=>false});Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});
  const blocked=await noStorage.newPage();await blocked.goto(origin('second')+'/');await waitCount('second',3);
  const limited=await analyticsService.getProjectStatsForSlug(db,'second',7);
  assert.equal(limited.uniqueVisitors,1);assert.equal(limited.unidentifiedViews,1);
  const automated=await browser.newPage();await automated.goto(origin('second')+'/');
  await new Promise(r=>setTimeout(r,200));assert.equal(await count('second'),3);
  const hidden=await context.newPage();await hidden.addInitScript(()=>Object.defineProperty(document,'visibilityState',{get:()=> 'hidden',configurable:true}));
  await hidden.goto(origin('second')+'/');await new Promise(r=>setTimeout(r,200));assert.equal(await count('second'),3);
  await hidden.evaluate(()=>{Object.defineProperty(document,'visibilityState',{get:()=> 'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await waitCount('second',4);
  // Real product settings UI, served from the production build and backed by the same real API/D1.
  await context.addCookies([{name:'session_id',value:session.id,url:'http://127.0.0.1:'+port}]);
  const ui=await context.newPage();
  await ui.addInitScript('localStorage.setItem("i18nextLng","en");');
  ui.on('pageerror',error=>console.error('UI error',error.message));
  await ui.goto('http://127.0.0.1:'+port+'/projects/'+project.id+'?tab=analytics');
  await ui.getByRole('combobox',{name:'Time range'}).waitFor();
  await ui.locator('[data-metric="Page views (PV)"]').filter({hasText:'7'}).waitFor();
  assert.equal(await ui.locator('[data-metric="Unique visitors (UV)"]').textContent(),'1');
  await ui.getByText('Not collected',{exact:true}).first().waitFor();
  await ui.getByRole('combobox',{name:'Time range'}).selectOption('30d');
  await ui.waitForFunction(()=>document.querySelectorAll('tbody tr').length===30);
  assert.equal(await ui.locator('[data-metric="Page views (PV)"]').textContent(),'7');
  statsFailures=1;
  await ui.getByRole('button',{name:'Refresh',exact:true}).click();
  await ui.getByText('Could not load app analytics. Try again.').waitFor();
  assert.equal(await ui.locator('[data-metric="Page views (PV)"]').textContent(),'—');
  await ui.getByRole('button',{name:'Retry',exact:true}).click();
  await ui.locator('[data-metric="Page views (PV)"]').filter({hasText:'7'}).waitFor();
  await ui.screenshot({path:'/tmp/gemigo-app-analytics-desktop.png',fullPage:true});
  await ui.setViewportSize({width:390,height:844});
  await ui.waitForFunction(()=>{const close=document.querySelector('[aria-label="Collapse sidebar"]');return !close || close.getBoundingClientRect().right<=0;});
  assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await ui.screenshot({path:'/tmp/gemigo-app-analytics-mobile.png',fullPage:true});

  const privateBrowser=await browser.newContext({userAgent:'Mozilla/5.0 Chrome/131.0 Safari/537.36'});
  await privateBrowser.addInitScript('Object.defineProperty(navigator, "webdriver", {get:()=>false});Object.defineProperty(navigator, "doNotTrack", {get:()=>"1"});');
  const privatePage=await privateBrowser.newPage();await privatePage.goto(origin('second')+'/');
  await new Promise(r=>setTimeout(r,200));assert.equal(await count('second'),4,'Do Not Track prevents app collection');
  // Raw identity retention does not remove historical aggregate counts.
  await analyticsRepository.recordPageView(db,'old',new Date(now.getTime()-36*86400000),signal);
  await analyticsRepository.cleanup(db);
  assert.equal(await count('old'),0);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM project_traffic_uniques WHERE slug='old'").first('n'),0);assert.equal(await db.prepare("SELECT SUM(views) AS n FROM project_daily_stats WHERE slug='old'").first('n'),1);

  // Range changes / refresh keep one authority and stale responses cannot overwrite newer results.
  let resolve7,resolve30;
  const manager=new AnalyticsManager({getProjectStats:(_id,range)=>new Promise(resolve=>{if(range==='7d')resolve7=resolve;else resolve30=resolve;})});
  const seven=manager.loadProjectStats('race','7d');const thirty=manager.loadProjectStats('race','30d');
  resolve30({...stats,range:'30d'});await thirty;resolve7({...stats,range:'7d'});await seven;
  assert.equal(useAnalyticsStore.getState().byProjectId.race.stats.range,'30d');
  const errorManager=new AnalyticsManager({getProjectStats:async()=>{throw new Error('offline');}});
  await errorManager.loadProjectStats('race','30d');assert.ok(useAnalyticsStore.getState().byProjectId.race.error);
  console.log('PASS browser/R2/gateway/API/D1 PV, reload/304/SPA/hash/.html, retry, app-scoped period UV, atomic rollback, missing/zero/partial coverage, privacy, disabled storage, bot/hidden/static/HEAD filtering, owner isolation and request races');
  if(process.env.ANALYTICS_FIXTURE_OUTPUT)writeFileSync(process.env.ANALYTICS_FIXTURE_OUTPUT,JSON.stringify({project,user,session,stats:collected}));
}finally{await browser?.close();await mf.dispose();await new Promise(resolve=>server.close(resolve));}
