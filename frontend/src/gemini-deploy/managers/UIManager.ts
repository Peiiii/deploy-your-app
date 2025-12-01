import { useUIStore } from '../stores/uiStore';

export class UIManager {
  navigateTo = (view: string) => {
    useUIStore.getState().actions.setCurrentView(view);
  };

  getCurrentView = () => {
    return useUIStore.getState().currentView;
  }
}