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
   * Initialize deployment store state.
   */
  private initializeDeploymentStore = (
    project: Project,
    zipFile: File | null,
  ): void => {
    const actions = useDeploymentStore.getState().actions;
    actions.setActiveProjectId(project.id);
    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();
    actions.setProjectName(project.name);
    actions.setRepoUrl(project.repoUrl);
    actions.setSourceType(project.sourceType ?? SourceType.GITHUB);
    actions.setZipFile(zipFile);
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


    try {
      // Validate and prepare data
      this.validateHtmlContent(project);
      const payload = {
        ...project,
        ...(project.sourceType === SourceType.HTML ? { htmlContent: project.htmlContent ?? useDeploymentStore.getState().htmlContent } : {}),
      };

      // Execute deployment
      const actions = useDeploymentStore.getState().actions;
      const result = await this.provider.startDeployment(
        payload,
        (log) => actions.addLog(log),
        (status) => actions.setDeploymentStatus(status),
        {
          flowId,
          clientChannel: 'web',
          ...(zipFile ? { sourceFilename: zipFile.name, zipFile } : {}),
        },
      );

      if (!result?.metadata?.url) throw new Error('Deployment did not return a confirmed URL.');
      // The service owns persisted status; refresh its confirmed result.
      deploymentCompleted = true;
      track('deployment_success', { flowId, durationMs: Date.now() - startedAt });
      await this.projectManager.loadProjects().catch(() => {});
      return result;
    } catch (e) {
      if ((e as Error)?.name === 'DeploymentPendingError') {
        useDeploymentStore.getState().actions.addLog({ timestamp: new Date().toISOString(), message: (e as Error).message, type: 'warning' });
        throw e;
      }
      if (!deploymentCompleted) track('deployment_failure', { flowId, durationMs: Date.now() - startedAt });
      console.error('Deployment failed', e);
      const actions = useDeploymentStore.getState().actions;
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
      if (e instanceof Error) actions.addLog({ timestamp: new Date().toISOString(), message: e.message, type: 'error' });
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
