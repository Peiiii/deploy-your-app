import React from 'react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">隐私政策（GemiGo 浏览器扩展）</h1>
          <p className="text-sm text-slate-500">
            更新日期：{new Date().toISOString().slice(0, 10)}
          </p>
        </header>

        <main className="mt-10 space-y-8 leading-7 text-slate-700">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">1. 我们收集哪些信息</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>用户在网页上选中的文本（选区）。</li>
              <li>用户授权后读取的页面内容（例如页面文本、页面结构摘要）。</li>
              <li>用于实现扩展功能的最小运行数据（例如已安装应用列表、设置项）。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">2. 我们如何使用这些信息</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>用于完成用户主动发起的功能（例如分析/总结/问答/高亮等）。</li>
              <li>用于在侧边栏中运行你安装的应用，并向应用提供必要的页面上下文。</li>
              <li>用于提升稳定性与排错（例如必要的错误日志）。</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">3. 信息如何被处理与传输</h2>
            <p>
              当你在扩展中使用需要“读页面/选区”的能力时，扩展会在你授权后通过 content script 读取当前页面内容，并将必要的内容提供给你正在运行的应用使用。部分功能可能需要将内容发送到 GemiGo 平台的后端服务以完成模型推理或任务处理。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">4. 权限说明与用户控制</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium text-slate-900">站点访问授权：</span>
                你可以选择“仅授权当前站点”，或开启 Power Mode 授权所有站点；你也可以在 Chrome 扩展设置中随时撤销授权。
              </li>
              <li>
                <span className="font-medium text-slate-900">最小化原则：</span>
                未经你的授权，扩展不会在网站上注入脚本，也不会读取页面内容。
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">5. 数据保留</h2>
            <p>
              我们仅在完成你主动触发的功能所需的时间范围内处理相关内容。对于扩展本地保存的数据（例如已安装应用列表、设置项），存储在你的浏览器本地存储中，你可以随时清理或卸载扩展以移除相关数据。
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">6. 联系我们</h2>
            <p>
              如对本隐私政策或数据处理方式有任何问题，请通过 GemiGo 官网（https://gemigo.io）站内联系方式与我们联系。
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

