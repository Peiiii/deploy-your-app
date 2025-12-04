import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeploymentStore } from '../stores/deploymentStore';
import { useProjectStore } from '../stores/projectStore';
import { usePresenter } from '../contexts/PresenterContext';
import { DeploymentStatus } from '../types';
import { Terminal } from './Terminal';
import {
  CheckCircle2,
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
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const projects = useProjectStore((s) => s.projects);
  const navigate = useNavigate();
  const [showBuildLog, setShowBuildLog] = useState(false);

  const isDeploying = state.deploymentStatus === DeploymentStatus.DEPLOYING;
  const isInProgress =
    state.deploymentStatus === DeploymentStatus.BUILDING || isDeploying;

  // Resolve deployment URL either from explicit override or from the project list.
  const deploymentUrl = useMemo(() => {
    if (projectUrlOverride) return projectUrlOverride;
    // Prefer matching by source identifier so that it still works even if
    // the backend AI renames the project to a nicer display name.
    const project = projects.find((p) => {
      if (state.sourceType === 'github') {
        return p.repoUrl === state.repoUrl;
      }
      if (state.sourceType === 'zip') {
        const identifier = state.zipFile?.name || 'archive.zip';
        return p.repoUrl === identifier;
      }
      return p.name === state.projectName;
    });
    return project?.url;
  }, [
    projectUrlOverride,
    projects,
    state.projectName,
    state.repoUrl,
    state.sourceType,
    state.zipFile,
  ]);

  // Whenever a deployment succeeds, refresh projects so that URLs / metadata stay in sync.
  useEffect(() => {
    if (state.deploymentStatus === DeploymentStatus.SUCCESS) {
      presenter.project.loadProjects();
    }
  }, [state.deploymentStatus, presenter.project]);

  if (state.deploymentStatus === DeploymentStatus.SUCCESS) {
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
                Deployment successful!
              </h3>
              <div className="space-y-4">
                <div>
                  {deploymentUrl ? (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Your application is now live at:
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
                      Deployment finished, preparing the public URL...
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
                    {deploymentUrl ? 'Open Site' : 'Preparing URL...'}
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    View Dashboard
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
                  Build Log
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({state.logs.length} entries)
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
                          Build Log: {state.projectName}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {state.sourceType === 'github'
                            ? state.repoUrl
                            : state.zipFile?.name}
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
                {isDeploying ? 'Deploying' : 'Building'} {state.projectName}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {state.sourceType === 'github'
                  ? state.repoUrl
                  : state.zipFile?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            <span className="text-xs font-medium text-purple-400">
              {isDeploying ? 'Deploying...' : 'Building...'}
            </span>
          </div>
        </div>
        <Terminal logs={state.logs} className="border-none rounded-none" />
      </div>
    );
  }

  // When no deployment is active, render nothing.
  return null;
};
