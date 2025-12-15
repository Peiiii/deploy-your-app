import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Eye, EyeOff, Github } from 'lucide-react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    modalOpen,
    mode,
    email,
    password,
    confirmPassword,
    isSubmitting,
    error,
    passwordVisible,
    confirmPasswordVisible,
  } =
    useAuthStore((state) => state);
  const presenter = usePresenter();

  if (!modalOpen) return null;

  const title = mode === 'login' ? t('common.signIn') : t('common.signUp');
  const primaryLabel = mode === 'login' ? t('common.signIn') : t('common.signUp');
  const toggleLabel =
    mode === 'login' ? t('auth.needAccount') : t('auth.alreadyHaveAccount');
  const toggleTarget = mode === 'login' ? 'signup' : 'login';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      void presenter.auth.submitEmailLogin();
    } else {
      void presenter.auth.submitEmailSignup();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4"
      onClick={() => presenter.auth.closeAuthModal()}
    >
      <div
        className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 dark:shadow-black/40 border border-white/20 dark:border-slate-700/50 w-full max-w-md mx-auto animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          <button
            onClick={() => presenter.auth.closeAuthModal()}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/50 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800/50 transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative px-6 pt-6 pb-6 space-y-5">
          {/* Social sign-in options */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => presenter.auth.loginWithGoogle()}
              className="group w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <GoogleIcon className="w-5 h-5" />
              <span className="truncate">{t('auth.signInWithGoogle')}</span>
            </button>
            <button
              type="button"
              onClick={() => presenter.auth.loginWithGithub()}
              className="group w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Github className="w-5 h-5 text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white group-hover:scale-110 transition-all" />
              <span className="truncate">{t('auth.signInWithGithub')}</span>
            </button>
          </div>

          {/* Divider for email sign-in */}
          <div className="flex items-center gap-4 py-2">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-slate-200 dark:to-slate-700" />
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {t('auth.orContinueWithEmail')}
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 dark:via-slate-700 to-slate-200 dark:to-slate-700" />
          </div>

          {/* Email / password fields */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => presenter.auth.setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 dark:focus:ring-brand-400/50 dark:focus:border-brand-400/50 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600"
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('auth.password')}
            </label>
            <div className="relative">
              <input
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(e) => presenter.auth.setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 dark:focus:ring-brand-400/50 dark:focus:border-brand-400/50 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600"
                placeholder={mode === 'login' ? t('auth.passwordPlaceholder') : t('auth.passwordPlaceholderSignup')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => presenter.auth.togglePasswordVisible()}
                className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                aria-label={passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t('auth.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) =>
                    presenter.auth.setConfirmPassword(e.target.value)
                  }
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 dark:focus:ring-brand-400/50 dark:focus:border-brand-400/50 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    presenter.auth.toggleConfirmPasswordVisible()
                  }
                  className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                  aria-label={
                    confirmPasswordVisible ? t('auth.hidePassword') : t('auth.showPassword')
                  }
                >
                  {confirmPasswordVisible ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 px-4 py-3 animate-slide-up">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-brand-500 dark:to-brand-600 text-white text-sm font-semibold hover:from-slate-800 hover:to-slate-700 dark:hover:from-brand-400 dark:hover:to-brand-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20 dark:shadow-brand-500/20 hover:shadow-xl hover:shadow-slate-900/30 dark:hover:shadow-brand-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('common.pleaseWait')}</span>
              </>
            ) : (
              primaryLabel
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              presenter.auth.openAuthModal(toggleTarget as 'login' | 'signup')
            }
            className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-center pt-2 transition-colors font-medium"
          >
            {toggleLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
