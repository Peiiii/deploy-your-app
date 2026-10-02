import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight, ChevronDown } from 'lucide-react';
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
    <div className="mx-auto max-w-2xl space-y-8 px-5 py-8 md:py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {t('deployment.publishHeading')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t('deployment.publishDescription')}
        </p>
      </header>
      {!success && (
        <div>
          <fieldset disabled={busy} className="min-w-0 space-y-5 disabled:opacity-70">
            <div className="space-y-3">
              <h2 id="publication-source-label" className="text-sm font-medium text-slate-900 dark:text-white">
                {t('deployment.chooseContentSource')}
              </h2>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950/60" role="group" aria-labelledby="publication-source-label" aria-describedby="publication-source-hint">
                {[SourceType.HTML, SourceType.ZIP, SourceType.GITHUB].map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={state.sourceType === type}
                    onClick={() => {
                      presenter.deployment.handleSourceChange(type);
                      setParams({ source: type });
                    }}
                    className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${state.sourceType === type ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                  >
                    {t(`deployment.contentSources.${type}.label`)}
                  </button>
                ))}
              </div>
              <p id="publication-source-hint" className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t(`deployment.contentSources.${state.sourceType}.description`)}
              </p>
            </div>
            {state.sourceType === SourceType.HTML && (
              <HtmlSourceForm
                htmlContent={state.htmlContent}
                onHtmlChange={presenter.deployment.setHtmlContent}
                onHtmlBlur={() => {}}
                onInsertTemplate={() => presenter.deployment.setHtmlContent(SAMPLE_HTML)}
                onHtmlFileSelected={presenter.deployment.handleHtmlFileUpload}
                showError={false}
                compact
              />
            )}
            {state.sourceType === SourceType.ZIP && (
              <ZipSourceForm
                zipFile={state.zipFile}
                onFileSelected={presenter.deployment.handleFileDrop}
                onClearFile={presenter.deployment.clearZipFile}
                compact
              />
            )}
            {state.sourceType === SourceType.GITHUB && (
              <GithubSourceForm
                repoUrl={state.repoUrl}
                onRepoUrlChange={presenter.deployment.setRepoUrl}
              />
            )}
            <details className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                {t('deployment.optionalName')}
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <label
                htmlFor="publication-name"
                className="sr-only"
              >
                {t('deployment.optionalName')}
              </label>
              <input
                id="publication-name"
                value={state.projectName}
                onChange={(e) => presenter.deployment.setProjectName(e.target.value)}
                placeholder={t('deployment.optionalNameHint')}
                maxLength={80}
                className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </details>
          </fieldset>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !valid || authLoading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {busy ? t('common.deploying') : t('deployment.publish')}
          </button>
          <div className="mt-3 text-center">
            <UsageNotice compact />
          </div>
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
