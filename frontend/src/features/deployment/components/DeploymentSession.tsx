import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeploymentStore } from '@/features/deployment/stores/deploymentStore';
import { useProjectStore } from '@/stores/projectStore';
import { usePresenter } from '@/contexts/PresenterContext';
import { DeploymentStatus, SourceType } from '@/types';
import { Terminal } from '@/components/Terminal';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Loader2,
  Terminal as TerminalIcon,
} from 'lucide-react';

interface DeploymentSessionProps {
  // Optional override of the deployed application's public URL.
  // When not provided, the component will try to resolve it from the project list
  // using the current deploymentStore.projectName.
  projectUrlOverride?: string;
}

export const DeploymentSession: React.FC<DeploymentSessionProps> = ({
  projectUrlOverride,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const projects = useProjectStore((s) => s.projects);
  const projectsLoading = useProjectStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [showBuildLog, setShowBuildLog] = useState(false);

  const isDeploying = state.deploymentStatus === DeploymentStatus.DEPLOYING;
  const isInProgress =
    state.deploymentStatus === DeploymentStatus.BUILDING || isDeploying;

  const resolvedProject = useMemo(() => {
    return projects.find((p) => {
      if (state.sourceType === SourceType.GITHUB) {
        return p.repoUrl === state.repoUrl;
      }
      if (state.sourceType === SourceType.ZIP) {
        const identifier = state.zipFile?.name || 'archive.zip';
        return p.repoUrl === identifier;
      }
      if (state.sourceType === SourceType.HTML) {
        const identifier = 'inline.html';
        return p.repoUrl === identifier || p.name === state.projectName;
      }
      return p.name === state.projectName;
    }) ?? null;
  }, [
    projects,
    state.projectName,
    state.repoUrl,
    state.sourceType,
    state.zipFile,
  ]);
  const deploymentUrl = projectUrlOverride ?? resolvedProject?.url ?? null;
  const finalProjectName = resolvedProject?.name ?? state.projectName;
  const sourceLabel =
    resolvedProject?.repoUrl ??
    (state.sourceType === SourceType.GITHUB
      ? state.repoUrl
      : state.sourceType === SourceType.ZIP
        ? state.zipFile?.name
        : 'inline.html');

  // Whenever a deployment succeeds, refresh projects so that URLs / metadata stay in sync.
  useEffect(() => {
    if (state.deploymentStatus === DeploymentStatus.SUCCESS) {
      presenter.project.loadProjects();
    }
  }, [state.deploymentStatus, presenter.project]);

  if (state.deploymentStatus === DeploymentStatus.ANALYZING) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              {t('deployment.analyzingRepository')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {sourceLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.deploymentStatus === DeploymentStatus.SUCCESS) {
    if (!resolvedProject && !projectUrlOverride) {
      // If projects are still loading, keep showing the "finalizing" spinner.
      if (projectsLoading) {
        return (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center shadow">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('deployment.finalizingDeployment')}
            </p>
          </div>
        );
      }

      // If projects are not loading anymore but we still cannot resolve the
      // project, show a graceful fallback instead of an infinite spinner.
      return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-slate-800 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {t('deployment.finalizingDeployment')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('deployment.viewDashboard')}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              {t('deployment.viewDashboard')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl border border-green-200 dark:border-green-900/50 p-8 shadow-lg">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {t('deployment.successful')}
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('deployment.project')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {finalProjectName}
                  </p>
                </div>
                <div>
                  {deploymentUrl ? (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {t('deployment.applicationLiveAt')}
                      </p>
                      <a
                        href={deploymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-mono text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
                      >
                        {deploymentUrl}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {t('deployment.finishedPreparingUrl')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() =>
                      deploymentUrl && window.open(deploymentUrl, '_blank')
                    }
                    disabled={!deploymentUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Globe className="w-4 h-4" />
                    {deploymentUrl ? t('deployment.openSite') : t('deployment.preparingUrl')}
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t('deployment.viewDashboard')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Build Log Toggle */}
        {state.logs.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <button
              onClick={() => setShowBuildLog(!showBuildLog)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TerminalIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {t('deployment.buildLog')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({state.logs.length} {t('deployment.logEntries')})
                </span>
              </div>
              {showBuildLog ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              )}
            </button>
            {showBuildLog && (
              <div className="border-t border-slate-200 dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black">
                  <div className="bg-slate-800 dark:bg-slate-950 px-6 py-3 border-b border-slate-700 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">
                          {t('deployment.buildLogTitle', { name: finalProjectName })}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {sourceLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Terminal
                    logs={state.logs}
                    className="border-none rounded-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isInProgress) {
    // Show build log while deployment is in progress.
    return (
      <div className="bg-slate-900 dark:bg-black rounded-xl border border-slate-800 dark:border-slate-900 overflow-hidden shadow-xl">
        <div className="bg-slate-800 dark:bg-slate-950 px-6 py-4 border-b border-slate-700 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {isDeploying ? t('deployment.deploying') : t('deployment.building')} {state.projectName}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {state.sourceType === SourceType.GITHUB
                  ? state.repoUrl
                  : state.sourceType === SourceType.ZIP
                    ? state.zipFile?.name
                    : 'inline.html'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span className="text-xs font-medium text-purple-400">
              {isDeploying ? t('deployment.deployingStatus') : t('deployment.buildingStatus')}
            </span>
          </div>
        </div>
        <Terminal logs={state.logs} className="border-none rounded-none" />
      </div>
    );
  }

  if (state.deploymentStatus === DeploymentStatus.FAILED) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/60 p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-11 h-11 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                <XCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                {t('deployment.deploymentFailedTitle')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {t('deployment.deploymentFailedDescription')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 font-mono">
                {sourceLabel}
              </p>
            </div>
          </div>
        </div>

        {state.logs.length > 0 && (
          <div className="bg-slate-900 dark:bg-black rounded-xl border border-slate-800 dark:border-slate-900 overflow-hidden shadow">
            <div className="bg-slate-800 dark:bg-slate-950 px-6 py-3 border-b border-slate-700 dark:border-slate-800 flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-slate-200" />
              <span className="text-sm font-medium text-slate-100">
                {t('common.error')} · {finalProjectName || t('deployment.deployYourApp')}
              </span>
            </div>
            <Terminal logs={state.logs} className="border-none rounded-none" />
          </div>
        )}
      </div>
    );
  }

  // When no deployment is active (initial idle state), render nothing.
  return null;
};
