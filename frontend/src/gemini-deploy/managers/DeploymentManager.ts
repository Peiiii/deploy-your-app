import { useDeploymentStore } from '../stores/deploymentStore';
import { DeploymentStatus, SourceType } from '../types';
import type { Project, DeploymentMetadata } from '../types';
import type {
  DeploymentResult,
  IDeploymentProvider,
} from '../services/interfaces';
import type { ProjectManager } from './ProjectManager';
import type { UIManager } from './UIManager';
import i18n from '../../i18n/config';

type DeploymentStoreSnapshot = ReturnType<typeof useDeploymentStore.getState>;

export class DeploymentManager {
  private provider: IDeploymentProvider;
  private projectManager: ProjectManager;
  private uiManager: UIManager;

  constructor(
    provider: IDeploymentProvider,
    projectManager: ProjectManager,
    uiManager: UIManager,
  ) {
    this.provider = provider;
    this.projectManager = projectManager;
    this.uiManager = uiManager;
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
      reader.onerror = () =>
        reject(reader.error || new Error('Failed to read file'));
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
          message:
            'No HTML content provided. Please enter or upload HTML before deploying.',
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

  /**
   * Derive a reasonable default project name from the current wizard state.
   */
  private getFallbackNameFromState = (state: DeploymentStoreSnapshot): string => {
    if (state.projectName) {
      return state.projectName;
    }
    if (state.sourceType === SourceType.GITHUB) {
      return state.repoUrl.split('/').filter(Boolean).pop() || 'my-app';
    }
    if (state.sourceType === SourceType.ZIP) {
      return state.zipFile?.name.replace(/\.zip$/i, '') || 'my-app';
    }
    return 'my-html-app';
  };

  private handleGithubWizard = async (
    state: DeploymentStoreSnapshot,
    fallbackName: string,
  ): Promise<void> => {
    const trimmedRepo = state.repoUrl.trim();
    if (!trimmedRepo) {
      return;
    }

    // 1) Check whether the current user already has a project for this repo.
    try {
      const existing =
        await this.projectManager.findExistingProjectForRepo(trimmedRepo);
      if (existing) {
        const t = i18n.t.bind(i18n);
        const primaryChosen = await this.uiManager.showConfirm({
          title: t('deployment.repoDuplicateTitle'),
          message: t('deployment.repoDuplicateMessage', {
            name: existing.name,
          }),
          primaryLabel: t('deployment.repoDuplicateRedeploy'),
          secondaryLabel: t('deployment.repoDuplicateCreateNew'),
        });

        if (primaryChosen) {
          await this.redeployProject(existing);
          return;
        }
        // User explicitly chose "create new project" – fall through to the
        // analysis + create + deploy flow below.
      }
    } catch (err) {
      console.error(
        'Failed to check for existing project before deployment',
        err,
      );
    }

    // 2) Analyze the repository to generate metadata (name, slug, tags)
    //    from the actual source code, then create a project with a globally
    //    unique slug, and finally deploy that project.
    const store = useDeploymentStore.getState();
    const actions = store.actions;
    const t = i18n.t.bind(i18n);

    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.ANALYZING);
    actions.clearLogs();
    actions.setProjectName(fallbackName);
    actions.setRepoUrl(trimmedRepo);
    actions.setSourceType(SourceType.GITHUB);
    actions.addLog({
      timestamp: new Date().toISOString(),
      message: t('deployment.analyzingRepository'),
      type: 'info',
    });

    try {
      const tempProject: Project = {
        id: 'temp',
        name: fallbackName,
        repoUrl: trimmedRepo,
        sourceType: SourceType.GITHUB,
        lastDeployed: '',
        status: 'Building',
        framework: 'Unknown',
      };

      const analysisResult = await this.analyzeProject(tempProject);

      const metadataOverrides = analysisResult.metadata
        ? {
            name: analysisResult.metadata.name,
            slug: analysisResult.metadata.slug,
            description: analysisResult.metadata.description,
            category: analysisResult.metadata.category,
            tags: analysisResult.metadata.tags,
          }
        : undefined;

      const finalName = analysisResult.metadata?.name ?? fallbackName;

      const createdProject = await this.projectManager.addProject(
        finalName,
        state.sourceType,
        trimmedRepo,
        metadataOverrides ? { metadata: metadataOverrides } : undefined,
      );

      if (!createdProject) {
        return;
      }

      const projectForDeploy: Project = {
        ...createdProject,
        ...(analysisResult.analysisId
          ? { analysisId: analysisResult.analysisId }
          : {}),
      };

      await this.redeployProject(projectForDeploy);
    } catch (err) {
      console.error('Failed to analyze and deploy project', err);
      const tLocal = i18n.t.bind(i18n);
      const actionsLocal = useDeploymentStore.getState().actions;
      actionsLocal.addLog({
        timestamp: new Date().toISOString(),
        message: tLocal('deployment.analysisFailedFallback'),
        type: 'warning',
      });

      // Fallback: create a project without AI-enriched metadata and run a
      // normal deployment so that users can still deploy even when the
      // analysis step cannot download the repository ZIP (e.g. non-main
      // default branch, network hiccups).
      try {
        const fallbackProject = await this.projectManager.addProject(
          fallbackName,
          state.sourceType,
          trimmedRepo,
        );
        if (!fallbackProject) {
          return;
        }
        await this.redeployProject(fallbackProject);
      } catch (deployErr) {
        console.error(
          'Fallback create-and-deploy flow also failed',
          deployErr,
        );
      }
    }
  };

  private handleZipWizard = async (
    state: DeploymentStoreSnapshot,
    fallbackName: string,
  ): Promise<void> => {
    try {
      const identifier = state.zipFile?.name || 'archive.zip';
      const newProject = await this.projectManager.addProject(
        fallbackName,
        state.sourceType,
        identifier,
      );
      if (!newProject) {
        return;
      }
      await this.redeployProject(newProject, {
        zipFile: state.zipFile,
      });
    } catch (err) {
      console.error('Failed to create and deploy project from ZIP', err);
    }
  };

  private handleHtmlWizard = async (
    state: DeploymentStoreSnapshot,
    fallbackName: string,
  ): Promise<void> => {
    if (!state.htmlContent.trim()) {
      return;
    }
    try {
      const newProject = await this.projectManager.addProject(
        fallbackName,
        state.sourceType,
        'inline.html',
        { htmlContent: state.htmlContent },
      );
      if (!newProject) {
        return;
      }
      await this.redeployProject(newProject);
    } catch (err) {
      console.error('Failed to create and deploy project from HTML', err);
    }
  };

  /**
   * Entry point for the "New Deployment" wizard. This method reads the
   * current deploymentStore state (source type, repo URL, ZIP/HTML content)
   * and orchestrates the full flow by delegating to source-type specific
   * handlers.
   */
  startFromWizard = async (): Promise<void> => {
    const state = useDeploymentStore.getState();
    const fallbackName = this.getFallbackNameFromState(state);

    if (state.sourceType === SourceType.GITHUB) {
      await this.handleGithubWizard(state, fallbackName);
      return;
    }

    if (state.sourceType === SourceType.ZIP) {
      await this.handleZipWizard(state, fallbackName);
      return;
    }

    if (state.sourceType === SourceType.HTML) {
      await this.handleHtmlWizard(state, fallbackName);
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
      // Keep this simple; UI validation happens before calling this in most flows.
      // We still show a basic alert to avoid completely silent failures.
      // (If needed we can route this through uiManager.showToast later.)
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
      if (baseName)
        useDeploymentStore.getState().actions.setProjectName(baseName);
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
