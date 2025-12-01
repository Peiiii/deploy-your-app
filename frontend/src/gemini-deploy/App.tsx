import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { NewDeployment } from './pages/NewDeployment';
import { PresenterProvider, usePresenter } from './contexts/PresenterContext';
import { useUIStore } from './stores/uiStore';
import { Bell, HelpCircle, Sun, Moon } from 'lucide-react';

const MainLayout = () => {
  const { currentView, theme, actions: { toggleTheme } } = useUIStore((state) => state);
  const presenter = usePresenter();

  // Initial Data Load
  useEffect(() => {
    presenter.project.loadProjects();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex min-h-screen bg-app-bg text-slate-900 dark:text-gray-200 font-sans selection:bg-brand-500/30 selection:text-brand-700 dark:selection:text-brand-200 transition-colors duration-300">
      <Sidebar />
      
      <main className="ml-64 flex-1 overflow-auto relative z-10">
        <header className="h-16 border-b border-app-border bg-app-bg/50 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-500">
            <span className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors cursor-pointer">Organization</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-gray-200 font-medium">Personal Projects</span>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={toggleTheme}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-full transition-all"
                title="Toggle Theme"
             >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
             <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-full transition-all">
                <HelpCircle className="w-5 h-5" />
             </button>
             <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-full transition-all relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-app-bg"></span>
             </button>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 border border-slate-200 dark:border-white/10 ring-2 ring-transparent hover:ring-brand-500/50 transition-all cursor-pointer"></div>
          </div>
        </header>

        <div className="p-0">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'deploy' && <NewDeployment />}
          {currentView !== 'dashboard' && currentView !== 'deploy' && (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500 dark:text-gray-500 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center mb-4">
                 <span className="text-2xl">🚧</span>
              </div>
              <h3 className="text-xl font-medium mb-2 text-slate-900 dark:text-white">Under Construction</h3>
              <p>The {currentView} module is coming in the next update.</p>
            </div>
          )}
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
