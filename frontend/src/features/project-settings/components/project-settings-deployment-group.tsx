import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DeploymentSourceTabs } from '@/features/deployment/components/deployment-source-tabs';
import { ProjectSettingsRepoSection } from './project-settings-repo-section';
import { ZipSourceForm } from '@/features/deployment/components/zip-source-form';
import { HtmlSourceForm } from '@/features/deployment/components/html-source-form';
import { SourceType } from '@/types';
import { normalizeGitHubRepoUrl } from '@/utils/project';
import { usePresenter } from '@/contexts/presenter-context';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { RefreshCcw, Play } from 'lucide-react';
import type { Project } from '@/types';
import { UsageNotice } from '@/features/legal/components/usage-notice';

interface ProjectSettingsDeploymentGroupProps {
  project: Project;
  canDeployFromGitHub: boolean;
}

export const ProjectSettingsDeploymentGroup: React.FC<
  ProjectSettingsDeploymentGroupProps
> = ({ project }) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  const [activeSource, setActiveSource] = useState<SourceType>(
    project.sourceType === SourceType.HTML || project.sourceType === SourceType.ZIP
      ? project.sourceType
      : SourceType.GITHUB
  );

  // Local state for inputs
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Keep local edits until the target project changes (the parent keys this form by project ID).
  const [htmlContent, setHtmlContent] = useState(project.htmlContent || '');
  const pendingContent = presenter.deployment.getPendingUpdateContent(project.id);
  const [imported, setImported] = useState(false);

  const isDeployingHtml = useProjectSettingsStore((s) => s.isDeployingHtml);
  const isRedeploying = useProjectSettingsStore((s) => s.isRedeploying);
  const zipUploading = useProjectSettingsStore((s) => s.zipUploading);
  const htmlUploading = useProjectSettingsStore((s) => s.htmlUploading);
  const deploymentStatus = useDeploymentStore((s) => s.deploymentStatus);
  const repoUrlDraft = useProjectSettingsStore((s) => s.repoUrlDraft);

  const isDeploying =
    isDeployingHtml ||
    isRedeploying ||
    zipUploading ||
    htmlUploading ||
    deploymentStatus === 'BUILDING' ||
    deploymentStatus === 'DEPLOYING';

  const handleDeploy = async () => {
    if (activeSource === SourceType.GITHUB) {
      if (!normalizeGitHubRepoUrl(repoUrlDraft)) return;
      if (normalizeGitHubRepoUrl(repoUrlDraft) !== normalizeGitHubRepoUrl(project.repoUrl)) {
        const saved = await presenter.projectSettings.saveRepoUrl();
        if (!saved) return;
      }
      presenter.projectSettings.deployFromGitHub();
    } else if (activeSource === SourceType.HTML) {
      presenter.projectSettings.deployHtmlContent(htmlContent);
    } else if (activeSource === SourceType.ZIP) {
      if (zipFile) {
        presenter.projectSettings.uploadZipAndDeploy(zipFile);
      }
    }
  };

  const insertTemplate = () => {
    setHtmlContent(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Awesome App</title>
    <style>
        body { font-family: system-ui, sans-serif; display: grid; place-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Hello World!</h1>
        <p>Deployed via Inline HTML</p>
    </div>
</body>
</html>`);
  };

  const handleHtmlFileImport = async (file: File) => {
    const text = await file.text();
    setHtmlContent(text);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {t(project.url ? 'deployment.updateAppHeading' : 'deployment.continueAppHeading')}
        </h2>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t(project.url ? 'deployment.updateKeepsAddress' : 'deployment.continueAppDescription')}
        {project.url && <span className="mt-1 block break-all font-medium text-slate-700 dark:text-slate-200">{project.url}</span>}
      </p>
      {pendingContent && !imported && <div className="space-y-2 rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-950/30">
        <p className="text-slate-600 dark:text-slate-300">{t('deployment.savedContentNotice')}</p>
        <button type="button" disabled={isDeploying} className="rounded-md font-medium text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 dark:text-brand-300" onClick={() => {
          setActiveSource(pendingContent.sourceType);
          setHtmlContent(pendingContent.htmlContent);
          setZipFile(pendingContent.zipFile);
          if (pendingContent.sourceType === SourceType.GITHUB) useProjectSettingsStore.getState().actions.setRepoUrlDraft(pendingContent.repoUrl);
          setImported(true);
        }}>{t('deployment.useSavedContent')}</button>
      </div>}
      {pendingContent && <Link to="/deploy" className="inline-block rounded-md text-xs text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{t('deployment.returnToCreation')}</Link>}

      <DeploymentSourceTabs
        activeSource={activeSource}
        onSelect={setActiveSource}
      />

      <div className="mt-6 p-1">
        {activeSource === SourceType.GITHUB && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
            <ProjectSettingsRepoSection project={project} />
          </div>
        )}

        {activeSource === SourceType.ZIP && (
          <ZipSourceForm
            zipFile={zipFile}
            onFileSelected={setZipFile}
            onClearFile={() => setZipFile(null)}
          />
        )}

        {activeSource === SourceType.HTML && (
          <HtmlSourceForm
            htmlContent={htmlContent}
            onHtmlChange={setHtmlContent}
            onHtmlBlur={() => { }}
            onInsertTemplate={insertTemplate}
            onHtmlFileSelected={handleHtmlFileImport}
            showError={!htmlContent.trim()}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <UsageNotice />
        <button
          onClick={handleDeploy}
          disabled={
            isDeploying ||
            (activeSource === SourceType.ZIP && !zipFile) ||
            (activeSource === SourceType.HTML && !htmlContent.trim()) ||
            (activeSource === SourceType.GITHUB && !normalizeGitHubRepoUrl(repoUrlDraft))
          }
          className="self-end inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {isDeploying ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {isDeploying ? t('common.deploying') : t(project.url ? 'deployment.publishUpdate' : 'common.deploy')}
        </button>
      </div>
    </div>
  );
};
