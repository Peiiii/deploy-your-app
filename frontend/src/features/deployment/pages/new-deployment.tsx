import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { WizardLayout } from '@/features/deployment/components/wizard-layout';
import { ArrowRight } from 'lucide-react';

export const NewDeployment: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const navigate = useNavigate();
  const [nameTouched, setNameTouched] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    presenter.deployment.resetWizard();
    return () => presenter.deployment.resetWizard();
  }, [presenter.deployment]);

  useEffect(() => {
    if (!state.projectName.trim()) {
      presenter.deployment.setProjectName(
        `new-app-${Math.random().toString(36).slice(2, 6)}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Do not auto-open auth modal on page entry; only open it when the user
  // explicitly clicks a sign-in CTA.

  const handleCreateProject = async () => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    try {
      const trimmedName = state.projectName.trim();
      if (!trimmedName) {
        presenter.ui.showErrorToast(t('deployment.projectNameRequired'));
        return;
      }

      const project = await presenter.project.createDraftProject(trimmedName);
      if (!project) {
        presenter.ui.showErrorToast(t('deployment.projectCreateFailed'));
        return;
      }
      presenter.ui.showSuccessToast(t('deployment.projectCreated'));
      navigate(`/projects/${encodeURIComponent(project.id)}?tab=deployments`);
    } catch (err) {
      console.error(err);
      presenter.ui.showErrorToast(t('deployment.projectCreateFailed'));
    } finally {
      setIsCreatingProject(false);
    }
  };

  const canContinue = state.projectName.trim().length > 0;

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow space-y-4">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {t('deployment.createProjectTitle')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('deployment.signInRequired')}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => presenter.auth.openAuthModal('login')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
            >
              {t('auth.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { label: t('common.projectName'), active: true },
    { label: t('common.source'), completed: false },
    { label: t('common.deploy'), completed: false },
  ];

  return (
    <WizardLayout steps={steps}>
      <div className="space-y-6 animate-fade-in">
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('deployment.createProjectTitle')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            {t('deployment.createProjectDescription')}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm max-w-2xl mx-auto">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
            {t('deployment.projectNameLabel')}
          </label>
          <div className="space-y-2">
            <input
              value={state.projectName}
              onChange={(e) => presenter.deployment.setProjectName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder={t('deployment.projectNamePlaceholder')}
              autoFocus
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all font-medium"
            />
            {nameTouched && !state.projectName.trim() && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {t('deployment.projectNameRequired')}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={() => {
                setNameTouched(true);
                if (canContinue) void handleCreateProject();
              }}
              disabled={!canContinue || isCreatingProject}
              className="w-full md:w-auto min-w-[200px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {isCreatingProject
                ? t('common.pleaseWait')
                : t('deployment.createProjectButton')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {t('deployment.createProjectHint')}
            </p>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
};
