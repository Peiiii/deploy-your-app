import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { exploreService } from '../workers/api/src/services/explore.service';
import { projectRepository } from '../workers/api/src/repositories/project.repository';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'explore-test' }, compatibilityDate: '2026-09-18' });
try {
  const db = await mf.getD1Database('DB');
  assert.equal((await exploreService.getExploreProjects(db, { sort: 'popularity' })).total, 0, 'fresh schema and empty feed');
  const today = new Date().toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const expired = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  await db.prepare(`INSERT INTO users (id,email,display_name,handle,created_at,updated_at)
    VALUES ('owner','private@example.com','private@example.com','public-creator',?,?)`).bind(today,today).run();
  const fixtures = [
    ...['a','b','c','d','e','f'].map(id => ({ id, name: id, category: 'Games', tags: '["rank"]', extension: 1, deployed: ['e','f'].includes(id) ? '2026-09-02T00:00:00Z' : '2026-09-01T00:00:00Z' })),
    ...Array.from({ length: 200 }, (_, i) => ({ id: `app-${String(i).padStart(3,'0')}`, name: `ALPHA ${i}`, category: i % 2 ? 'Tools' : 'Games', tags: i % 2 ? '["blue"]' : '["red"]', extension: i % 2, deployed: '2026-08-01T00:00:00Z' })),
  ];
  for (let i=0; i<fixtures.length; i+=40) {
    await db.batch(fixtures.slice(i,i+40).map(p => db.prepare(`INSERT INTO projects
      (id,name,repo_url,slug,last_deployed,status,url,owner_id,is_public,is_deleted,is_extension_supported,category,tags,description)
      VALUES (?,?,?, ?,?,'Live',?,'owner',1,0,?,?,?,'searchable description')`)
      .bind(p.id,p.name,'https://github.com/example/app',p.id,p.deployed,`https://${p.id}.gemigo.app/`,p.extension,p.category,p.tags)));
  }
  await db.prepare("UPDATE projects SET is_deleted=NULL, slug=NULL, url='https://legacy-app.gemigo.app/' WHERE id='app-199'").run();
  await db.prepare('INSERT INTO project_daily_stats (slug,date,human_views) VALUES (?,?,900000)').bind('legacy-app',today).run();
  // High traffic must not make private, deleted, failed or URL-less apps visible.
  for (const [id,visibility,deleted,status,url] of [
    ['private',0,0,'Live','https://private.test/'], ['deleted',1,1,'Live','https://deleted.test/'],
    ['failed',1,0,'Failed','https://failed.test/'], ['blank',1,0,'Live','  '], ['null-url',1,0,'Live',null],
  ]) {
    await db.prepare(`INSERT INTO projects (id,name,repo_url,slug,last_deployed,status,url,is_public,is_deleted)
      VALUES (?,?,'repo',?,'2026-10-01T00:00:00Z',?,?,?,?)`).bind(id,id,id,status,url,visibility,deleted).run();
    await db.prepare('INSERT INTO project_daily_stats (slug,date,human_views) VALUES (?,?,100000)').bind(id,today).run();
  }
  for (const id of ['a','b','c','d','e','f']) {
    await db.prepare('INSERT INTO project_daily_stats (slug,date,human_views,raw_views,bot_views) VALUES (?,?,?,?,?)')
      .bind(id,oldest,id==='a'?10:9,id==='d'?90000:10,id==='d'?89991:0).run();
    const favorites = id==='b'?3:['c','d','e','f'].includes(id)?2:0;
    const likes = id==='c'?5:['d','e','f'].includes(id)?4:0;
    for (let i=0;i<favorites;i++) await db.prepare('INSERT INTO project_favorites VALUES (?,?,?)').bind(id,`u${i}`,today).run();
    for (let i=0;i<likes;i++) await db.prepare('INSERT INTO project_likes VALUES (?,?,?)').bind(id,`u${i}`,today).run();
  }
  await db.prepare('INSERT INTO project_daily_stats (slug,date,human_views) VALUES (?,?,900000)').bind('app-000',expired).run();
  const prepared: string[]=[];
  let batches=0;
  const observed = new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') return (sql: string) => { prepared.push(sql); return target.prepare(sql); };
      if (prop === 'batch') return (statements: unknown[]) => { batches++; return target.batch(statements); };
      const value = Reflect.get(target,prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const first = await exploreService.getExploreProjects(observed, { sort:'popularity',pageSize:6 });
  assert.deepEqual(first.items.map(p=>p.id), ['a','b','c','e','f','d'], 'human traffic, then favorites, likes, time, deterministic ties');
  assert.equal(first.total,206, 'legacy null-deleted row stays public; URL-derived stats do not change its stored-key ranking');
  assert.deepEqual(first.engagement.c,{likesCount:5,favoritesCount:2});
  assert.equal(first.items[0].publicAuthor?.handle,'public-creator');
  assert.ok(!JSON.stringify(first).includes('private@example.com'), 'public author hides email');
  assert.equal(batches,1,'one D1 batch for page and count regardless of candidate count');
  assert.equal(prepared.length,4,'page, count, language facets plus current-page author lookup');
  const pageSql=prepared.find(sql=>sql.includes('explore_views'))!;
  const plan=await db.prepare(`EXPLAIN QUERY PLAN ${pageSql}`).bind(oldest,6,0).all();
  const details=plan.results.map((row: { detail: string })=>row.detail).join('\n');
  assert.match(details,/SEARCH project_daily_stats .*\(slug=\? AND date>\?\)/,'indexed date-window lookup');
  assert.match(details,/SEARCH project_likes/);
  assert.match(details,/SEARCH project_favorites/);
  const second=await exploreService.getExploreProjects(db,{sort:'popularity',page:2,pageSize:6});
  assert.deepEqual(second.items.map(p=>p.id),['app-000','app-001','app-002','app-003','app-004','app-005']);
  assert.ok(second.items.every(p=>!first.items.some(other=>other.id===p.id)));
  const far=await exploreService.getExploreProjects(db,{page:100,pageSize:50});
  assert.equal(far.total,206); assert.deepEqual(far.items,[]); assert.deepEqual(far.engagement,{});
  assert.equal((await exploreService.getExploreProjects(db,{search:'does not exist'})).total,0);
  assert.equal((await exploreService.getExploreProjects(db,{search:'ALPHA',category:'Tools',tag:'blue',isExtensionSupported:true})).total,100);
  assert.equal((await exploreService.getExploreProjects(db,{search:'searchable',category:'Games',tag:'red',isExtensionSupported:false})).total,100);
  prepared.length=0; batches=0;
  const recent=await exploreService.getExploreProjects(observed,{sort:'recent',pageSize:50});
  assert.deepEqual(recent.items.slice(0,6).map(p=>p.id),['e','f','a','b','c','d']);
  assert.equal(recent.items.length,50); assert.equal(batches,1);
  assert.ok(prepared.every(sql=>!sql.includes('project_daily_stats')),'recent avoids analytics entirely');
  const capped=await exploreService.getExploreProjects(db,{page:0,pageSize:999});
  assert.equal(capped.page,1); assert.equal(capped.pageSize,50); assert.equal(capped.items.length,50);
  // Existing profile/general query remains compatible with shared filter owner.
  assert.equal((await projectRepository.queryProjects(db,{onlyPublic:true,search:'ALPHA',category:'Tools',limit:7})).length,7);
  console.log('PASS real D1: 206 public candidates; ranking/window/visibility/filters/pagination/privacy; constant page batch; indexed statistics; recent skips analytics.');
} finally { await mf.dispose(); }
