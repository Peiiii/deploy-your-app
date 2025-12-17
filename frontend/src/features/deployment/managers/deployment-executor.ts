import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { DeploymentStatus, SourceType } from '@/types';
import type { Project } from '@/types';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';
import type { ProjectCreator } from './project-creator';


/**
 * Handles the actual deployment execution for projects.
 */
export class DeploymentExecutor {
  constructor(
    private provider: IDeploymentProvider,
    private projectManager: ProjectManager,
    _uiManager: UIManager,
    _projectCreator: ProjectCreator,
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
   * Deploy a project (handles the actual deployment execution).
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
}
