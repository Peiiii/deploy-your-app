import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { DeploymentStatus, SourceType } from '@/types';
import type { Project } from '@/types';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';
import type { ProjectCreator } from './project-creator';
import i18n from '@/i18n/config';

type DeploymentStoreSnapshot = ReturnType<typeof useDeploymentStore.getState>;

/**
 * Executes deployment wizard flows and handles the actual deployment process.
 */
export class WizardExecutor {
  constructor(
    private provider: IDeploymentProvider,
    private projectManager: ProjectManager,
    private uiManager: UIManager,
    private projectCreator: ProjectCreator,
  ) { }

  /**
   * Read a File as base64 (without the data: URL prefix).
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const commaIndex = result.indexOf(',');
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
   */
  startDeploymentForProject = async (
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

    const deploymentStartedAt = new Date().toISOString();
    if (project.id !== 'temp') {
      await this.projectManager.updateProjectDeployment(project.id, {
        status: 'Building',
        lastDeployed: deploymentStartedAt,
      });
    }

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
      const inlineHtml = project.htmlContent ?? useDeploymentStore.getState().htmlContent;
      if (!inlineHtml || inlineHtml.trim().length === 0) {
        actions.setDeploymentStatus(DeploymentStatus.FAILED);
        actions.addLog({
          timestamp: new Date().toISOString(),
          message: 'No HTML content provided.',
          type: 'error',
        });
        return;
      }
    }

    const payload: Project = {
      ...project,
      ...(zipData ? { zipData } : {}),
      ...(project.sourceType === SourceType.HTML
        ? { htmlContent: project.htmlContent ?? useDeploymentStore.getState().htmlContent }
        : {}),
    };

    try {
      const result = await this.provider.startDeployment(
        payload,
        (log) => actions.addLog(log),
        (status) => actions.setDeploymentStatus(status),
      );

      if (project.id !== 'temp') {
        await this.projectManager.updateProjectDeployment(project.id, {
          status: 'Live',
          lastDeployed: new Date().toISOString(),
          ...(result?.metadata?.url ? { url: result.metadata.url } : {}),
        });
      }
      return result;
    } catch (e) {
      console.error('Deployment failed', e);
      actions.setDeploymentStatus(DeploymentStatus.FAILED);

      if (project.id !== 'temp') {
        await this.projectManager.updateProjectDeployment(project.id, {
          status: 'Failed',
          lastDeployed: new Date().toISOString(),
        });
      }
      throw e;
    }
  };

  /**
   * Public entrypoint for deploying a project.
   */
  deployProject = async (
    project: Project,
    options?: { zipFile?: File | null; onComplete?: (result?: DeploymentResult) => void },
  ): Promise<void> => {
    const zipFile = options?.zipFile ?? null;
    const result = await this.startDeploymentForProject(project, zipFile);
    if (options?.onComplete) {
      options.onComplete(result);
    }
  };

  /**
   * Entry point for the "New Deployment" wizard.
   */
  startFromWizard = async (): Promise<void> => {
    const state = useDeploymentStore.getState();
    const fallbackName = this.projectCreator.getFallbackNameFromState(state);

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

  private handleGithubWizard = async (
    state: DeploymentStoreSnapshot,
    fallbackName: string,
  ): Promise<void> => {
    const trimmedRepo = state.repoUrl.trim();
    if (!trimmedRepo) {
      const t = i18n.t.bind(i18n);
      this.uiManager.showErrorToast(t('deployment.repoUrlRequired'));
      return;
    }

    try {
      const existing = await this.projectManager.findExistingProjectForRepo(trimmedRepo);
      if (existing) {
        const t = i18n.t.bind(i18n);
        const primaryChosen = await this.uiManager.showConfirm({
          title: t('deployment.repoDuplicateTitle'),
          message: t('deployment.repoDuplicateMessage', { name: existing.name }),
          primaryLabel: t('deployment.repoDuplicateRedeploy'),
          secondaryLabel: t('deployment.repoDuplicateCreateNew'),
        });

        if (primaryChosen) {
          await this.deployProject(existing);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to check for existing project', err);
    }

    const actions = useDeploymentStore.getState().actions;
    const t = i18n.t.bind(i18n);

    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();
    actions.setProjectName(fallbackName);
    actions.setRepoUrl(trimmedRepo);
    actions.setSourceType(SourceType.GITHUB);
    actions.addLog({
      timestamp: new Date().toISOString(),
      message: t('deployment.startingDeployment'),
      type: 'info',
    });

    try {
      const createdProject = await this.projectManager.addProject(
        fallbackName,
        state.sourceType,
        trimmedRepo,
      );

      if (!createdProject) return;

      await this.deployProject(createdProject);
    } catch (err) {
      console.error('Failed to deploy project', err);
      const actionsLocal = useDeploymentStore.getState().actions;
      actionsLocal.addLog({
        timestamp: new Date().toISOString(),
        message: i18n.t('deployment.projectCreateFailed'),
        type: 'warning',
      });

      console.error('Deployment failed', err);
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
      if (!newProject) return;
      await this.deployProject(newProject, { zipFile: state.zipFile });
    } catch (err) {
      console.error('Failed to create and deploy project from ZIP', err);
    }
  };

  private handleHtmlWizard = async (
    state: DeploymentStoreSnapshot,
    fallbackName: string,
  ): Promise<void> => {
    if (!state.htmlContent.trim()) return;
    try {
      const newProject = await this.projectManager.addProject(
        fallbackName,
        state.sourceType,
        'inline.html',
        { htmlContent: state.htmlContent },
      );
      if (!newProject) return;
      await this.deployProject(newProject);
    } catch (err) {
      console.error('Failed to create and deploy project from HTML', err);
    }
  };

  /**
   * Start a deployment run for a temporary project (used in project-first flow).
   */
  startDeploymentRun = async (): Promise<DeploymentResult | undefined> => {
    const store = useDeploymentStore.getState();
    const fallbackName = this.projectCreator.getFallbackNameFromState(store);

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
      ...(store.sourceType === SourceType.HTML ? { htmlContent: store.htmlContent } : {}),
    };

    return this.startDeploymentForProject(
      tempProject,
      store.sourceType === SourceType.ZIP ? store.zipFile : null,
    );
  };
}
