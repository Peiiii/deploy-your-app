import { useDeploymentStore } from '@/features/deployment/stores/deployment-store';
import { SourceType } from '@/types';

/**
 * Encapsulates all store-related operations for deployment.
 * Provides a clean interface for UI components and other managers.
 */
export class DeploymentStoreActions {
  reset = () => {
    useDeploymentStore.getState().actions.reset();
  };

  handleSourceChange = (type: SourceType) => {
    useDeploymentStore.getState().actions.setSourceType(type);
  };

  handleFileDrop = (file: File) => {
    if (file.name.endsWith('.zip')) {
      const actions = useDeploymentStore.getState().actions;
      actions.setZipFile(file);
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

  getState = () => useDeploymentStore.getState();
}
