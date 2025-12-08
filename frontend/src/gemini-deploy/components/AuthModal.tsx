import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePresenter } from '../contexts/PresenterContext';

export const AuthModal: React.FC = () => {
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

  const title = mode === 'login' ? 'Sign in with email' : 'Create your account';
  const primaryLabel = mode === 'login' ? 'Sign in' : 'Sign up';
  const toggleLabel =
    mode === 'login' ? 'Need an account?' : 'Already have an account?';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <button
            onClick={() => presenter.auth.closeAuthModal()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pt-4 pb-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => presenter.auth.setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-transparent"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(e) => presenter.auth.setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-transparent"
                placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => presenter.auth.togglePasswordVisible()}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              >
                {passwordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) =>
                    presenter.auth.setConfirmPassword(e.target.value)
                  }
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-transparent"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    presenter.auth.toggleConfirmPasswordVisible()
                  }
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  aria-label={
                    confirmPasswordVisible ? 'Hide password' : 'Show password'
                  }
                >
                  {confirmPasswordVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-brand-500 dark:hover:bg-brand-400 transition-colors"
          >
            {isSubmitting ? 'Please wait…' : primaryLabel}
          </button>

          <button
            type="button"
            onClick={() =>
              presenter.auth.openAuthModal(toggleTarget as 'login' | 'signup')
            }
            className="w-full text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 text-center mt-1"
          >
            {toggleLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
