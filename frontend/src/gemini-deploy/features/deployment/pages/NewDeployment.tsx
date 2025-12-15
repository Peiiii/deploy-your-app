import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeploymentStore } from '@/features/deployment/stores/deploymentStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { usePresenter } from '@/contexts/PresenterContext';
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
      navigate(`/projects/${encodeURIComponent(project.id)}`);
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Elegant Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
          {t('deployment.createProjectTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {t('deployment.createProjectDescription')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
          {t('deployment.projectNameLabel')}
        </label>
        <input
          value={state.projectName}
          onChange={(e) => presenter.deployment.setProjectName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder={t('deployment.projectNamePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {nameTouched && !state.projectName.trim() && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {t('deployment.projectNameRequired')}
          </p>
        )}

        <div className="mt-6 flex flex-col items-end gap-2">
          <button
            onClick={() => {
              setNameTouched(true);
              if (canContinue) void handleCreateProject();
            }}
            disabled={!canContinue || isCreatingProject}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 dark:bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {isCreatingProject
              ? t('common.pleaseWait')
              : t('deployment.createProjectButton')}
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-right max-w-[520px]">
            {t('deployment.createProjectHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
