import { useDeploymentStore } from '../stores/deploymentStore';
import { DeploymentStatus, SourceType } from '../types';
import type { Project, DeploymentMetadata } from '../types';
import type {
  DeploymentResult,
  IDeploymentProvider,
} from '../services/interfaces';

export class DeploymentManager {
  private provider: IDeploymentProvider;

  constructor(provider: IDeploymentProvider) {
    this.provider = provider;
  }

  // Read a File as base64 (without the data: URL prefix).
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const commaIndex = result.indexOf(',');
          // If this is a data URL, strip the prefix and keep only the base64 payload.
          resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        } else {
          reject(new Error('Unexpected FileReader result type'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Internal helper to start a deployment job for a given project.
   * This is used both for the initial "Magic Box" flow and for
   * redeploying an existing project from the dashboard/project page.
   */
  private startDeploymentForProject = async (
    project: Project,
    zipFile: File | null,
  ): Promise<DeploymentResult | undefined> => {
    const store = useDeploymentStore.getState();
    const actions = store.actions;

    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();
    actions.setProjectName(project.name);
    actions.setRepoUrl(project.repoUrl);
    actions.setSourceType(project.sourceType ?? SourceType.GITHUB);
    actions.setZipFile(zipFile);

    let zipData: string | undefined;
    if (project.sourceType === SourceType.ZIP && zipFile) {
      try {
        zipData = await this.fileToBase64(zipFile);
      } catch (err) {
        console.error('Failed to read ZIP file', err);
        actions.setDeploymentStatus(DeploymentStatus.FAILED);
        actions.addLog({
          timestamp: new Date().toISOString(),
          message: 'Failed to read ZIP file in browser.',
          type: 'error',
        });
        return undefined;
      }
    }

    if (project.sourceType === SourceType.HTML) {
      const inlineHtml =
        project.htmlContent ?? useDeploymentStore.getState().htmlContent;
      if (!inlineHtml || inlineHtml.trim().length === 0) {
        actions.setDeploymentStatus(DeploymentStatus.FAILED);
        actions.addLog({
          timestamp: new Date().toISOString(),
          message: 'No HTML content provided. Please enter or upload HTML before deploying.',
          type: 'error',
        });
        return;
      }
    }

    const payload: Project = {
      ...project,
      // For one-off ZIP uploads we send the content inline; the backend
      // will prefer zipData over repoUrl when materializing the source.
      ...(zipData ? { zipData } : {}),
      ...(project.sourceType === SourceType.HTML
        ? {
            htmlContent:
              project.htmlContent ?? useDeploymentStore.getState().htmlContent,
          }
        : {}),
    };

    try {
      const result = await this.provider.startDeployment(
        payload,
        (log) => actions.addLog(log),
        (status) => actions.setDeploymentStatus(status),
      );
      if (result?.metadata?.name) {
        actions.setProjectName(result.metadata.name);
      }
      return result;
    } catch (e) {
      console.error('Deployment failed', e);
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
      throw e;
    }
  };

  /**
   * Public entrypoint for redeploying an existing project (from Dashboard / ProjectSettings).
   * It reuses the same SSE-based deployment pipeline as the initial Magic Box flow so
   * that the UI (logs, status transitions) stays consistent.
   */
  redeployProject = async (
    project: Project,
    options?: {
      zipFile?: File | null;
      onComplete?: (result?: DeploymentResult) => void;
    },
  ): Promise<void> => {
    const zipFile = options?.zipFile ?? null;
    const result = await this.startDeploymentForProject(project, zipFile);
    if (options?.onComplete) {
      options.onComplete(result);
    }
  };

  /**
   * Run a lightweight pre-deployment analysis for the given project. This
   * calls the /analyze endpoint via the HTTP deployment provider so that
   * the backend can inspect the source (for GitHub repos) and propose
   * richer metadata.
   */
  analyzeProject = async (
    project: Project,
  ): Promise<{ analysisId?: string; metadata?: DeploymentMetadata }> => {
    try {
      const result = await this.provider.analyzeSource(project);
      return result;
    } catch (err) {
      console.error('Project analysis failed', err);
      throw err;
    }
  };

  startDeploymentRun = async (): Promise<DeploymentResult | undefined> => {
    const store = useDeploymentStore.getState();

    const fallbackName =
      store.projectName ||
      (store.sourceType === SourceType.GITHUB
        ? (store.repoUrl.split('/').filter(Boolean).pop() || 'my-app')
        : store.sourceType === SourceType.ZIP
          ? store.zipFile?.name.replace(/\.zip$/i, '') || 'my-app'
          : store.projectName || 'my-html-app');

    const tempProject: Project = {
      id: 'temp',
      name: fallbackName,
      repoUrl:
        store.sourceType === SourceType.GITHUB
          ? store.repoUrl
          : store.sourceType === SourceType.ZIP
            ? store.zipFile?.name || 'archive.zip'
            : 'inline.html',
      sourceType: store.sourceType,
      lastDeployed: '',
      status: 'Building',
      framework: 'Unknown',
      ...(store.sourceType === SourceType.HTML
        ? {
            htmlContent: store.htmlContent,
          }
        : {}),
    };

    return this.startDeploymentForProject(
      tempProject,
      store.sourceType === SourceType.ZIP ? store.zipFile : null,
    );
  };

  resetWizard = () => {
    useDeploymentStore.getState().actions.reset();
  };

  handleSourceChange = (type: SourceType) => {
    useDeploymentStore.getState().actions.setSourceType(type);
  };

  handleFileDrop = (file: File) => {
    if (file.name.endsWith('.zip')) {
      const actions = useDeploymentStore.getState().actions;
      actions.setZipFile(file);
      // Auto-generate a project name from the ZIP filename if none is set yet.
      const currentName = useDeploymentStore.getState().projectName;
      if (!currentName) {
        const baseName = file.name.replace(/\.zip$/i, '');
        if (baseName) {
          actions.setProjectName(baseName);
        }
      }
    } else {
      alert('Please upload a .zip file');
    }
  };

  handleHtmlFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.html')) {
      alert('Please upload an .html file');
      return;
    }
    try {
      const text = await file.text();
      const actions = useDeploymentStore.getState().actions;
      actions.setHtmlContent(text);
      const currentName = useDeploymentStore.getState().projectName;
      if (!currentName) {
        const baseName = file.name.replace(/\.html$/i, '');
        if (baseName) {
          actions.setProjectName(baseName);
        }
      }
    } catch (err) {
      console.error('Failed to read HTML file', err);
      alert('Failed to read HTML file. Please try again.');
    }
  };

  autoProjectName = (val: string, type: SourceType) => {
    if (type === SourceType.GITHUB) {
      const parts = val.split('/');
      const name = parts[parts.length - 1]?.replace('.git', '') || '';
      if (name) useDeploymentStore.getState().actions.setProjectName(name);
    } else if (type === SourceType.ZIP) {
      const baseName = val.replace(/\.zip$/i, '');
      if (baseName) useDeploymentStore.getState().actions.setProjectName(baseName);
    }
  };

  setRepoUrl = (url: string): void => {
    useDeploymentStore.getState().actions.setRepoUrl(url);
  };

  setHtmlContent = (html: string): void => {
    useDeploymentStore.getState().actions.setHtmlContent(html);
  };

  setProjectName = (name: string): void => {
    useDeploymentStore.getState().actions.setProjectName(name);
  };

  clearZipFile = (): void => {
    useDeploymentStore.getState().actions.setZipFile(null);
  };
}
