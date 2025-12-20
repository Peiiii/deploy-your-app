import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AppRoutes } from '@/routes';
import { PresenterProvider, usePresenter } from '@/contexts/presenter-context';
import { useUIStore } from '@/stores/ui.store';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Toast } from '@/components/toast';
import { CrispChat } from '@/components/crisp-chat';

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles app-level initialization: theme, language, auth, and initial data loading.
 */
const useAppInitialize = () => {
  const { i18n } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const language = useUIStore((s) => s.language);
  const presenter = usePresenter();

  // Sync i18n language
  useEffect(() => {
    presenter.ui.ensureI18nLanguage(i18n);
  }, [i18n, language, presenter.ui]);

  // Load current user
  useEffect(() => {
    presenter.auth.loadCurrentUser();
  }, [presenter.auth]);

  // Load projects
  useEffect(() => {
    presenter.project.loadProjects();
  }, [presenter.project]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reusable page content container with Header and page routes.
 */
const PageContent: React.FC<{ className?: string }> = ({ className }) => (
  <main className={className}>
    <Header />
    <div className="flex-1 overflow-auto">
      <AppRoutes />
    </div>
  </main>
);

/**
 * Split layout container that handles the left/right panel arrangement.
 */
const SplitLayout: React.FC = () => {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const rightPanelContent = useUIStore((s) => s.rightPanelContent);

  const hasRightPanel = rightPanelContent !== null;
  const sidebarOffset = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64';

  return (
    <div className={`h-full flex transition-all duration-300 ${sidebarOffset}`}>
      {/* Desktop: Left Column (hidden on mobile when panel is open) */}
      <PageContent
        className={`flex flex-col min-w-0 transition-all duration-500 ease-out relative z-10 ${
          hasRightPanel ? 'w-1/2 flex-none hidden lg:flex' : 'flex-1 w-full'
        }`}
      />

      {/* Mobile: Full-width content when panel is open */}
      {hasRightPanel && (
        <PageContent className="flex-1 flex flex-col min-w-0 lg:hidden" />
      )}

      {/* Right Panel Slot */}
      {hasRightPanel && (
        <aside className="w-full lg:w-1/2 flex-none h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-50">
          {rightPanelContent}
        </aside>
      )}
    </div>
  );
};

/**
 * Main layout component that composes the app shell.
 */
const MainLayout: React.FC = () => {
  useAppInitialize();

  return (
    <div className="h-screen bg-app-bg text-slate-900 dark:text-gray-200 font-sans selection:bg-brand-500/30 selection:text-brand-700 dark:selection:text-brand-200 transition-colors duration-300 overflow-hidden">
      {/* Global UI Components */}
      <CrispChat />
      <AuthModal />
      <ConfirmDialog />
      <Toast />

      {/* Layout */}
      <Sidebar />
      <SplitLayout />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// App Entry
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <PresenterProvider>
      <MainLayout />
    </PresenterProvider>
  );
}
