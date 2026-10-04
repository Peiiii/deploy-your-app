import { readFile, mkdir, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { marked } from 'marked';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const sdkVersion = JSON.parse(
  await readFile(path.join(root, 'packages/app-sdk/package.json'), 'utf8')
).version;
const out = path.join(root, 'developer-docs/dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const pages = [];
for (const file of (await readdir(path.join(root, 'developer-docs/pages'))).filter((f) =>
  f.endsWith('.md')
)) {
  const source = await readFile(path.join(root, 'developer-docs/pages', file), 'utf8');
  const slug = file.replace(/\.md$/, '');
  const title = source.match(/^# (.+)/m)?.[1] || slug;
  pages.push({ slug, title, source });
}
const order = [
  'index',
  'getting-started',
  'auth-cloud',
  'api-connections',
  'points',
  'wallet',
  'examples',
  'troubleshooting',
];
pages.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
for (const page of pages) {
  const navigation = pages
    .map(
      (p) =>
        `<a ${p.slug === page.slug ? 'aria-current="page"' : ''} href="${p.slug === 'index' ? '/' : '/' + p.slug}">${escape(p.title)}</a>`
    )
    .join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)} · GemiGo Docs</title><meta name="description" content="GemiGo 开发者文档：真实 SDK、账号、云端存储、统一点数与应用收费"><link rel="canonical" href="https://docs.gemigo.io/${page.slug === 'index' ? '' : page.slug}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><script src="/docs.js" defer></script></head><body><header><a class="brand" href="/">GemiGo <span>开发者文档</span></a><nav><a href="https://gemigo.io">平台 ↗</a><a href="https://gemigo.io/wallet">点数钱包 ↗</a><button id="menu" aria-label="展开文档导航" aria-expanded="false">☰</button></nav></header><div class="layout"><aside id="sidebar"><label for="search">查找文档</label><input id="search" type="search" placeholder="登录、点数、示例…"><nav>${navigation}</nav><div id="search-results" aria-live="polite"></div><a class="download" href="/skills/gemigo-app/SKILL.md" download>下载 App Skill ↓</a></aside><main><article>${marked.parse(page.source)}</article><footer>SDK ${sdkVersion} · <a href="/${page.slug}.md">查看原始 Markdown</a> · <a href="/llms.txt">AI 文档索引</a></footer></main></div></body></html>`;
  await writeFile(path.join(out, page.slug === 'index' ? 'index.html' : `${page.slug}.html`), html);
  await writeFile(path.join(out, `${page.slug}.md`), page.source);
}
await cp(path.join(root, 'developer-docs/public'), out, { recursive: true });
for (const name of ['gemigo-app', 'gemigo-cli']) {
  const dir = path.join(out, 'skills', name);
  await mkdir(dir, { recursive: true });
  await cp(path.join(root, 'skills', name, 'SKILL.md'), path.join(dir, 'SKILL.md'));
}
await mkdir(path.join(out, 'reference'), { recursive: true });
await cp(path.join(root, 'docs/sdk/APP_SDK_API.md'), path.join(out, 'reference/APP_SDK_API.md'));
// Previously published immutable SDK URLs keep their exact release bytes.
for (const filename of await readdir(path.join(root, 'developer-docs/sdk-archives'))) {
  const version = filename.match(/^gemigo-app-sdk-(\d+\.\d+\.\d+)\.tgz$/)?.[1];
  if (!version) continue;
  const directory = path.join(out, 'sdk', version);
  await mkdir(directory, { recursive: true });
  const archive = path.join(root, 'developer-docs/sdk-archives', filename);
  execFileSync('tar', ['-xzf', archive, '-C', directory, '--strip-components=2', 'package/dist']);
  await cp(archive, path.join(directory, filename));
}
await mkdir(path.join(out, 'sdk', sdkVersion), { recursive: true });
await cp(path.join(root, 'packages/app-sdk/dist'), path.join(out, 'sdk', sdkVersion), {
  recursive: true,
});
execFileSync('npm', ['pack', '--silent', '--pack-destination', path.join(out, 'sdk', sdkVersion)], {
  cwd: path.join(root, 'packages/app-sdk'),
  stdio: 'pipe',
});
for (const name of ['knowledge-lab', 'creative-lab']) {
  await mkdir(path.join(out, 'examples', name), { recursive: true });
  await cp(
    path.join(root, 'examples', name, 'index.html'),
    path.join(out, 'examples', name, 'index.html')
  );
  await cp(
    path.join(root, 'examples', name, 'index.html'),
    path.join(out, 'examples', name + '.html.txt')
  );
}
await writeFile(
  path.join(out, 'search.json'),
  JSON.stringify(
    pages.map(({ slug, title, source }) => ({
      url: slug === 'index' ? '/' : '/' + slug,
      title,
      text: source.replace(/```[\s\S]*?```/g, '').slice(0, 5000),
    }))
  )
);
await writeFile(
  path.join(out, 'llms.txt'),
  '# GemiGo developer docs\n\n' +
    pages.map((p) => `- [${p.title}](https://docs.gemigo.io/${p.slug}.md)`).join('\n') +
    '\n- [App Skill](https://docs.gemigo.io/skills/gemigo-app/SKILL.md)\n'
);
await writeFile(
  path.join(out, '404.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>文档未找到</title><h1>文档未找到</h1><a href="/">返回 GemiGo 文档首页</a></html>'
);
await writeFile(
  path.join(out, '_headers'),
  '/examples/knowledge-lab.html.txt\n  Content-Disposition: attachment; filename=\"knowledge-lab.html\"\n/examples/creative-lab.html.txt\n  Content-Disposition: attachment; filename=\"creative-lab.html\"\n/sdk/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=31536000, immutable\n/*.md\n  Content-Type: text/markdown; charset=utf-8\n/skills/*\n  Content-Type: text/markdown; charset=utf-8\n'
);
console.log(`Built ${pages.length} pages, Markdown, Skill, SDK and actual example sources.`);
