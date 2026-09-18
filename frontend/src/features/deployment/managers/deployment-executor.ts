import { track } from '@/analytics/collector';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { DeploymentStatus, SourceType } from '@/types';
import type { Project } from '@/types';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project.manager';


/**
 * Handles the actual deployment execution for projects.
 */
export class DeploymentExecutor {
  constructor(
    private provider: IDeploymentProvider,
    private projectManager: ProjectManager,
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
   * Initialize deployment store state.
   */
  private initializeDeploymentStore = (
    project: Project,
    zipFile: File | null,
  ): void => {
    const actions = useDeploymentStore.getState().actions;
    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();
    actions.setProjectName(project.name);
    actions.setRepoUrl(project.repoUrl);
    actions.setSourceType(project.sourceType ?? SourceType.GITHUB);
    actions.setZipFile(zipFile);
  };

  /**
   * Update project status in database (skip for temp projects).
   */
  private updateProjectStatus = async (
    projectId: string,
    status: 'Building' | 'Live' | 'Failed',
    url?: string,
    deploymentFlowId?: string,
  ): Promise<void> => {
    if (projectId === 'temp') return;

    await this.projectManager.updateProjectDeployment(projectId, {
      status,
      ...(url ? { url } : {}),
      ...(deploymentFlowId ? { deploymentFlowId } : {}),
    });
  };

  /**
   * Prepare ZIP file data if needed.
   */
  private prepareZipData = async (
    project: Project,
    zipFile: File | null,
  ): Promise<string | undefined> => {
    if (project.sourceType !== SourceType.ZIP || !zipFile) {
      return undefined;
    }

    try {
      return await this.fileToBase64(zipFile);
    } catch (err) {
      console.error('Failed to read ZIP file', err);
      const actions = useDeploymentStore.getState().actions;
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
      actions.addLog({
        timestamp: new Date().toISOString(),
        message: 'Failed to read ZIP file in browser.',
        type: 'error',
      });
      throw new Error('Failed to read ZIP file');
    }
  };

  /**
   * Validate HTML content if needed.
   */
  private validateHtmlContent = (project: Project): void => {
    if (project.sourceType !== SourceType.HTML) return;

    const inlineHtml = project.htmlContent ?? useDeploymentStore.getState().htmlContent;
    if (!inlineHtml || inlineHtml.trim().length === 0) {
      const actions = useDeploymentStore.getState().actions;
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
      actions.addLog({
        timestamp: new Date().toISOString(),
        message: 'No HTML content provided.',
        type: 'error',
      });
      throw new Error('No HTML content provided');
    }
  };

  /**
   * Build deployment payload with all required data.
   */
  private buildDeploymentPayload = (
    project: Project,
    zipData?: string,
  ): Project => {
    return {
      ...project,
      ...(zipData ? { zipData } : {}),
      ...(project.sourceType === SourceType.HTML
        ? { htmlContent: project.htmlContent ?? useDeploymentStore.getState().htmlContent }
        : {}),
    };
  };

  /**
   * Internal helper to start a deployment job for a given project.
   */
  startDeploymentForProject = async (
    project: Project,
    zipFile: File | null,
  ): Promise<DeploymentResult | undefined> => {
    const flowId = crypto.randomUUID();
    const startedAt = Date.now();
    let deploymentCompleted = false;
    track('deployment_start', { flowId, dimension: project.sourceType?.toLowerCase() });
    // Initialize UI state
    this.initializeDeploymentStore(project, zipFile);

    // Update project status to Building
    await this.updateProjectStatus(project.id, 'Building', undefined, flowId);

    try {
      // Validate and prepare data
      this.validateHtmlContent(project);
      const zipData = await this.prepareZipData(project, zipFile);
      const payload = this.buildDeploymentPayload(project, zipData);

      // Execute deployment
      const actions = useDeploymentStore.getState().actions;
      const result = await this.provider.startDeployment(
        payload,
        (log) => actions.addLog(log),
        (status) => actions.setDeploymentStatus(status),
        {
          flowId,
          clientChannel: 'web',
          ...(zipFile?.name ? { sourceFilename: zipFile.name } : {}),
        },
      );

      // Update project status to Live
      deploymentCompleted = true;
      track('deployment_success', { flowId, durationMs: Date.now() - startedAt });
      await this.updateProjectStatus(project.id, 'Live', result?.metadata?.url, flowId);
      return result;
    } catch (e) {
      if (!deploymentCompleted) track('deployment_failure', { flowId, durationMs: Date.now() - startedAt });
      console.error('Deployment failed', e);
      const actions = useDeploymentStore.getState().actions;
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
      await this.updateProjectStatus(project.id, 'Failed', undefined, flowId);
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
