import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Wand2, Briefcase, Sparkles } from 'lucide-react';
import { useLayoutMode } from '@/hooks/use-layout-mode';

const INSPIRATION_ITEMS = [
  {
    icon: GraduationCap,
    labelKey: 'dashboard.forStudents',
    titleKey: 'dashboard.showcasePortfolio',
    descKey: 'dashboard.showcaseDescription',
    gradient: 'from-sky-500/20 to-blue-500/5',
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-500/10',
  },
  {
    icon: Wand2,
    labelKey: 'dashboard.forCreators',
    titleKey: 'dashboard.viralContentMachine',
    descKey: 'dashboard.viralContentDescription',
    gradient: 'from-purple-500/20 to-pink-500/5',
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500/10',
  },
  {
    icon: Briefcase,
    labelKey: 'dashboard.forBusiness',
    titleKey: 'dashboard.internalTools',
    descKey: 'dashboard.internalToolsDescription',
    gradient: 'from-amber-500/20 to-orange-500/5',
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
];

export const DashboardInspirationSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isCompact } = useLayoutMode();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      {/* Subtle decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 text-brand-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.whatWillYouBuild')}
          </h3>
        </div>
        <div className={`grid gap-4 ${isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
          {INSPIRATION_ITEMS.map((item) => (
            <button
              key={item.labelKey}
              onClick={() => navigate('/deploy')}
              className="relative text-left rounded-xl p-5 group hover:shadow-lg transition-all border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 overflow-hidden"
            >
              {/* Card Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

              <div className="relative">
                <div className={`w-10 h-10 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  {t(item.labelKey)}
                </p>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {t(item.titleKey)}
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">
                  {t(item.descKey)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

