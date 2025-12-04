import React, { useRef, useEffect } from 'react';
import { useDeploymentStore } from '../stores/deploymentStore';
import { usePresenter } from '../contexts/PresenterContext';
import { DeploymentStatus } from '../types';
import { DeploymentSession } from '../components/DeploymentSession';
import { Github, FolderArchive, Upload, FileCode, X, Check, ArrowRight } from 'lucide-react';

export const NewDeployment: React.FC = () => {
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => presenter.deployment.resetWizard();
  }, [presenter.deployment]);

  const handleDeployStart = () => {
    const fallbackName =
      state.projectName ||
      (state.sourceType === 'github'
        ? (state.repoUrl.split('/').filter(Boolean).pop() || 'my-app')
        : state.zipFile?.name.replace(/\.zip$/i, '') || 'my-app');

    presenter.deployment.startBuildSimulation(() => {
      const identifier =
        state.sourceType === 'github'
          ? state.repoUrl
          : state.zipFile?.name || 'archive.zip';
      presenter.project.addProject(
        fallbackName,
        state.sourceType,
        identifier,
      );
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      presenter.deployment.handleFileDrop(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      presenter.deployment.handleFileDrop(e.dataTransfer.files[0]);
    }
  };

  const isIdleOrFailed =
    state.deploymentStatus === DeploymentStatus.IDLE ||
    state.deploymentStatus === DeploymentStatus.FAILED;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      {/* Elegant Header */}
      <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2 tracking-tight">
            Deploy Your App
          </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Deploy your application in seconds. Connect a repository or upload your code.
        </p>
      </div>

      {/* Show deployment session when active or completed; otherwise show the source wizard */}
      {isIdleOrFailed ? (
        /* Source Selection - shown when not building and no URL yet */
        <div className="space-y-6">
          {/* Source Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => state.actions.setSourceType('github')}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                state.sourceType === 'github'
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg transition-colors ${
                    state.sourceType === 'github'
                      ? 'bg-purple-100 dark:bg-purple-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
                  }`}
                >
                  <Github
                    className={`w-6 h-6 ${
                      state.sourceType === 'github'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </div>
                {state.sourceType === 'github' && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                GitHub Repository
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Connect a repository from GitHub
              </p>
            </button>

            <button
              onClick={() => state.actions.setSourceType('zip')}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                state.sourceType === 'zip'
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg transition-colors ${
                    state.sourceType === 'zip'
                      ? 'bg-purple-100 dark:bg-purple-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
                  }`}
                >
                  <FolderArchive
                    className={`w-6 h-6 ${
                      state.sourceType === 'zip'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </div>
                {state.sourceType === 'zip' && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Upload Archive
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Upload a ZIP file from your computer
              </p>
            </button>
          </div>

          {/* Input Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            {state.sourceType === 'github' ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  Repository URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Github className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={state.repoUrl}
                    onChange={(e) => {
                      state.actions.setRepoUrl(e.target.value);
                      presenter.deployment.autoProjectName(e.target.value, 'github');
                    }}
                    placeholder="github.com/username/repository"
                    className="block w-full pl-12 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the full URL of your GitHub repository
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  Upload Archive
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer group ${
                    state.zipFile
                      ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-700 bg-slate-50 dark:bg-slate-800/50'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".zip"
                    onChange={handleFileChange}
                  />
                  {state.zipFile ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                        <FileCode className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {state.zipFile.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {(state.zipFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          state.actions.setZipFile(null);
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-colors">
                        <Upload className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          Drop your ZIP file here, or click to browse
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Maximum file size: 100MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  (state.sourceType === 'github' ? state.repoUrl : state.zipFile) &&
                  handleDeployStart()
                }
                disabled={!(state.sourceType === 'github' ? state.repoUrl : state.zipFile)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 dark:bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                Continue
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
