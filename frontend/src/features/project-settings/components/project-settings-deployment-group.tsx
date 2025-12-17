import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSourceTabs } from '@/features/deployment/components/deployment-source-tabs';
import { ProjectSettingsRepoSection } from './project-settings-repo-section';
import { ZipSourceForm } from '@/features/deployment/components/zip-source-form';
import { HtmlSourceForm } from '@/features/deployment/components/html-source-form';
import { SourceType } from '@/types';
import { usePresenter } from '@/contexts/presenter-context';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { RefreshCcw, Play } from 'lucide-react';
import type { Project } from '@/types';

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
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || '');
  const [htmlContent, setHtmlContent] = useState(project.htmlContent || '');
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Sync with project updates
  useEffect(() => {
    queueMicrotask(() => {
      if (project.repoUrl) setRepoUrl(project.repoUrl);
      if (project.htmlContent) setHtmlContent(project.htmlContent);
    });
  }, [project]);

  const isRedeploying = useProjectSettingsStore((s) => s.isRedeploying);
  const zipUploading = useProjectSettingsStore((s) => s.zipUploading);
  const htmlUploading = useProjectSettingsStore((s) => s.htmlUploading);
  const deploymentStatus = useDeploymentStore((s) => s.deploymentStatus);

  const isDeploying =
    isRedeploying ||
    zipUploading ||
    htmlUploading ||
    deploymentStatus === 'BUILDING' ||
    deploymentStatus === 'DEPLOYING';

  const handleDeploy = async () => {
    if (activeSource === SourceType.GITHUB) {
      if (repoUrl !== project.repoUrl) {
        // TODO: Update repo url functionality if needed, for now we rely on the project's saved URL
        // or we should update it before deploying. 
        // Integrating simple metadata update:
        // For now, assuming user must save repo in the form if we kept the old section, 
        // but since we removed it, we might need to update it.
        // Deploy from GitHub using the current project's repoUrl.
        // GitHub deployments require repoUrl to be configured first.
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
          {t('project.deploymentManagement')}
        </h2>
      </div>

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

      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleDeploy}
          disabled={
            isDeploying ||
            (activeSource === SourceType.ZIP && !zipFile) ||
            (activeSource === SourceType.HTML && !htmlContent.trim()) ||
            (activeSource === SourceType.GITHUB && !project.repoUrl)
          }
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {isDeploying ? (
            <RefreshCcw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {isDeploying ? t('common.deploying') : t('common.deploy')}
        </button>
      </div>
    </div>
  );
};
