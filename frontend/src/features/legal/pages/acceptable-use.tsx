import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';

export const AcceptableUsePage = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.resolvedLanguage?.startsWith('zh');
  const setLanguage = useUIStore((state) => state.actions.setLanguage);

  return (
    <div className="h-screen overflow-y-auto bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
              {t('legal.backHome')}
            </Link>
            <div className="flex gap-2" role="group" aria-label={t('legal.language')}>
              {[
                { code: 'zh-CN', label: '中文', active: isZh },
                { code: 'en', label: 'English', active: !isZh },
              ].map(({ code, label, active }) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setLanguage(code);
                    void i18n.changeLanguage(code);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('legal.policyTitle')}</h1>
          <p className="text-sm text-slate-500">{t('legal.updated')} 2026-10-02</p>
          <p className="leading-7 text-slate-700">{t('legal.intro')}</p>
        </header>

        <main className="mt-8 space-y-8 leading-7 text-slate-700">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t('legal.prohibitedTitle')}</h2>
            <ul className="list-disc space-y-2 pl-5">
              {['fraud', 'malware', 'illegalTrade', 'exploitation', 'rights', 'harm', 'abuse'].map((key) => (
                <li key={key}>{t(`legal.prohibited.${key}`)}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t('legal.responsibilityTitle')}</h2>
            <p>{t('legal.responsibility')}</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{t('legal.enforcementTitle')}</h2>
            <p>{t('legal.enforcement')}</p>
          </section>
          <section id="report" className="scroll-mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{t('legal.report')}</h2>
            <p>{t('legal.reportInstructions')}</p>
            <p>{t('legal.reportEvidence')}</p>
            <p className="text-sm text-slate-500">{t('legal.reportPrivacy')}</p>
            <Link to="/community" className="inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {t('legal.reportAction')}
            </Link>
          </section>
        </main>

        <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <span>GemiGo</span>
          <Link to="/" className="hover:underline">{t('legal.backHome')}</Link>
          <Link to="/privacy-policy" className="hover:underline">{t('legal.privacy')}</Link>
        </footer>
      </div>
    </div>
  );
};
