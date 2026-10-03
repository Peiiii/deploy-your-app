const menu = document.querySelector('#menu'),
  sidebar = document.querySelector('#sidebar');
menu?.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
for (const pre of document.querySelectorAll('pre')) {
  const code = pre.querySelector('code');
  if (!code) continue;
  const button = document.createElement('button');
  button.textContent = '复制';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = '已复制';
    } catch {
      button.textContent = '请手动选择代码';
    }
  });
  pre.append(button);
}
let pages = null;
const search = document.querySelector('#search'),
  results = document.querySelector('#search-results');
search?.addEventListener('input', async () => {
  const query = search.value.trim().toLowerCase();
  results.replaceChildren();
  if (!query) return;
  try {
    pages ||= await fetch('/search.json').then((r) => r.json());
    if (search.value.trim().toLowerCase() !== query) return;
    const matches = pages.filter((p) => (p.title + ' ' + p.text).toLowerCase().includes(query));
    for (const page of matches) {
      const a = document.createElement('a');
      a.href = page.url;
      a.textContent = page.title;
      results.append(a);
    }
    if (!matches.length) results.textContent = '没有匹配的文档';
  } catch {
    results.textContent = '搜索暂不可用，请使用上方导航';
  }
});
