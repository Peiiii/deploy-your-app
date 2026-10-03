import { SITE, getSeo, localizedPath } from './seo.mjs';
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const webUrl = (value) => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};
const author = (value) =>
  value?.kind === 'profile' && value.handle && /^[a-z0-9_-]{1,64}$/i.test(value.handle)
    ? {
        label: String(value.label || '@' + value.handle),
        path: '/u/' + encodeURIComponent(value.handle),
      }
    : null;
export const publicProjects = (items, language) =>
  (Array.isArray(items) ? items : [])
    .filter((p) => p.isPublic === true && !p.isDeleted && p.status === 'Live' && webUrl(p.url))
    .map((p) => {
      const code = language === 'zh-CN' ? 'zh' : 'en';
      const locale = p.localization?.locales?.[language] || p.localization?.locales?.[code];
      const generated = p.localization?.generatedDescriptions;
      return {
        name: String(locale?.name || p.name || 'App'),
        description: String(
          locale?.description ||
            (generated?.source === p.description && generated?.locales?.[code]) ||
            p.description ||
            ''
        ),
        url: webUrl(p.url),
        author: author(p.publicAuthor),
      };
    });
export const renderPublicProjects = (projects, language, heading = true) =>
  `<section class="seo-content">${heading ? `<h2>${language === 'zh-CN' ? '公开作品' : 'Public apps'}</h2>` : ''}${projects.map((p) => `<article><h3><a href="${escape(p.url)}" rel="ugc noopener noreferrer" >${escape(p.name)}</a></h3><p>${escape(p.description)}</p><a href="${escape(p.url)}" target="_blank" rel="ugc noopener noreferrer">${language === 'zh-CN' ? '访问网站' : 'Visit website'}</a>${p.author ? `<a href="${escape(localizedPath(p.author.path, language))}">${escape(p.author.label)}</a>` : ''}</article>`).join('')}<a href="${localizedPath('/catalog', language)}">${language === 'zh-CN' ? '浏览全部公开作品' : 'Browse all public apps'}</a></section>`;
export const profileSeo = (base, data) => {
  const identity = author(data?.publicAuthor);
  const projects = publicProjects(data?.projects, base.language);
  if (!identity || !projects.length) return { seo: base, content: '', status: 200 };
  const canonical = SITE + localizedPath(identity.path, base.language);
  const title = `${identity.label} · ${base.language === 'zh-CN' ? '公开作品' : 'Public apps'} | GemiGo`;
  const description = String(
    data.profile?.bio ||
      (base.language === 'zh-CN'
        ? `${identity.label} 在 GemiGo 分享的公开网页应用。`
        : `Public web apps shared by ${identity.label} on GemiGo.`)
  ).slice(0, 300);
  const seo = {
    ...base,
    path: identity.path,
    known: true,
    title,
    heading: identity.label,
    description,
    canonical,
    indexable: true,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: canonical,
      name: title,
      description,
      mainEntity: { '@type': 'Person', name: identity.label, url: canonical },
    },
  };
  return {
    seo,
    status: 200,
    content: `<main><article class="seo-content"><h1>${escape(identity.label)}</h1><p>${escape(description)}</p></article>${renderPublicProjects(projects, base.language)}</main>`,
  };
};
export const catalogSeo = (url, data) => {
  const base = getSeo(url);
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  );
  const projects = publicProjects(data?.items, base.language);
  const title = `${base.language === 'zh-CN' ? '公开作品目录' : 'Public app catalog'}${page > 1 ? ` · ${page}` : ''} | GemiGo`;
  const canonical =
    SITE +
    localizedPath('/catalog', base.language) +
    (page > 1 ? `${base.language === 'zh-CN' ? '&' : '?'}page=${page}` : '');
  const seo = {
    ...base,
    path: '/catalog',
    title,
    heading: title,
    description:
      base.language === 'zh-CN'
        ? '浏览 GemiGo 社区公开分享的网页应用，直接访问作品和作者主页。'
        : 'Browse publicly shared GemiGo web apps and visit their websites and creator profiles.',
    canonical,
    known: true,
    indexable: projects.length > 0,
    structuredData: null,
  };
  const link = (next, label) =>
    `<a href="${localizedPath('/catalog', base.language)}${base.language === 'zh-CN' ? '&' : '?'}page=${next}">${label}</a>`;
  const navigation = `${page > 1 ? link(page - 1, base.language === 'zh-CN' ? '上一页' : 'Previous page') : ''}${page * 12 < Number(data?.total || 0) ? link(page + 1, base.language === 'zh-CN' ? '下一页' : 'Next page') : ''}`;
  return {
    seo,
    status: page > 1 && !projects.length ? 404 : 200,
    content: `<main><article class="seo-content"><h1>${escape(title)}</h1><p>${escape(seo.description)}</p></article>${renderPublicProjects(projects, base.language, false)}<nav class="seo-content" aria-label="${base.language === 'zh-CN' ? '目录分页' : 'Catalog pages'}">${navigation}</nav></main>`,
  };
};
export const loadPublicSeo = async (url, backend, fetcher = fetch) => {
  const base = getSeo(url);
  const profile = /^\/u\/([^/]+)$/.exec(base.path);
  if (!profile && !['/', '/explore', '/catalog'].includes(base.path)) return null;
  if (!backend) throw new Error('Public backend unavailable');
  const endpoint = new URL(
    profile
      ? '/api/v1/users/' + encodeURIComponent(decodeURIComponent(profile[1])) + '/profile'
      : '/api/v1/projects/explore',
    backend
  );
  if (!profile) {
    endpoint.searchParams.set('pageSize', '12');
    endpoint.searchParams.set(
      'page',
      base.path === '/catalog'
        ? String(
            Math.min(
              10000,
              Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
            )
          )
        : '1'
    );
  }
  const response = await fetcher(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (profile && response.status === 404)
    return {
      seo: { ...base, known: false },
      status: 404,
      content: `<main class="seo-content"><h1>Profile not found</h1><a href="/catalog">GemiGo</a></main>`,
    };
  if (!response.ok) throw new Error('Public backend unavailable');
  const data = await response.json();
  if (profile) return profileSeo(base, data);
  if (base.path === '/catalog') return catalogSeo(url, data);
  return {
    seo: base,
    status: 200,
    content: renderPublicProjects(publicProjects(data.items, base.language), base.language),
  };
};
