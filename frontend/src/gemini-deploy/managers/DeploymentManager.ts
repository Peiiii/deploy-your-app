import { useDeploymentStore } from '../stores/deploymentStore';
import { DeploymentStatus } from '../types';
import type { Project } from '../types';
import type { IDeploymentProvider } from '../services/interfaces';

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

  handleAnalyzeCode = async () => {
    // AI analysis is temporarily disabled for the MVP.
    // This method is kept for future use but does nothing.
    console.warn('handleAnalyzeCode called, but AI analysis is currently disabled.');
  };

  startBuildSimulation = async (onComplete: () => void) => {
    const store = useDeploymentStore.getState();
    const actions = store.actions;

    actions.setStep(2);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();

    let zipData: string | undefined;
    if (store.sourceType === 'zip' && store.zipFile) {
      try {
        zipData = await this.fileToBase64(store.zipFile);
      } catch (err) {
        console.error('Failed to read ZIP file', err);
        actions.setDeploymentStatus(DeploymentStatus.FAILED);
        actions.addLog({
          timestamp: new Date().toISOString(),
          message: 'Failed to read ZIP file in browser.',
          type: 'error',
        });
        return;
      }
    }

    const fallbackName =
      store.projectName ||
      (store.sourceType === 'github'
        ? (store.repoUrl.split('/').filter(Boolean).pop() || 'my-app')
        : store.zipFile?.name.replace(/\.zip$/i, '') || 'my-app');

    const tempProject: Project = {
      id: 'temp',
      name: fallbackName,
      repoUrl:
        store.sourceType === 'github'
          ? store.repoUrl
          : store.zipFile?.name || 'archive.zip',
      sourceType: store.sourceType,
      zipData,
      analysisId: store.analysisId || undefined,
      lastDeployed: '',
      status: 'Building',
      framework: 'Unknown',
    };

    try {
      await this.provider.startDeployment(
        tempProject,
        (log) => actions.addLog(log),
        (status) => actions.setDeploymentStatus(status)
      );
      onComplete();
    } catch (e) {
      console.error("Deployment failed", e);
      actions.setDeploymentStatus(DeploymentStatus.FAILED);
    }
  };

  resetWizard = () => {
    useDeploymentStore.getState().actions.reset();
  }

  handleSourceChange = (type: 'github' | 'zip') => {
    useDeploymentStore.getState().actions.setSourceType(type);
  }

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
  }

  autoProjectName = (val: string, type: 'github' | 'zip') => {
     if (type === 'github') {
        const parts = val.split('/');
        const name = parts[parts.length - 1]?.replace('.git', '') || '';
        if(name) useDeploymentStore.getState().actions.setProjectName(name);
     }
  }
}
