import { useEffect, useMemo, useRef } from 'react';
import { Github, Loader2, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { APP_CONFIG } from '@/constants';

const API_BASE = APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');

const isAllowedDeviceRedirect = (target: string): boolean => {
  try {
    const parsed = new URL(target);
    return (
      parsed.protocol === 'gemigo-desktop:' ||
      (parsed.protocol === 'http:' &&
        (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'))
    );
  } catch {
    return false;
  }
};

const requireRedirect = (raw: string | null): string | null => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed.length > 1024) return null;
  if (!isAllowedDeviceRedirect(trimmed)) return null;
  return trimmed;
};

export function CliLoginPage() {
  const presenter = usePresenter();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const authorizingRef = useRef(false);

  const redirect = useMemo(
    () => requireRedirect(params.get('redirect')),
    [params],
  );

  useEffect(() => {
    void presenter.auth.loadCurrentUser();
  }, [presenter.auth]);

  useEffect(() => {
    if (!redirect || !user || authLoading || authorizingRef.current) return;

    authorizingRef.current = true;
    const authorizeUrl = new URL(
      `${API_BASE}/auth/desktop/authorize`,
      window.location.origin,
    );
    authorizeUrl.searchParams.set('redirect', redirect);
    window.location.href = authorizeUrl.toString();
  }, [authLoading, redirect, user]);

  const provider = params.get('provider');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-white/60">GemiGo CLI</div>
            <h1 className="text-xl font-bold">登录授权</h1>
          </div>
        </div>

        {!redirect && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            登录链接无效，请回到命令行重新运行 gemigo login。
          </div>
        )}

        {redirect && authLoading && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在检查登录状态
          </div>
        )}

        {redirect && !authLoading && !user && (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-white/70">
              需要先登录 GemiGo，登录成功后才会授权这台电脑上的 CLI。
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white/90"
              onClick={() => presenter.auth.openAuthModal('login')}
            >
              邮箱登录
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
                onClick={() => presenter.auth.loginWithGoogle()}
              >
                Google
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
                onClick={() => presenter.auth.loginWithGithub()}
              >
                <Github className="h-4 w-4" />
                GitHub
              </button>
            </div>
            {provider === 'github' || provider === 'google' ? (
              <p className="text-xs text-white/45">
                命令行偏好使用 {provider}，但仍需要你在 GemiGo 页面上确认登录。
              </p>
            ) : null}
          </div>
        )}

        {redirect && !authLoading && user && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在授权 CLI
          </div>
        )}
      </div>
    </div>
  );
}
