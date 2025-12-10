import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useDeploymentStore } from '../stores/deploymentStore';
import { usePresenter } from '../contexts/PresenterContext';
import { DeploymentStatus, SourceType } from '../types';
import { DeploymentSession } from '../components/DeploymentSession';
import { ArrowRight } from 'lucide-react';
import { DeploymentSourceTabs } from '../components/deployment/DeploymentSourceTabs';
import { GithubSourceForm } from '../components/deployment/GithubSourceForm';
import { ZipSourceForm } from '../components/deployment/ZipSourceForm';
import { HtmlSourceForm } from '../components/deployment/HtmlSourceForm';

const SIMPLE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Landing Page</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #0f172a; color: #f8fafc; }
      main { max-width: 640px; margin: 0 auto; padding: 64px 24px; text-align: center; }
      a { color: #38bdf8; text-decoration: none; font-weight: 600; }
      button { margin-top: 32px; padding: 12px 28px; background: #7c3aed; color: #fff; border: none; border-radius: 999px; font-size: 1rem; }
    </style>
  </head>
  <body>
    <main>
      <p style="text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.8rem; color: #94a3b8;">New Release</p>
      <h1 style="font-size: 2.5rem; margin: 12px 0;">Launch your idea in minutes</h1>
      <p style="color: #cbd5f5; line-height: 1.6;">
        Deploy static HTML instantly with GeminiDeploy. Paste your design, click deploy, and share the live URL.
      </p>
      <button>Get started</button>
    </main>
  </body>
</html>`;

export const NewDeployment: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const location = useLocation();
  const [htmlFieldTouched, setHtmlFieldTouched] = useState(false);

  const handleSourceTypeSelect = useCallback((type: SourceType) => {
    presenter.deployment.handleSourceChange(type);
    if (type !== SourceType.HTML) {
      setHtmlFieldTouched(false);
    }
  }, [presenter.deployment]);

  useEffect(() => {
    return () => presenter.deployment.resetWizard();
  }, [presenter.deployment]);

  useEffect(() => {
    const sourceType = location.state?.sourceType as SourceType | undefined;
    if (sourceType && Object.values(SourceType).includes(sourceType)) {
      const rafId = requestAnimationFrame(() => handleSourceTypeSelect(sourceType));
      return () => cancelAnimationFrame(rafId);
    }
    return undefined;
  }, [handleSourceTypeSelect, location.state]);

  const handleDeployStart = async () => {
    await presenter.deployment.startFromWizard();
  };

  const handleInsertTemplate = () => {
    presenter.deployment.setHtmlContent(SIMPLE_HTML_TEMPLATE);
    setHtmlFieldTouched(true);
    if (!state.projectName) {
      presenter.deployment.setProjectName('landing-page');
    }
  };

  // Only treat the deployment flow as "idle" when nothing has been started yet.
  // After a deployment has run (success or failure), we keep showing the
  // DeploymentSession so the user can inspect logs and status.
  const isIdle = state.deploymentStatus === DeploymentStatus.IDLE;

  const htmlIsReady = state.htmlContent.trim().length > 0;
  const canContinue =
    state.sourceType === SourceType.GITHUB
      ? state.repoUrl.trim().length > 0
      : state.sourceType === SourceType.ZIP
        ? Boolean(state.zipFile)
        : htmlIsReady;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Elegant Header */}
      <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
            {t('deployment.deployYourApp')}
          </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {t('deployment.deployDescription')}
        </p>
      </div>

      {/* Show deployment session when active or completed; otherwise show the source wizard */}
      {isIdle ? (
        /* Source Selection - shown when no deployment has been started yet */
        <div className="space-y-6">
          {/* Source Type Selection */}
          <DeploymentSourceTabs
            activeSource={state.sourceType}
            onSelect={handleSourceTypeSelect}
          />

          {/* Input Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            {state.sourceType === SourceType.GITHUB && (
              <GithubSourceForm
                repoUrl={state.repoUrl}
                onRepoUrlChange={(value) => {
                  presenter.deployment.setRepoUrl(value);
                  presenter.deployment.autoProjectName(
                    value,
                    SourceType.GITHUB,
                  );
                }}
              />
            )}
            {state.sourceType === SourceType.ZIP && (
              <ZipSourceForm
                zipFile={state.zipFile}
                onFileSelected={(file) =>
                  presenter.deployment.handleFileDrop(file)
                }
                onClearFile={() => presenter.deployment.clearZipFile()}
              />
            )}
            {state.sourceType === SourceType.HTML && (
              <HtmlSourceForm
                htmlContent={state.htmlContent}
                onHtmlChange={(value) =>
                  presenter.deployment.setHtmlContent(value)
                }
                onHtmlBlur={() => setHtmlFieldTouched(true)}
                onInsertTemplate={handleInsertTemplate}
                onHtmlFileSelected={async (file) => {
                  await presenter.deployment.handleHtmlFileUpload(file);
                  setHtmlFieldTouched(true);
                }}
                showError={htmlFieldTouched && !htmlIsReady}
              />
            )}

            {/* Action Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => canContinue && void handleDeployStart()}
                disabled={!canContinue}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 dark:bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                {t('common.continue') || 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <DeploymentSession />
      )}
    </div>
  );
};
