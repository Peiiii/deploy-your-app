import React from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Wand2, Briefcase } from 'lucide-react';

export const DashboardInspirationSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        {t('dashboard.whatWillYouBuild')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('dashboard.forStudents')}
          </h4>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            {t('dashboard.showcasePortfolio')}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {t('dashboard.showcaseDescription')}
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
            <Wand2 className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('dashboard.forCreators')}
          </h4>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            {t('dashboard.viralContentMachine')}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {t('dashboard.viralContentDescription')}
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('dashboard.forBusiness')}
          </h4>
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
            {t('dashboard.internalTools')}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {t('dashboard.internalToolsDescription')}
          </p>
        </div>
      </div>
    </div>
  );
};
