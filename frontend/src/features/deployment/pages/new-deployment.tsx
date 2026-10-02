import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { useDeploymentStore } from '../stores/deployment.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { SourceType, DeploymentStatus } from '@/types';
import { normalizeGitHubRepoUrl } from '@/utils/project';
import { HtmlSourceForm } from '../components/html-source-form';
import { ZipSourceForm } from '../components/zip-source-form';
import { GithubSourceForm } from '../components/github-source-form';
import { DeploymentSession } from '../components/deployment-session';
import { UsageNotice } from '@/features/legal/components/usage-notice';

const SAMPLE_HTML =
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hello GemiGo</title></head><body style="font-family:system-ui;text-align:center;padding:4rem"><h1>Hello GemiGo!</h1><p>My first shared page.</p></body></html>';

export const NewDeployment = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [params, setParams] = useSearchParams();
  const requestedSource = params.get('source');
  const source = Object.values(SourceType).includes(requestedSource as SourceType)
    ? (requestedSource as SourceType)
    : SourceType.HTML;

  const [initialSource] = useState(source);
  useEffect(() => {
    presenter.deployment.initializeNewPublication(initialSource);
  }, [presenter.deployment, initialSource]);

  const busy =
    state.isPublishingNewProject ||
    state.deploymentStatus === DeploymentStatus.BUILDING ||
    state.deploymentStatus === DeploymentStatus.DEPLOYING;
  const success = state.deploymentStatus === DeploymentStatus.SUCCESS;
  const valid =
    state.sourceType === SourceType.HTML
      ? Boolean(state.htmlContent.trim())
      : state.sourceType === SourceType.ZIP
        ? Boolean(state.zipFile)
        : Boolean(normalizeGitHubRepoUrl(state.repoUrl));
  const publish = async () => {
    if (!user) {
      presenter.auth.openAuthModal('login');
      return;
    }
    try {
      await presenter.deployment.publishNewProject();
    } catch (error) {
      presenter.ui.showErrorToast(
        error instanceof Error ? error.message : t('deployment.projectCreateFailed')
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:py-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('deployment.publishHeading')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t('deployment.publishDescription')}
        </p>
      </header>
      {!success && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6">
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
            <div className="flex gap-2" role="group" aria-label={t('home.moreWays')}>
              {[SourceType.HTML, SourceType.ZIP, SourceType.GITHUB].map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={state.sourceType === type}
                  onClick={() => {
                    presenter.deployment.handleSourceChange(type);
                    setParams({ source: type });
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${state.sourceType === type ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {type === SourceType.GITHUB ? 'GitHub' : type.toUpperCase()}
                </button>
              ))}
            </div>
            {state.sourceType === SourceType.HTML && (
              <HtmlSourceForm
                htmlContent={state.htmlContent}
                onHtmlChange={presenter.deployment.setHtmlContent}
                onHtmlBlur={() => {}}
                onInsertTemplate={() => presenter.deployment.setHtmlContent(SAMPLE_HTML)}
                onHtmlFileSelected={presenter.deployment.handleHtmlFileUpload}
                showError={false}
              />
            )}
            {state.sourceType === SourceType.ZIP && (
              <ZipSourceForm
                zipFile={state.zipFile}
                onFileSelected={presenter.deployment.handleFileDrop}
                onClearFile={presenter.deployment.clearZipFile}
              />
            )}
            {state.sourceType === SourceType.GITHUB && (
              <GithubSourceForm
                repoUrl={state.repoUrl}
                onRepoUrlChange={presenter.deployment.setRepoUrl}
              />
            )}
            <div>
              <label
                htmlFor="publication-name"
                className="block text-sm font-medium text-slate-900 dark:text-white"
              >
                {t('deployment.optionalName')}
              </label>
              <input
                id="publication-name"
                value={state.projectName}
                onChange={(e) => presenter.deployment.setProjectName(e.target.value)}
                placeholder={t('deployment.optionalNameHint')}
                maxLength={80}
                className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </fieldset>
          <div className="mt-5">
            <UsageNotice />
          </div>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !valid || authLoading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {busy ? t('common.deploying') : t('deployment.publish')}
          </button>
        </div>
      )}
      <DeploymentSession projectId={state.newProjectId ?? undefined} />
      {success && (
        <button
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-200"
          onClick={() => presenter.deployment.initializeNewPublication(source)}
        >
          {t('deployment.publishAnother')}
        </button>
      )}
    </div>
  );
};
