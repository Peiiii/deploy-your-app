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
 * Main content area with Header and routes.
 * Width adjusts based on whether right panel is open.
 */
const MainContent: React.FC = () => {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const hasRightPanel = useUIStore((s) => s.rightPanelContent !== null);

  const sidebarOffset = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64';
  // When right panel is open, reserve right half of remaining space
  const rightPanelOffset = hasRightPanel ? 'lg:mr-[50%]' : '';

  return (
    <main
      className={`h-full flex flex-col transition-all duration-300 ${sidebarOffset} ${rightPanelOffset}`}
    >
      <Header />
      <div className="flex-1 overflow-auto">
        <AppRoutes />
      </div>
    </main>
  );
};

/**
 * Right panel container, rendered at root level as sibling of Sidebar and MainContent.
 */
const RightPanel: React.FC = () => {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const rightPanelContent = useUIStore((s) => s.rightPanelContent);

  if (!rightPanelContent) return null;

  // Width = 50% of (viewport - sidebar width)
  const sidebarWidth = sidebarCollapsed ? '4rem' : '16rem';

  return (
    <aside
      className="hidden lg:flex fixed top-0 right-0 bottom-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-40"
      style={{ width: `calc((100vw - ${sidebarWidth}) / 2)` }}
    >
      {rightPanelContent}
    </aside>
  );
};

/**
 * Main layout component that composes the app shell.
 * Structure: LeftSidebar | MainContent | RightPanel (all siblings)
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

      {/* Layout: Three siblings at root level */}
      <Sidebar />
      <MainContent />
      <RightPanel />
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
