import { useDashboardStore } from '@/features/dashboard/stores/dashboardStore';
import type { UIManager } from './UIManager';
import type { AuthManager } from './AuthManager';
import i18n from '@i18n/config';

/**
 * DashboardManager handles business logic for the Dashboard page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class DashboardManager {
  private uiManager: UIManager;
  private authManager: AuthManager;

  constructor(uiManager: UIManager, authManager: AuthManager) {
    this.uiManager = uiManager;
    this.authManager = authManager;
  }

  /**
   * Check if user is authenticated and perform action, or prompt login.
   */
  requireAuthAnd = (action: () => void) => {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      const t = i18n.t.bind(i18n);
      this.authManager.openAuthModal('login');
      this.uiManager.showToast(t('deployment.signInRequired'), 'info');
      return;
    }
    action();
  };

  /**
   * Handle sort option change.
   */
  handleSort = (option: 'name' | 'recent' | 'status') => {
    useDashboardStore.getState().actions.handleSort(option);
  };

  /**
   * Reset all filters.
   */
  resetFilters = () => {
    useDashboardStore.getState().actions.reset();
  };
}
