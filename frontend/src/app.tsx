import { PointsConfirmPage } from '@/features/points/points-pages';
import { usePageSeo } from '@/seo/use-page-seo';
import { trackPage } from '@/analytics/collector';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePreviewScrollAnchor } from '@/hooks/use-preview-scroll-anchor';
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
import { CrispChat } from '@/components/crisp-chat';
import { PrivacyPolicyPage } from '@/features/legal/pages/privacy-policy';
import { AcceptableUsePage } from '@/features/legal/pages/acceptable-use';
import { SdkAuthBrokerPage } from '@/features/sdk-auth/pages/sdk-auth-broker';
import {
  CliLoginPage,
  CliLoginSuccessPage,
} from '@/features/cli-auth/pages/cli-login-page';

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
  const authLoading = useAuthStore((s) => s.isLoading);
  const presenter = usePresenter();
  const [sessionRestored, setSessionRestored] = useState(false);
  const seededOwner = useRef<string | null>(null);

  // Sync i18n language
  useEffect(() => {
    presenter.ui.ensureI18nLanguage(i18n);
  }, [i18n, language, presenter.ui]);

  // Load current user
  useEffect(() => {
    let active = true;
    void presenter.auth.loadCurrentUser(window.location.pathname === '/dashboard').then((snapshot) => {
      if (!active) return;
      if (snapshot?.user && snapshot.projects && presenter.project.seedSessionProjects(snapshot.user.id, snapshot.projects)) {
        seededOwner.current = snapshot.user.id;
      }
      setSessionRestored(true);
    });
    return () => { active = false; };
  }, [presenter.auth, presenter.project]);

  // Load the signed-in user's projects only after session restoration. This
  // avoids both an unauthorized request and a global-project pagination race.
  useEffect(() => {
    if (!sessionRestored || authLoading) return;
    if (!authUserId) {
      useProjectStore.getState().actions.reset();
      return;
    }
    if (seededOwner.current === authUserId) {
      seededOwner.current = null;
      return;
    }
    void presenter.project.loadProjects();
  }, [sessionRestored, authLoading, authUserId, presenter.project]);

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
  usePreviewScrollAnchor(scrollRef);
  // Routes share this scroll container; a new page must not inherit its offset.
  // Query changes and preview/sidebar reflow keep their existing position.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  const isFullscreenPanel = useUIStore((s) =>
    s.rightPanelContent !== null && s.rightPanelLayout === 'fullscreen');

  return (
    <main
      ref={scrollRef}
      className={`app-scrollbar min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden flex flex-col ${isFullscreenPanel ? 'pointer-events-none select-none' : ''}`}
    >
      <Header />
      <div className="flex-1">
        <AppRoutes />
      </div>
    </main>
  );
};

/**
 * Right panel container, rendered at root level as sibling of Sidebar and MainContent.
 */
const RightPanel: React.FC = () => {
  const rightPanelContent = useUIStore((s) => s.rightPanelContent);
  const rightPanelLayout = useUIStore((s) => s.rightPanelLayout);

  if (!rightPanelContent) return null;

  if (rightPanelLayout === 'fullscreen') {
    return (
      <aside className="fixed inset-0 bg-white dark:bg-black z-50">
        {rightPanelContent}
      </aside>
    );
  }

  return (
    <aside
      className="hidden lg:flex relative min-w-0 min-h-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-40"
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
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const isSplitPanel = useUIStore((s) =>
    s.rightPanelContent !== null && s.rightPanelLayout === 'half');

  return (
    <div className={`h-screen grid grid-cols-[minmax(0,1fr)] ${isSplitPanel ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''} ${sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'} bg-app-bg text-slate-900 dark:text-gray-200 font-sans selection:bg-brand-500/30 selection:text-brand-700 dark:selection:text-brand-200 transition-colors duration-300 overflow-hidden`}>
      {/* Global UI Components */}
      <CrispChat />
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
  // Hand off the HTML startup placeholder in the same frame as the first commit.
  useLayoutEffect(() => {
    document.documentElement.classList.remove('app-booting');
  }, []);
  usePageSeo();
  const location = useLocation();
  const pathname = location.pathname || '/';
  const isPrivacyPolicy =
    pathname === '/privacy-policy' || pathname === '/privacy';
  const isSdkAuthBroker = pathname === '/sdk/broker';
  const isPointsConfirm = pathname === '/points/confirm';
  const isCliLogin = pathname === '/cli/login';
  const isCliLoginSuccess = pathname === '/cli/login/success';

  if (isPrivacyPolicy) {
    return <PrivacyPolicyPage />;
  }

  if (pathname === '/acceptable-use') {
    return <AcceptableUsePage />;
  }

  if (isSdkAuthBroker || isPointsConfirm) {
    return (
      <PresenterProvider>
        <div className="min-h-screen bg-black text-white">
          <AuthModal />
          <ConfirmDialog />
          <Toast />
          {isPointsConfirm ? <PointsConfirmPage /> : <SdkAuthBrokerPage />}
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
          <CliLoginPage />
        </div>
      </PresenterProvider>
    );
  }

  if (isCliLoginSuccess) {
    return <CliLoginSuccessPage />;
  }

  return (
    <PresenterProvider>
      <MainLayout />
    </PresenterProvider>
  );
}
