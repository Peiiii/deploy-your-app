import {
  useUIStore,
  type ToastVariant,
  type ConfirmDialogState,
} from '../stores/uiStore';
import { confirmController } from '../services/confirmController';

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

  toggleSidebarCollapsed = (): void => {
    const { actions } = useUIStore.getState();
    actions.toggleSidebarCollapsed();
  };

  setSidebarCollapsed = (collapsed: boolean): void => {
    const { actions } = useUIStore.getState();
    actions.setSidebarCollapsed(collapsed);
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

  /**
   * Generic confirm dialog helper. It renders a two-button modal with
   * primary/secondary actions and resolves to true when the primary action
   * is chosen, false otherwise.
   */
  showConfirm = async (dialog: Omit<ConfirmDialogState, 'resolve'>): Promise<boolean> => {
    const { actions } = useUIStore.getState();
    return new Promise<boolean>((resolve) => {
      confirmController.setResolver((primary) => {
        resolve(primary);
      });
      actions.openConfirmDialog(dialog);
    });
  };
}
