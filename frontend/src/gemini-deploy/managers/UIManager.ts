import { useUIStore } from '../stores/uiStore';

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
}
