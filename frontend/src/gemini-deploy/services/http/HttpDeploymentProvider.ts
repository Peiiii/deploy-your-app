import type {
  IDeploymentProvider,
  AnalyzeCodeParams,
  AnalyzeCodeResult,
} from '../interfaces';
import type { Project, BuildLog } from '../../types';
import { DeploymentStatus } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpDeploymentProvider implements IDeploymentProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  // 1. Send code / repo metadata to backend for security analysis
  async analyzeCode(params: AnalyzeCodeParams): Promise<AnalyzeCodeResult> {
    const { apiKey, sourceCode, repoUrl, analysisId } = params;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      // We no longer rely on the user key for billing, but we can forward it as optional context if needed.
      if (apiKey) {
        headers['X-User-AI-Key'] = apiKey;
      }

      const response = await fetch(`${this.baseUrl}${API_ROUTES.ANALYZE}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sourceCode, repoUrl, analysisId }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      return (await response.json()) as AnalyzeCodeResult;
    } catch (error) {
      console.error('Backend analysis error:', error);
      throw error;
    }
  }

  // 2. Start deployment and stream logs via Server-Sent Events (SSE)
  async startDeployment(
    project: Project,
    onLog: (log: BuildLog) => void,
    onStatusChange: (status: DeploymentStatus) => void
  ): Promise<void> {
    
    // Step 1: Trigger the build job
    let deploymentId: string;
    
    try {
      const startResponse = await fetch(`${this.baseUrl}${API_ROUTES.DEPLOY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });

      if (!startResponse.ok) throw new Error("Failed to start deployment job");
      
      const data = await startResponse.json();
      deploymentId = data.deploymentId;
      
    } catch (error) {
      console.error(error);
      onStatusChange(DeploymentStatus.FAILED);
      onLog({ timestamp: new Date().toISOString(), message: 'Failed to reach backend server.', type: 'error' });
      return;
    }

    // Step 2: Subscribe to the log stream using EventSource (SSE)
    // This allows the backend to push logs to our Terminal component in real-time.
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(`${this.baseUrl}/deployments/${deploymentId}/stream`);

      onStatusChange(DeploymentStatus.BUILDING);

      eventSource.onopen = () => {
        console.log("Connected to build stream...");
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Handle Log Messages
          if (payload.type === 'log') {
            onLog({
              timestamp: new Date().toLocaleTimeString(),
              message: payload.message,
              type: payload.level || 'info'
            });
          }

          // Handle Status Updates
          if (payload.type === 'status') {
            onStatusChange(payload.status);
            
            // Close connection on terminal states
            if (payload.status === DeploymentStatus.SUCCESS) {
              eventSource.close();
              resolve();
            } else if (payload.status === DeploymentStatus.FAILED) {
              eventSource.close();
              reject(new Error("Deployment reported failure"));
            }
          }
        } catch (e) {
          console.error("Error parsing SSE message", e);
        }
      };

      eventSource.onerror = (err) => {
        console.error("Stream connection lost", err);
        eventSource.close();
        // Only fail if we haven't already finished
        onStatusChange(DeploymentStatus.FAILED);
        onLog({ timestamp: new Date().toISOString(), message: 'Connection to build server lost.', type: 'error' });
        reject(err);
      };
    });
  }
}
