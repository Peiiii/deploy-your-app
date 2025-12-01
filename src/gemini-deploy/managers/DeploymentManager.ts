import { useDeploymentStore } from '../stores/deploymentStore';
import { DeploymentStatus } from '../types';
import type { Project } from '../types';
import type { IDeploymentProvider } from '../services/interfaces';

export class DeploymentManager {
  private provider: IDeploymentProvider;

  constructor(provider: IDeploymentProvider) {
    this.provider = provider;
  }

  handleAnalyzeCode = async () => {
    const store = useDeploymentStore.getState();
    const actions = store.actions;

    if (!store.apiKey) {
      alert("Please provide a valid Gemini API Key to enable the security analysis.");
      return;
    }

    actions.setIsAnalyzing(true);
    actions.setExplanation('');

    try {
      // Delegate to provider
      const result = await this.provider.analyzeCode(store.apiKey, store.sourceCode);
      actions.setAnalyzedCode(result.refactoredCode);
      actions.setExplanation(result.explanation);
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Check console or API key.");
    } finally {
      actions.setIsAnalyzing(false);
    }
  };

  startBuildSimulation = async (onComplete: () => void) => {
    const store = useDeploymentStore.getState();
    const actions = store.actions;

    actions.setStep(3);
    actions.setDeploymentStatus(DeploymentStatus.BUILDING);
    actions.clearLogs();

    const tempProject: Project = {
        id: 'temp',
        name: store.projectName,
        repoUrl: store.sourceType === 'github' ? store.repoUrl : (store.zipFile?.name || 'archive.zip'),
        sourceType: store.sourceType,
        lastDeployed: '',
        status: 'Building',
        framework: 'Unknown'
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
      useDeploymentStore.getState().actions.setZipFile(file);
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
