import { useUIStore, type ToastVariant } from '../stores/uiStore';

// Manager for UI-related actions. State (theme, sidebar) is kept in uiStore.
export class UIManager {
  toggleTheme = (): void => {
    const { actions } = useUIStore.getState();
    actions.toggleTheme();
  };

  toggleSidebar = (): void => {
    const { actions } = useUIStore.getState();
    actions.toggleSidebar();
  };

  setSidebarOpen = (open: boolean): void => {
    const { actions } = useUIStore.getState();
    actions.setSidebarOpen(open);
  };

  showToast = (message: string, variant: ToastVariant = 'info'): void => {
    const { actions } = useUIStore.getState();
    actions.showToast({ message, variant });
  };

  showSuccessToast = (message: string): void => {
    this.showToast(message, 'success');
  };

  showErrorToast = (message: string): void => {
    this.showToast(message, 'error');
  };
}
