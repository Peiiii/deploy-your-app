import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const require = createRequire(realpathSync(new URL('../workers/r2-gateway/node_modules/wrangler/package.json', import.meta.url)));
const { Miniflare } = require('miniflare'); const { build } = require('esbuild');
const built = await build({entryPoints:['workers/r2-gateway/worker.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const fontBytes = readFileSync(process.env.GOOGLE_FONT_FIXTURE);
let slow = false;
const mf = new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-09-18',r2Buckets:['ASSETS'],bindings:{APPS_ROOT_DOMAIN:'gemigo.app',ANALYTICS_ENABLED:'false'},outboundService:async req => {
 if (new URL(req.url).hostname === 'fonts.googleapis.com') {
   if (slow) await new Promise(r=>setTimeout(r,4500));
   return new Response('@font-face{font-family:"Test Mono";font-display:swap;src:url(https://fonts.gstatic.com/s/dmmono/v1/font.woff2) format("woff2")}',{headers:{'content-type':'text/css'}});
 }
 return new Response(fontBytes,{headers:{'content-type':'font/woff2'}});
}});
const browser = await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true,args:['--no-proxy-server']});
try {
 const bucket = await mf.getR2Bucket('ASSETS');
 const source = '<html><head><title>Font test</title><link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Test+Mono"><style>@import url("https://fonts.googleapis.com/css2?family=Test+Mono");body{font-family:"Test Mono",monospace}</style></head><body><h1>Readable immediately</h1></body></html>';
 await bucket.put('apps/demo/current/index.html',source,{httpMetadata:{contentType:'text/html'}});
 await bucket.put('apps/demo/current/main.css','@import "./nested.css";h1{color:rgb(0,128,0)}',{httpMetadata:{contentType:'text/css'}});
 await bucket.put('apps/demo/current/nested.css','@import "https://fonts.googleapis.com/css2?family=Test+Mono";h1{font-size:32px}',{httpMetadata:{contentType:'text/css'}});
 for (const mode of ['normal','timeout']) {
  slow = mode === 'timeout';
  const context = await browser.newContext(); const page = await context.newPage(); const requests=[];
  await page.route('**/*',async route=>{
   const request=route.request(); requests.push(request.url());
   const response=await mf.dispatchFetch(request.url(),{method:request.method(),headers:{...request.headers(),...(slow?{'cache-control':'no-store'}:{})}});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto('https://demo.gemigo.app/'+(slow?'?test=timeout':''),{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  const first=await page.evaluate(()=>({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,color:getComputedStyle(document.querySelector('h1')).color,size:getComputedStyle(document.querySelector('h1')).fontSize}));
  assert.ok(first.fcp < 2000);assert.equal(first.color,'rgb(0, 128, 0)');assert.equal(first.size,'32px');
  await page.waitForTimeout(3500);
  assert.equal(requests.some(url=>/^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(url)),false);
  if (!slow) assert.ok(await page.evaluate(()=>document.fonts.check('16px "Test Mono"')));
  assert.ok(requests.some(url=>url.includes('/nested.css?__gemigo_fonts=v1')));
  assert.ok(requests.some(url=>url.includes('/google-fonts/v3/css2')));
  console.log('PASS browser CSSOM/runtime:',mode,'FCP',first.fcp.toFixed(0)+'ms; nested CSS, immediate visual rules, no direct Google');
  await context.close();
 }
} finally {await browser.close();await mf.dispose();}
