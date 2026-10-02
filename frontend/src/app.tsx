import { trackPage } from '@/analytics/collector';
import { lazy, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AppRoutes } from '@/routes';
import { PresenterProvider, usePresenter } from '@/contexts/presenter-context';
import { useUIStore } from '@/stores/ui.store';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { AuthModal } from '@/features/auth/components/auth-modal';
import { ProfileNameReminder } from '@/features/profile/components/profile-name-reminder';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Toast } from '@/components/toast';
import { routeLoaders } from '@/route-loader';
import { Modal } from '@/components/modal';
import { RouteBoundary } from '@/components/route-boundary';
const PrivacyPolicyPage = lazy(routeLoaders.privacy);
const AcceptableUsePage = lazy(routeLoaders.acceptableUse);
const SdkAuthBrokerPage = lazy(routeLoaders.sdk);
const CliLoginPage = lazy(routeLoaders.cli);
const CliLoginSuccessPage = lazy(routeLoaders.cliSuccess);

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles app-level initialization: theme, language, auth, and initial data loading.
 */
const useAppInitialize = () => {
  const analyticsLocation = useLocation();
  useEffect(() => { trackPage(); }, [analyticsLocation.pathname]);
  const { i18n } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const language = useUIStore((s) => s.language);
  const authUserId = useAuthStore((s) => s.user?.id);
  const sessionError = useAuthStore((s) => s.sessionError);
  const authLoading = useAuthStore((s) => s.isLoading);
  const presenter = usePresenter();

  // Sync i18n language
  useEffect(() => {
    presenter.ui.ensureI18nLanguage(i18n);
  }, [i18n, language, presenter.ui]);

  // Load current user
  useEffect(() => {
    presenter.auth.loadCurrentUser();
  }, [presenter.auth]);

  // Load the signed-in user's projects only after session restoration. This
  // avoids both an unauthorized request and a global-project pagination race.
  useEffect(() => {
    if (authLoading || sessionError) return;
    if (!authUserId) {
      useProjectStore.getState().actions.reset();
      return;
    }
    void presenter.project.loadProjects();
  }, [authLoading, authUserId, sessionError, presenter.project]);

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
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [pathname]);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const hasRightPanel = useUIStore((s) => s.rightPanelContent !== null);
  const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);

  const sidebarOffset = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64';
  // When right panel is open, reserve right half of remaining space
  const rightPanelOffset =
    hasRightPanel && rightPanelLayout === 'half' ? 'lg:mr-[50%]' : '';
  const isFullscreenPanel = hasRightPanel && rightPanelLayout === 'fullscreen';

  return (
    <main
      id="main-content" tabIndex={-1} ref={scrollRef}
      className={`h-full min-w-0 overflow-y-auto overflow-x-hidden flex flex-col ${sidebarOffset} ${rightPanelOffset} ${isFullscreenPanel ? 'pointer-events-none select-none' : ''}`}
    >
      <Header />
      <div className="flex-1 min-w-0">
        <AppRoutes />
      </div>
    </main>
  );
};

/**
 * Right panel container, rendered at root level as sibling of Sidebar and MainContent.
 */
const RightPanel: React.FC = () => {
  const { t } = useTranslation();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const rightPanelContent = useUIStore((s) => s.rightPanelContent);
  const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);
  const closePanel = useUIStore((s) => s.actions.closeRightPanel);

  if (!rightPanelContent) return null;

  // Width = 50% of (viewport - sidebar width)
  const sidebarWidth = sidebarCollapsed ? '4rem' : '16rem';

  if (rightPanelLayout === 'fullscreen') {
    return (
      <Modal open onClose={closePanel} titleId="preview-title" title={t('experience.preview')} layout="fullscreen"><div className="h-[100dvh]">{rightPanelContent}</div></Modal>
    );
  }

  return (
    <aside
      className="hidden lg:flex fixed top-0 right-0 bottom-0 border-l border-slate-200 dark:border-slate-800 bg-app-bg z-40"
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
  const { i18n } = useTranslation();

  return (
    <div className="h-[100dvh] bg-app-bg text-app-text font-sans selection:bg-brand-500/30 selection:text-brand-700 dark:selection:text-brand-200 overflow-hidden">
      <a href="#main-content" className="skip-link btn-primary">{i18n.t('experience.skipToContent')}</a>
      {/* Global UI Components */}
      <AuthModal />
      <ConfirmDialog />
      <ProfileNameReminder />
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
  const location = useLocation();
  const pathname = location.pathname || '/';
  const isPrivacyPolicy =
    pathname === '/privacy-policy' || pathname === '/privacy';
  const isSdkAuthBroker = pathname === '/sdk/broker';
  const isCliLogin = pathname === '/cli/login';
  const isCliLoginSuccess = pathname === '/cli/login/success';

  if (isPrivacyPolicy) {
    return <RouteBoundary><PrivacyPolicyPage /></RouteBoundary>;
  }

  if (pathname === '/acceptable-use') {
    return <RouteBoundary><AcceptableUsePage /></RouteBoundary>;
  }

  if (isSdkAuthBroker) {
    return (
      <PresenterProvider>
        <div className="min-h-screen bg-black text-white">
          <AuthModal />
          <ConfirmDialog />
          <Toast />
          <RouteBoundary><SdkAuthBrokerPage /></RouteBoundary>
        </div>
      </PresenterProvider>
    );
  }

  if (isCliLogin) {
    return (
      <PresenterProvider>
        <div className="min-h-screen bg-black text-white">
          <AuthModal />
          <ConfirmDialog />
          <Toast />
          <RouteBoundary><CliLoginPage /></RouteBoundary>
        </div>
      </PresenterProvider>
    );
  }

  if (isCliLoginSuccess) {
    return <RouteBoundary><CliLoginSuccessPage /></RouteBoundary>;
  }

  return (
    <PresenterProvider>
      <MainLayout />
    </PresenterProvider>
  );
}
