import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';

export const DashboardHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const presenter = usePresenter();

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
          {t('dashboard.myProjects')}
        </h2>
        <p className="text-slate-500 dark:text-gray-400">
          {t('dashboard.manageLiveApps')}
        </p>
      </div>
      <button
        onClick={() =>
          presenter.dashboard.requireAuthAnd(() => navigate('/deploy'))
        }
        className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2 group border border-green-500/50"
      >
        <Zap className="w-5 h-5" />
        {t('deployment.deployYourApp')}
      </button>
    </div>
  );
};
