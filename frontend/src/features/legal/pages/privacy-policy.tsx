import React, { useMemo, useState } from 'react';

export const PrivacyPolicyPage: React.FC = () => {
  const lastUpdated = '2025-12-30';

  const defaultLang = useMemo<'zh' | 'en'>(() => {
    try {
      return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } catch {
      return 'en';
    }
  }, []);

  const [lang, setLang] = useState<'zh' | 'en'>(defaultLang);
  const isZh = lang === 'zh';

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {isZh ? '隐私政策（GemiGo 浏览器扩展）' : 'Privacy Policy (GemiGo Browser Extension)'}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setLang('zh')}
                className={`px-3 py-1 rounded-full text-sm border ${
                  isZh ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-sm border ${
                  !isZh ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                English
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {isZh ? '更新日期' : 'Last updated'}：{lastUpdated}
          </p>
        </header>

        <main className="mt-10 space-y-8 leading-7 text-slate-700">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '1. 我们收集哪些信息' : '1. What information we collect'}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {isZh
                  ? '用户在网页上选中的文本（选区）。'
                  : 'Text selected by the user on a webpage (selection).'}
              </li>
              <li>
                {isZh
                  ? '用户授权后读取的页面内容（例如页面文本、页面结构摘要）。'
                  : 'Page content read after user authorization (e.g., page text, basic structure).'}
              </li>
              <li>
                {isZh
                  ? '用于实现扩展功能的最小运行数据（例如已安装应用列表、设置项）。'
                  : 'Minimal runtime data required for extension functionality (e.g., installed apps list, settings).'}
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '2. 我们如何使用这些信息' : '2. How we use the information'}
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {isZh
                  ? '用于完成用户主动发起的功能（例如分析/总结/问答/高亮等）。'
                  : 'To fulfill user-initiated features (e.g., analysis, summarization, Q&A, highlighting).'}
              </li>
              <li>
                {isZh
                  ? '用于在侧边栏中运行你安装的应用，并向应用提供必要的页面上下文。'
                  : 'To run installed apps in the side panel and provide necessary page context to those apps.'}
              </li>
              <li>
                {isZh
                  ? '用于提升稳定性与排错（例如必要的错误日志）。'
                  : 'To improve stability and troubleshooting (e.g., minimal error logs).'}
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '3. 信息如何被处理与传输' : '3. How information is processed and transferred'}
            </h2>
            <p>
              {isZh
                ? '当你在扩展中使用需要“读页面/选区”的能力时，扩展会在你授权后通过 content script 读取当前页面内容，并将必要的内容提供给你正在运行的应用使用。部分功能可能需要将内容发送到 GemiGo 平台的后端服务以完成模型推理或任务处理。'
                : 'When you use features that require reading the page or selection, the extension reads the current page content via a content script after you grant permission, and provides the necessary content to the app you are running. Some features may send relevant content to GemiGo backend services to perform model inference or task processing.'}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '4. 权限说明与用户控制' : '4. Permissions and user controls'}
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium text-slate-900">站点访问授权：</span>
                {isZh
                  ? '你可以选择“仅授权当前站点”，或开启 Power Mode 授权所有站点；你也可以在 Chrome 扩展设置中随时撤销授权。'
                  : 'You can choose to grant access to the current site only, or enable Power Mode to grant access to all sites. You can revoke permissions anytime in Chrome extension settings.'}
              </li>
              <li>
                <span className="font-medium text-slate-900">最小化原则：</span>
                {isZh
                  ? '未经你的授权，扩展不会在网站上注入脚本，也不会读取页面内容。'
                  : 'Without your permission, the extension will not inject scripts into websites and will not read page content.'}
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '5. 数据保留' : '5. Data retention'}
            </h2>
            <p>
              {isZh
                ? '我们仅在完成你主动触发的功能所需的时间范围内处理相关内容。对于扩展本地保存的数据（例如已安装应用列表、设置项），存储在你的浏览器本地存储中，你可以随时清理或卸载扩展以移除相关数据。'
                : 'We process relevant content only for as long as needed to complete the action you initiated. Data stored locally by the extension (e.g., installed apps list, settings) is stored in your browser local storage. You can clear it or uninstall the extension to remove such data.'}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {isZh ? '6. 联系我们' : '6. Contact us'}
            </h2>
            <p>
              {isZh
                ? '如对本隐私政策或数据处理方式有任何问题，请通过 GemiGo 官网（https://gemigo.io）站内联系方式与我们联系。'
                : 'If you have questions about this policy or our data practices, please contact us via the GemiGo website (https://gemigo.io).'}
            </p>
          </section>
        </main>

        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>GemiGo · https://gemigo.io</p>
        </footer>
      </div>
    </div>
  );
};
