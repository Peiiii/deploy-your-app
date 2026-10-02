import type { DeploymentResult, IDeploymentProvider } from '../interfaces';
import type { Project, BuildLog, DeploymentMetadata } from '../../types';
import { DeploymentStatus } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';
import i18n from '@/i18n/config';

type StatusPayload = {
  type?: string;
  status?: string;
  message?: string;
  level?: BuildLog['type'];
  errorMessage?: string;
  errorCode?: string;
  projectMetadata?: DeploymentMetadata;
};

export class HttpDeploymentProvider implements IDeploymentProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  private async responseJson<T>(response: Response): Promise<T> {
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok)
      throw new Error(
        data.error || i18n.t('deployment.requestFailed', { status: response.status })
      );
    return data;
  }

  async startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void,
    context: {
      flowId: string;
      clientChannel: NonNullable<Project['clientChannel']>;
      sourceFilename?: string;
      zipFile?: File;
    }
  ): Promise<DeploymentResult> {
    const log = (message: string, type: BuildLog['type'] = 'info') =>
      onLog({ timestamp: new Date().toISOString(), message, type });
    let zipSourceKey: string | undefined;
    if (context.zipFile) {
      if (context.zipFile.size > 75 * 1024 * 1024)
        throw new Error(i18n.t('deployment.zipTooLarge'));
      log(i18n.t('deployment.uploadingZip'));
      const uploaded = await this.responseJson<{ zipSourceKey: string }>(
        await fetch(
          `${this.baseUrl}/projects/${encodeURIComponent(project.id)}/deployment-source`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/zip', 'X-Gemigo-Flow-Id': context.flowId },
            body: context.zipFile,
          }
        )
      );
      zipSourceKey = uploaded.zipSourceKey;
      log(i18n.t('deployment.zipUploaded'));
    }
    const startBody = JSON.stringify({
      ...project,
      ...(zipSourceKey ? { zipSourceKey } : {}),
      deploymentFlowId: context.flowId,
      clientChannel: context.clientChannel,
      sourceFilename: context.sourceFilename,
    });
    let started: { deploymentId?: string } | undefined;
    for (let retry = 0; retry < 3; retry++) {
      let response: Response | undefined;
      try {
        response = await fetch(`${this.baseUrl}${API_ROUTES.DEPLOY}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Gemigo-Flow-Id': context.flowId },
          body: startBody,
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        /* The request may have been accepted; retry the same flow. */
      }
      if (response && response.status < 500) {
        started = await this.responseJson<{ deploymentId?: string }>(response);
        if (started.deploymentId) break;
      }
      if (retry < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!started?.deploymentId) {
      const error = new Error(i18n.t('deployment.resultPending'));
      error.name = 'DeploymentPendingError';
      throw error;
    }

    return new Promise<DeploymentResult>((resolve, reject) => {
      const id = encodeURIComponent(started!.deploymentId!);
      const eventSource = new EventSource(`${this.baseUrl}/deployments/${id}/stream`, {
        withCredentials: true,
      });
      let settled = false;
      let recovering = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = Date.now() + 10 * 60 * 1000;
      const finish = (payload: StatusPayload): boolean => {
        if (settled) return true;
        if (payload.type === 'log' && payload.message)
          log(payload.message, payload.level ?? 'info');
        if (payload.status === 'SUCCESS') {
          if (!payload.projectMetadata?.url) {
            void recover();
            return false;
          }
          settled = true;
          eventSource.close();
          clearTimeout(timer);
          onStatusChange(DeploymentStatus.SUCCESS);
          resolve({ metadata: payload.projectMetadata });
          return true;
        }
        if (payload.status === 'FAILED') {
          settled = true;
          eventSource.close();
          clearTimeout(timer);
          const message = payload.errorCode
            ? i18n.t(`deployment.errors.${payload.errorCode}`, {
                defaultValue:
                  payload.errorMessage || i18n.t('deployment.requestFailed', { status: 'build' }),
              })
            : payload.errorMessage || i18n.t('deployment.requestFailed', { status: 'build' });
          log(message, 'error');
          onStatusChange(DeploymentStatus.FAILED);
          reject(new Error(message));
          return true;
        }
        if (payload.status)
          onStatusChange(
            payload.status === 'DEPLOYING' ? DeploymentStatus.DEPLOYING : DeploymentStatus.BUILDING
          );
        return false;
      };
      const poll = async () => {
        if (settled) return;
        if (Date.now() > deadline) {
          settled = true;
          eventSource.close();
          const error = new Error(i18n.t('deployment.resultPending'));
          error.name = 'DeploymentPendingError';
          log(error.message, 'warning');
          reject(error);
          return;
        }
        try {
          const response = await fetch(`${this.baseUrl}/deployments/${id}/reconcile`, {
            method: 'POST',
            credentials: 'include',
            signal: AbortSignal.timeout(10000),
          });
          if (response.status === 401 || response.status === 403) {
            settled = true;
            eventSource.close();
            const error = new Error(i18n.t('deployment.resultPending'));
            error.name = 'DeploymentPendingError';
            reject(error);
            return;
          }
          if (finish(await this.responseJson<StatusPayload>(response))) return;
        } catch {
          /* A transport failure is not a failed deployment. */
        }
        if (!settled)
          timer = setTimeout(() => {
            void poll();
          }, 3000);
      };
      const recover = async () => {
        if (recovering || settled) return;
        recovering = true;
        eventSource.close();
        clearTimeout(timer);
        log(i18n.t('deployment.recoveringConnection'), 'warning');
        await poll();
      };
      eventSource.onmessage = (event) => {
        let payload: StatusPayload;
        try {
          payload = JSON.parse(event.data) as StatusPayload;
        } catch {
          log(i18n.t('deployment.recoveringConnection'), 'warning');
          void recover();
          return;
        }
        finish(payload);
      };
      eventSource.onerror = () => {
        void recover();
      };
      timer = setTimeout(() => {
        void recover();
      }, 60000);
      onStatusChange(DeploymentStatus.BUILDING);
    });
  }
}
