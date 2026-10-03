import { renderGuideExamples } from './guide-examples.mjs';
// Public product facts and metadata. Shared by Pages, the build and React.
export const SITE = 'https://gemigo.io';
export const PUBLIC_PATHS = [
  '/',
  '/explore',
  '/about',
  '/guides/publish-html',
  '/guides/publish-zip',
];
const copy = {
  en: {
    home: [
      'Publish and share web apps | GemiGo',
      'Publish web apps from HTML, ZIP files or GitHub. Get a shareable link, manage updates, and discover interactive tools, learning apps and games.',
      'Publish and share web apps',
    ],
    explore: [
      'Discover interactive apps, learning tools and games | GemiGo',
      'Explore publicly shared GemiGo apps, including learning tools, games and interactive demos. Preview an app, visit its website and meet its creator.',
      'Discover apps made by the community',
    ],
    about: [
      'About GemiGo: web app publishing and sharing',
      'Learn what GemiGo does, how HTML, ZIP and GitHub publishing work, and the boundaries of public sharing and application hosting.',
      'What is GemiGo?',
    ],
    html: [
      'How to publish an HTML app and share its link | GemiGo',
      'A practical guide to publishing HTML with GemiGo: paste your code, publish the app, check the public link, and update it when your content changes.',
      'How to publish an HTML app',
    ],
    zip: [
      'How to publish a ZIP web app | GemiGo',
      'Publish a web app from a ZIP file with GemiGo. Learn the difference between a ready-built static site and source code that needs a build step.',
      'How to publish a ZIP web app',
    ],
    publish: 'Publish an app',
    exploreLink: 'Explore apps',
    aboutLink: 'About GemiGo',
    htmlLink: 'Publish HTML',
    zipLink: 'Publish a ZIP',
    language: '中文',
    sections: {
      home: [
        [
          'From your content to a public link',
          'Paste HTML, upload a ZIP, or use a GitHub repository. GemiGo publishes web application content so you can open it in a browser and share a link.',
        ],
        [
          'Interactive content you can share',
          'Publish a learning activity, browser game, interactive demo or web tool. These are examples of supported web content, not a promise that every app works without changes.',
        ],
        [
          'What happens after publishing?',
          'Open the resulting website, check its behavior, and use your project settings to update the application. Public discovery is controlled separately from access to the deployed link.',
        ],
      ],
      explore: [
        [
          'Try an app before making your own',
          'The discovery feed contains applications whose creators have enabled public listing. Filter by category and app language, open a preview, then visit the deployed website. Learning activities, games and practical tools are examples of community content.',
        ],
      ],
      about: [
        [
          'Publishing existing web content',
          'GemiGo helps you publish and share web apps you already have. The current publishing inputs are HTML code, ZIP files and GitHub repositories. You do not need to create the content with any particular AI tool.',
        ],
        [
          'What can I publish?',
          'Browser-based learning activities, science demos, games, calculators and other web tools are examples. Ready-built static files can be published directly; source projects with a build script run a build before their static output is published.',
        ],
        [
          'What are the limits?',
          'Publishing a frontend does not automatically deploy an arbitrary backend, database or private server. Review your app’s external API, authentication and storage requirements. Never include private keys or secrets in browser code or files that will be publicly served.',
        ],
        [
          'Is the link private when discovery is off?',
          'No. Public listing controls whether an app appears in GemiGo discovery. Turning it off does not make the deployed URL access-controlled. Use the acceptable-use and privacy pages to understand public sharing and data handling.',
        ],
        [
          'Who maintains this information?',
          'These product facts and publishing guides are maintained by GemiGo. They describe currently implemented publishing paths; they do not promise search rankings, learning outcomes or future pricing.',
        ],
      ],
      html: [
        [
          'What you need',
          'Use HTML content that runs in a browser. A self-contained HTML page is a convenient starting point for an interactive lesson, game, calculator or demo. If it depends on separate local files, package the files as a ZIP instead.',
        ],
        [
          '1. Paste your HTML',
          'Open Publish an app, choose HTML, and paste the HTML into the code input. Sign in when the publishing flow asks you to. Review any external scripts and API calls before publishing.',
        ],
        [
          '2. Publish and check the result',
          'Start publishing and follow the deployment status. Once it succeeds, open the resulting website URL in another browser tab and check the app’s controls, images and mobile layout. A successful upload is not proof that every external dependency works.',
        ],
        [
          '3. Share or update the app',
          'Share the resulting link with your audience. To publish a change, open the app in your dashboard and use its project settings to redeploy. Public discovery is a separate setting; an unlisted app can still be opened by anyone with its deployed URL.',
        ],
        [
          'Why does my page fail after publishing?',
          'Check browser errors, missing assets and unavailable external APIs. Local filesystem paths do not become public URLs. Never put private API keys into HTML or client-side JavaScript. Use the project’s latest deployment result when diagnosing a failed release.',
        ],
      ],
      zip: [
        [
          'Choose the right ZIP content',
          'A ready-built static site contains the HTML entry point and the assets it references. A source project contains source files and may define a build script. GemiGo publishes static files directly and builds supported source projects that declare a build step.',
        ],
        [
          '1. Prepare the files',
          'Keep the app entry point, assets and build configuration together. Include the dependencies and build script needed by a source project. Do not include node_modules, private keys or secret environment files. Verify the output runs in a browser.',
        ],
        [
          '2. Upload and publish',
          'Open Publish an app, choose ZIP, select your archive and follow the publishing flow. Sign in when asked. Read the build and deployment status; if the build fails, inspect the reported error and fix the source before trying again.',
        ],
        [
          '3. Check the live website',
          'After success, open the resulting URL and test navigation, asset loading and external integrations. Share that URL or update the app through its project settings. A frontend deployment does not automatically run a backend service.',
        ],
        [
          'When should I paste HTML instead?',
          'If the whole app fits into a single HTML document, pasting HTML avoids packaging an archive. Use ZIP when the app needs multiple local assets or a source build. You can also use the existing GitHub publishing option for a repository.',
        ],
      ],
    },
  },
  'zh-CN': {
    home: [
      '发布与分享网页应用 | GemiGo',
      '将 HTML、ZIP 或 GitHub 中的网页应用发布为可分享链接，管理后续更新，发现互动工具、学习应用和游戏。',
      '发布与分享网页应用',
    ],
    explore: [
      '发现互动应用、学习工具和游戏 | GemiGo',
      '浏览创作者在 GemiGo 公开分享的学习工具、游戏和互动演示，预览应用、访问网站并了解作者。',
      '发现社区创作的应用',
    ],
    about: [
      '关于 GemiGo：网页应用发布与分享',
      '了解 GemiGo 的 HTML、ZIP 和 GitHub 发布能力，以及公开分享、静态应用托管和外部服务的边界。',
      'GemiGo 是什么？',
    ],
    html: [
      '如何发布 HTML 应用并分享链接 | GemiGo',
      '使用 GemiGo 发布 HTML 应用：粘贴代码、发布应用、检查公开链接，并在内容变化后更新应用。',
      '如何发布 HTML 应用',
    ],
    zip: [
      '如何发布 ZIP 网页应用 | GemiGo',
      '使用 GemiGo 发布 ZIP 网页应用，了解可直接发布的静态文件与需要构建的源码项目之间的区别。',
      '如何发布 ZIP 网页应用',
    ],
    publish: '发布应用',
    exploreLink: '探索应用',
    aboutLink: '关于 GemiGo',
    htmlLink: '发布 HTML 指南',
    zipLink: '发布 ZIP 指南',
    language: 'English',
    sections: {
      home: [
        [
          '把已有内容变成公开链接',
          '粘贴 HTML、上传 ZIP，或从 GitHub 仓库发布。GemiGo 将已有网页应用发布为可在浏览器打开、可分享的链接。',
        ],
        [
          '可以分享哪些互动内容？',
          '学习活动、浏览器游戏、互动演示和网页工具都是可以尝试的内容类型。具体应用能否正常运行，仍取决于它的构建方式和外部依赖。',
        ],
        [
          '发布后怎样继续使用？',
          '打开生成的网站检查功能，通过项目设置更新应用。是否出现在公开发现页与部署链接是否可访问，是两个不同的设置边界。',
        ],
      ],
      explore: [
        [
          '先试用，再创作',
          '探索页展示作者开启公开展示的应用。可以按分类和应用实际语言筛选，先预览，再打开部署网站。学习活动、游戏和实用工具都是社区已有内容的例子。',
        ],
      ],
      about: [
        [
          '发布已有网页内容',
          'GemiGo 帮助你发布和分享已有网页应用，目前支持粘贴 HTML、上传 ZIP 和从 GitHub 仓库发布。内容无需由某一种特定 AI 工具生成。',
        ],
        [
          '可以发布什么？',
          '浏览器中的学习活动、科学演示、游戏、计算器和其他网页工具都是应用例子。已构建的静态文件直接发布；带构建脚本的源码项目先构建，再发布静态产物。',
        ],
        [
          '能力边界是什么？',
          '发布前端不会自动部署任意后端、数据库或私有服务器。请确认应用的外部 API、认证和存储依赖。不要把私有密钥或 Secrets 放进浏览器代码或公开文件。',
        ],
        [
          '关闭公开展示后，链接是否私密？',
          '不是。公开展示控制应用是否出现在 GemiGo 探索页；关闭展示不会为部署网址加上访问控制。公开分享和数据处理约定见使用规范与隐私政策。',
        ],
        [
          '这些信息由谁维护？',
          '产品事实和发布指南由 GemiGo 维护，描述已经实现的发布路径，不承诺搜索排名、学习效果或未来收费方案。',
        ],
      ],
      html: [
        [
          '需要准备什么？',
          '准备可以在浏览器运行的 HTML。单个 HTML 页面适合发布互动练习、游戏、计算器或演示。如果依赖独立的本地资源文件，建议将文件一起打包为 ZIP。',
        ],
        [
          '1. 粘贴 HTML',
          '打开「发布应用」，选择 HTML，粘贴代码。按发布流程提示登录。发布前检查外部脚本和 API 调用，确认它们适合公开运行。',
        ],
        [
          '2. 发布并检查结果',
          '开始发布，查看部署状态。成功后在新标签页打开生成的网站，检查按钮、图片和手机布局。上传成功不代表所有外部依赖都正常。',
        ],
        [
          '3. 分享或更新',
          '将生成的链接分享给使用者。需要修改时，从仪表板打开项目设置并重新部署。公开展示是独立设置；即使未在探索页列出，持有部署链接的人仍能访问。',
        ],
        [
          '发布后页面出错怎么办？',
          '检查浏览器报错、缺失资源和外部 API。本地文件路径不会自动变为公网地址。不要将私有 API Key 放进 HTML 或前端 JavaScript。发布失败时，在项目设置查看最近发布结果并修正问题。',
        ],
      ],
      zip: [
        [
          '先分清 ZIP 中的内容',
          '已构建的静态网站包含 HTML 入口和其引用的资源。源码项目包含源文件，并可能声明构建脚本。GemiGo 直接发布静态文件，对声明构建步骤的受支持源码项目先执行构建。',
        ],
        [
          '1. 准备文件',
          '把应用入口、资源和构建配置放在一起。源码项目需要包含构建脚本和依赖声明。不要打包 node_modules、私有密钥或含 Secrets 的环境文件，并确认输出可在浏览器运行。',
        ],
        [
          '2. 上传并发布',
          '打开「发布应用」，选择 ZIP 并上传压缩包，按提示登录和发布。查看构建与部署状态。构建失败时，依据错误提示修正源码，再尝试发布。',
        ],
        [
          '3. 检查线上网站',
          '成功后打开生成的链接，测试导航、资源加载和外部集成。可以分享链接，也可以通过项目设置继续更新。前端部署不会自动运行后端服务。',
        ],
        [
          '什么时候直接粘贴 HTML？',
          '应用全部包含在单个 HTML 文档中时，直接粘贴可以省去打包。需要多份本地资源或源码构建时使用 ZIP。已有仓库也可以选择 GitHub 发布入口。',
        ],
      ],
    },
  },
};
const keys = {
  '/': 'home',
  '/explore': 'explore',
  '/about': 'about',
  '/guides/publish-html': 'html',
  '/guides/publish-zip': 'zip',
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
export const localizedPath = (path, language) => path + (language === 'zh-CN' ? '?lang=zh-CN' : '');
export const getSeo = (url) => {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const language = url.searchParams.get('lang') === 'zh-CN' ? 'zh-CN' : 'en';
  const key = keys[path];
  const text = copy[language];
  const [title, description, heading] = key ? text[key] : ['GemiGo', '', 'GemiGo'];
  const canonical = SITE + localizedPath(path, language);
  const known =
    Boolean(key) ||
    [
      '/dashboard',
      '/deploy',
      '/community',
      '/admin',
      '/admin/projects',
      '/design/branding',
      '/me',
      '/privacy',
      '/privacy-policy',
      '/acceptable-use',
      '/sdk/broker',
      '/cli/login',
      '/cli/login/success',
    ].includes(path) ||
    path === '/catalog' || /^\/(projects|u)\/[^/]+$/.test(path);
  const structuredData = key
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': SITE + '/#organization',
            name: 'GemiGo',
            url: SITE + '/',
            logo: SITE + '/logo.svg',
          },
          {
            '@type': 'WebSite',
            '@id': SITE + '/#website',
            name: 'GemiGo',
            url: SITE + '/',
            publisher: { '@id': SITE + '/#organization' },
            inLanguage: ['en', 'zh-CN'],
          },
          {
            '@type': path.startsWith('/guides/') ? 'Article' : 'WebPage',
            '@id': canonical + '#page',
            url: canonical,
            name: title,
            headline: heading,
            description,
            inLanguage: language,
            isPartOf: { '@id': SITE + '/#website' },
            publisher: { '@id': SITE + '/#organization' },
            ...(path.startsWith('/guides/') ? { author: { '@id': SITE + '/#organization' } } : {}),
          },
        ],
      }
    : null;
  return {
    path,
    key,
    language,
    title,
    description,
    heading,
    canonical,
    indexable: Boolean(key),
    known,
    structuredData,
  };
};
export const renderSeoHead = (seo) => {
  const tag = (name, value, property = false) =>
    `<meta data-seo ${property ? 'property' : 'name'}="${name}" content="${escape(value)}">`;
  const link = (rel, href, extra = '') =>
    `<link data-seo rel="${rel}" href="${escape(href)}" ${extra}>`;
  return (
    `<title data-seo>${escape(seo.title)}</title>` +
    tag('gemigo:route', seo.path) +
    tag('description', seo.description) +
    tag('robots', seo.indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow') +
    link('canonical', seo.canonical) +
    (seo.indexable && seo.key
      ? ['en', 'zh-CN', 'x-default']
          .map((lang) =>
            link('alternate', SITE + localizedPath(seo.path, lang), `hreflang="${lang}"`)
          )
          .join('')
      : '') +
    tag('og:type', seo.path.startsWith('/guides/') ? 'article' : 'website', true) +
    tag('og:url', seo.canonical, true) +
    tag('og:title', seo.title, true) +
    tag('og:description', seo.description, true) +
    tag('og:site_name', 'GemiGo', true) +
    tag('og:locale', seo.language === 'zh-CN' ? 'zh_CN' : 'en_US', true) +
    tag('twitter:card', 'summary') +
    tag('twitter:title', seo.title) +
    tag('twitter:description', seo.description) +
    (seo.structuredData
      ? `<script data-seo type="application/ld+json">${JSON.stringify(seo.structuredData).replace(/</g, '\\u003c')}</script>`
      : '')
  );
};
export const renderSeoContent = (seo, includeHeading = true) => {
  if (!seo.key) return '';
  const text = copy[seo.language];
  const href = (path, label) =>
    `<a href="${escape(localizedPath(path, seo.language))}">${escape(label)}</a>`;
  return `<article class="seo-content">${includeHeading ? `<h1>${escape(seo.heading)}</h1><p>${escape(seo.description)}</p>` : ''}${text.sections[seo.key].map(([heading, paragraph]) => `<section><h2>${escape(heading)}</h2><p>${escape(paragraph)}</p></section>`).join('')}${renderGuideExamples(seo.key, seo.language)}<nav aria-label="${seo.language === 'zh-CN' ? '发布帮助' : 'Publishing help'}">${href('/deploy', text.publish)}${href('/explore', text.exploreLink)}${href('/catalog', seo.language === 'zh-CN' ? '公开作品目录' : 'Public app catalog')}${href('/about', text.aboutLink)}${href('/guides/publish-html', text.htmlLink)}${href('/guides/publish-zip', text.zipLink)}${`<a href="${escape(seo.path + (seo.language === 'en' ? '?lang=zh-CN' : '?lang=en'))}">${escape(text.language)}</a>`}</nav><p><a href="/privacy-policy">${seo.language === 'zh-CN' ? '隐私政策' : 'Privacy policy'}</a> · <a href="/acceptable-use">${seo.language === 'zh-CN' ? '使用规范' : 'Acceptable use'}</a></p></article>`;
};
export const renderSitemap = () =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${PUBLIC_PATHS.flatMap((path) => ['en', 'zh-CN'].map((language) => `<url><loc>${escape(SITE + localizedPath(path, language))}</loc>${['en', 'zh-CN', 'x-default'].map((lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(SITE + localizedPath(path, lang))}"/>`).join('')}</url>`)).join('')}</urlset>`;
export const renderLlms = () =>
  `# GemiGo\n\n> Publish and share existing web apps from HTML, ZIP files or GitHub repositories.\n\nGemiGo publishes browser applications. Ready-built static files are published directly; supported source projects with a build script build before publishing static output. Hosting a frontend does not automatically run an arbitrary backend or database. Public discovery is separate from access to the deployed URL. Never publish secrets in browser code.\n\n## Product information and guides\n${PUBLIC_PATHS.map((path) => `- [${copy.en[keys[path]][2]}](${SITE + path}): ${copy.en[keys[path]][1]}`).join('\n')}\n\n## Policies\n- [Privacy](${SITE}/privacy-policy)\n- [Acceptable use](${SITE}/acceptable-use)\n\nChinese versions of public information use ?lang=zh-CN. This file is an optional summary of the linked human-readable pages, not a search ranking or AI citation guarantee.\n`;
