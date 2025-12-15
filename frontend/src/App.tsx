import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AppRoutes } from '@/routes';
import { PresenterProvider, usePresenter } from '@/contexts/PresenterContext';
import { useUIStore } from '@/stores/uiStore';
import { AuthModal } from '@/features/auth/components/AuthModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toast } from '@/components/Toast';
import { CrispChat } from '@/components/CrispChat';

const MainLayout = () => {
  const { i18n } = useTranslation();
  const theme = useUIStore((state) => state.theme);
  const language = useUIStore((state) => state.language);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const presenter = usePresenter();

  useEffect(() => {
    presenter.ui.ensureI18nLanguage(i18n);
  }, [i18n, language, presenter.ui]);

  useEffect(() => {
    presenter.auth.loadCurrentUser();
  }, [presenter.auth]);

  useEffect(() => {
    presenter.project.loadProjects();
  }, [presenter.project]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex w-full h-screen bg-app-bg text-slate-900 dark:text-gray-200 font-sans selection:bg-brand-500/30 selection:text-brand-700 dark:selection:text-brand-200 transition-colors duration-300 overflow-hidden">
      <CrispChat />
      <AuthModal />
      <ConfirmDialog />
      <Sidebar />
      <Toast />

      <main
        className={`ml-0 flex-1 w-full overflow-auto relative z-10 min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
          }`}
      >
        <Header />
        <div className="p-0">
          <AppRoutes />
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <PresenterProvider>
      <MainLayout />
    </PresenterProvider>
  );
}
