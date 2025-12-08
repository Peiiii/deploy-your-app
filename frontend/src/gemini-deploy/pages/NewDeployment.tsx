import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDeploymentStore } from '../stores/deploymentStore';
import { usePresenter } from '../contexts/PresenterContext';
import { DeploymentStatus, SourceType } from '../types';
import { DeploymentSession } from '../components/DeploymentSession';
import { Github, FolderArchive, Upload, FileCode, X, Check, ArrowRight } from 'lucide-react';

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
  const presenter = usePresenter();
  const state = useDeploymentStore();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);
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
    const fallbackName =
      state.projectName ||
      (state.sourceType === SourceType.GITHUB
        ? (state.repoUrl.split('/').filter(Boolean).pop() || 'my-app')
        : state.sourceType === SourceType.ZIP
          ? state.zipFile?.name.replace(/\.zip$/i, '') || 'my-app'
          : 'my-html-app');

    try {
      const result = await presenter.deployment.startDeploymentRun();
      const identifier =
        state.sourceType === SourceType.GITHUB
          ? state.repoUrl
          : state.sourceType === SourceType.ZIP
            ? state.zipFile?.name || 'archive.zip'
            : 'inline.html';
      const finalName = result?.metadata?.name ?? fallbackName;
      const metadataOverrides = result?.metadata
        ? {
            name: result.metadata.name,
            slug: result.metadata.slug,
            description: result.metadata.description,
            category: result.metadata.category,
            tags: result.metadata.tags,
          }
        : undefined;
      const requestOptions =
        state.sourceType === SourceType.HTML
          ? {
              htmlContent: state.htmlContent,
              ...(metadataOverrides ? { metadata: metadataOverrides } : {}),
            }
          : metadataOverrides
            ? { metadata: metadataOverrides }
            : undefined;

      await presenter.project.addProject(
        finalName,
        state.sourceType,
        identifier,
        requestOptions,
      );
    } catch (err) {
      console.error('Failed to finalize deployment metadata', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      presenter.deployment.handleFileDrop(e.target.files[0]);
    }
  };

  const handleHtmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await presenter.deployment.handleHtmlFileUpload(file);
    setHtmlFieldTouched(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      presenter.deployment.handleFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleInsertTemplate = () => {
    presenter.deployment.setHtmlContent(SIMPLE_HTML_TEMPLATE);
    setHtmlFieldTouched(true);
    if (!state.projectName) {
      presenter.deployment.setProjectName('landing-page');
    }
  };

  const isIdleOrFailed =
    state.deploymentStatus === DeploymentStatus.IDLE ||
    state.deploymentStatus === DeploymentStatus.FAILED;

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSourceTypeSelect(SourceType.GITHUB)}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                state.sourceType === SourceType.GITHUB
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg transition-colors ${
                    state.sourceType === SourceType.GITHUB
                      ? 'bg-purple-100 dark:bg-purple-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
                  }`}
                >
                  <Github
                    className={`w-6 h-6 ${
                      state.sourceType === SourceType.GITHUB
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </div>
                {state.sourceType === SourceType.GITHUB && (
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
              onClick={() => handleSourceTypeSelect(SourceType.ZIP)}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                state.sourceType === SourceType.ZIP
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg transition-colors ${
                    state.sourceType === SourceType.ZIP
                      ? 'bg-purple-100 dark:bg-purple-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
                  }`}
                >
                  <FolderArchive
                    className={`w-6 h-6 ${
                      state.sourceType === SourceType.ZIP
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </div>
                {state.sourceType === SourceType.ZIP && (
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
            <button
              onClick={() => handleSourceTypeSelect(SourceType.HTML)}
              className={`group relative p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg ${
                state.sourceType === SourceType.HTML
                  ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-3 rounded-lg transition-colors ${
                    state.sourceType === SourceType.HTML
                      ? 'bg-purple-100 dark:bg-purple-900/40'
                      : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
                  }`}
                >
                  <FileCode
                    className={`w-6 h-6 ${
                      state.sourceType === SourceType.HTML
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  />
                </div>
                {state.sourceType === SourceType.HTML && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Inline HTML
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Paste or upload a single HTML file to deploy instantly
              </p>
            </button>
          </div>

          {/* Input Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            {state.sourceType === SourceType.GITHUB ? (
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
                      presenter.deployment.setRepoUrl(e.target.value);
                      presenter.deployment.autoProjectName(
                        e.target.value,
                        SourceType.GITHUB,
                      );
                    }}
                    placeholder="github.com/username/repository"
                    className="block w-full pl-12 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the full URL of your GitHub repository
                </p>
              </div>
            ) : state.sourceType === SourceType.ZIP ? (
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
                          presenter.deployment.clearZipFile();
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
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-900 dark:text-white">
                  HTML Content
                </label>
                <textarea
                  value={state.htmlContent}
                  onChange={(e) =>
                    presenter.deployment.setHtmlContent(e.target.value)
                  }
                  onBlur={() => setHtmlFieldTouched(true)}
                  rows={10}
                  className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all font-mono text-sm"
                  placeholder="Paste your HTML markup here..."
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleInsertTemplate}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50"
                  >
                    <FileCode className="w-3 h-3" />
                    Insert sample template
                  </button>
                  <button
                    type="button"
                    onClick={() => htmlFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <Upload className="w-3 h-3" />
                    Import .html file
                  </button>
                  <input
                    ref={htmlFileInputRef}
                    type="file"
                    accept=".html,text/html"
                    className="hidden"
                    onChange={handleHtmlFileChange}
                  />
                </div>
                {htmlFieldTouched && !htmlIsReady && (
                  <p className="text-xs text-red-500">
                    Please paste HTML content or import a file to continue.
                  </p>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => canContinue && handleDeployStart()}
                disabled={!canContinue}
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
