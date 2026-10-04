import { IconButton } from '@/components/icon-button';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  LockKeyhole,
  Moon,
  Sun,
  UserRound,
  Database,
  Coins,
} from 'lucide-react';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { APP_CONFIG } from '@/constants';
import { sdkAuthorize } from '@/services/http/sdk-auth-api';

type AuthorizationContext = {
  appId: string;
  name: string;
  origin: string;
  provider: string;
  scopes: string[];
  previouslyGranted: boolean;
  mode?: 'popup' | 'redirect';
  state?: string;
  redirectUri?: string;
};
export function SdkAuthBrokerPage() {
  const presenter = usePresenter();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const theme = useUIStore((s) => s.theme);
  const language = useUIStore((s) => s.language);
  const actions = useUIStore((s) => s.actions);
  const zh = language.startsWith('zh');
  const t = (cn: string, en: string) => (zh ? cn : en);
  const [context, setContext] = useState<AuthorizationContext | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const query = useMemo(
    () => ({
      requestId: params.get('request'),
      appId: params.get('app_id') || params.get('appId'),
      scope: params.get('scope') || params.get('scopes') || 'identity:basic',
      challenge: params.get('code_challenge') || params.get('codeChallenge'),
      method: params.get('code_challenge_method') || 'S256',
      state: params.get('state'),
      origin: params.get('origin'),
    }),
    [params]
  );
  useEffect(() => {
    void presenter.auth.loadCurrentUser();
  }, [presenter.auth]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.title = zh ? '应用授权 · GemiGo' : 'Authorize application · GemiGo';
  }, [theme, zh]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setContext(null);
    const load = async () => {
      if (
        !query.requestId &&
        (!query.appId ||
          !query.origin ||
          !query.state ||
          query.state.length > 128 ||
          !query.challenge ||
          !/^[A-Za-z0-9_-]{43}$/.test(query.challenge) ||
          query.method !== 'S256')
      )
        throw new Error('Invalid request. Please restart login from the app.');
      const legacy = new URLSearchParams({
        app_id: query.appId || '',
        origin: query.origin || '',
        scope: query.scope,
      });
      const path = query.requestId
        ? `/sdk/auth-requests/${encodeURIComponent(query.requestId)}`
        : `/sdk/authorization-context?${legacy}`;
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}${path}`, {
        credentials: 'include',
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authorization request unavailable.');
      if (!controller.signal.aborted) setContext(data as AuthorizationContext);
    };
    void load()
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : 'Unable to load request.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, user?.id]);

  const returnToApp = (code?: string, denied = false) => {
    if (!context) return;
    const state = context.state || query.state;
    if (context.mode === 'redirect' && context.redirectUri && state) {
      const target = new URL(context.redirectUri);
      target.searchParams.set('gemigo_state', state);
      if (denied) target.searchParams.set('gemigo_error', 'access_denied');
      else if (code) target.searchParams.set('gemigo_code', code);
      window.location.replace(target.href);
      return;
    }
    if (window.opener && state) {
      window.opener.postMessage(
        {
          type: denied ? 'gemigo:sdk-auth-error' : 'gemigo:sdk-auth-code',
          state,
          ...(denied ? { error: 'access_denied' } : { code, appId: context.appId }),
        },
        context.origin
      );
      window.close();
    }
    setFinished(true);
  };
  const authorize = async () => {
    if (!context) return;
    setSubmitting(true);
    setError('');
    try {
      let code: string;
      if (query.requestId) {
        const response = await fetch(
          `${APP_CONFIG.API_BASE_URL}/sdk/auth-requests/${encodeURIComponent(query.requestId)}/authorize`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }
        );
        const result = await response.json();
        if (response.status === 401) {
          presenter.auth.openAuthModal('login');
          return;
        }
        if (!response.ok) throw new Error(result.error || 'Authorization failed.');
        code = result.code;
      } else {
        const result = await sdkAuthorize({
          appId: context.appId,
          scopes: context.scopes,
          codeChallenge: query.challenge!,
          openerOrigin: context.origin,
        });
        code = result.code;
      }
      returnToApp(code);
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized')
        presenter.auth.openAuthModal('login');
      else setError(err instanceof Error ? err.message : 'Authorization failed.');
    } finally {
      setSubmitting(false);
    }
  };
  const permissions = {
    'identity:basic': {
      icon: UserRound,
      title: t('识别你在应用中的身份', 'Recognize you in this app'),
      description: t(
        '仅提供此应用专属的用户 ID。',
        'Shares an identifier unique to this application.'
      ),
    },
    'storage:rw': {
      icon: Database,
      title: t('保存和读取应用数据', 'Save and read application data'),
      description: t(
        '读写你在此应用中的云端数据。',
        'Accesses your cloud data within this application.'
      ),
    },
    'points:use': {
      icon: Coins,
      title: t('使用 GemiGo 点数', 'Use GemiGo points'),
      description: t(
        '接入点数消费；具体消费仍需你确认。',
        'Connects to points purchases, which require your confirmation.'
      ),
    },
  };
  const buttonClass =
    'w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 disabled:opacity-50';
  return (
    <main className="min-h-screen bg-[#f7f6fb] text-slate-900 dark:bg-[#101019] dark:text-slate-100 px-5 py-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <header className="mb-10 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <img src="/logo.svg" alt="" className="h-8 w-8" />
            GemiGo
          </a>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <button
              className="text-xs font-medium rounded-lg p-2 hover:bg-violet-100 dark:hover:bg-white/10"
              onClick={() => actions.setLanguage(zh ? 'en' : 'zh-CN')}
            >
              {zh ? 'EN' : '中文'}
            </button>
            <IconButton
              className="rounded-lg p-2 hover:bg-violet-100 dark:hover:bg-white/10"
              label={t('切换明暗主题', 'Toggle theme')}
              onClick={actions.toggleTheme}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </div>
        </header>
        <section
          aria-busy={loading || submitting}
          className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_48px_-24px_rgba(76,29,149,0.28)] dark:border-white/10 dark:bg-[#1b1b28] sm:p-8"
        >
          {loading ? (
            <div role="status" className="py-16 text-center text-sm text-slate-500">
              {t('正在核实应用…', 'Checking application…')}
            </div>
          ) : context && !finished ? (
            <>
              <div className="flex items-center justify-center gap-4 mb-7" aria-hidden="true">
                <img src="/logo.svg" alt="" className="h-12 w-12" />
                <ArrowRight className="text-slate-300" size={20} />
                <div className="h-14 w-14 rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300 grid place-items-center text-2xl font-semibold">
                  {Array.from(context.name || context.appId)[0]}
                </div>
              </div>
              <h1 className="text-center text-2xl font-bold tracking-tight break-words">
                {t('登录', 'Sign in to')} {context.name || context.appId}
              </h1>
              <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400 break-words">
                {new URL(context.origin).host}
              </p>
              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {t('提供者：', 'By ')}
                {context.provider}
              </p>
              <div className="my-6 border-t border-slate-100 dark:border-white/10" />
              <p className="mb-4 text-sm font-medium">
                {t('此应用将获得以下权限', 'This application requests permission to')}
              </p>
              <ul className="space-y-5">
                {context.scopes.map((scope) => {
                  const permission = permissions[scope as keyof typeof permissions];
                  if (!permission) return null;
                  const Icon = permission.icon;
                  return (
                    <li key={scope} className="flex gap-3">
                      <span className="mt-0.5 text-violet-600 dark:text-violet-400">
                        <Icon size={19} />
                      </span>
                      <div>
                        <div className="text-sm font-medium">{permission.title}</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {permission.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {user ? (
                <div className="mt-7 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-white/5">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-violet-100 text-violet-600 grid place-items-center">
                    <UserRound size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('当前登录账号', 'Signed in as')}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {user.displayName ||
                        user.handle ||
                        user.email ||
                        t('GemiGo 用户', 'GemiGo user')}
                    </p>
                  </div>
                  <button
                    disabled={submitting}
                    className="shrink-0 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
                    onClick={async () => {
                      await presenter.auth.logout();
                      presenter.auth.openAuthModal('login');
                    }}
                  >
                    {t('换个账号', 'Switch')}
                  </button>
                </div>
              ) : (
                <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('请先登录 GemiGo，再继续授权。', 'Sign in to GemiGo to continue.')}
                </p>
              )}
              <div className="mt-5 space-y-2">
                {authLoading ? (
                  <p role="status" className="py-3 text-center text-sm text-slate-500">
                    {t('正在恢复登录状态…', 'Checking your session…')}
                  </p>
                ) : user ? (
                  <button
                    className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-700 flex items-center justify-center gap-2`}
                    onClick={authorize}
                    disabled={submitting}
                  >
                    {submitting
                      ? t('正在返回应用…', 'Returning to app…')
                      : context.previouslyGranted
                        ? t('继续登录', 'Continue')
                        : t('同意并返回应用', 'Allow and return to app')}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <>
                    <button
                      className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-700`}
                      onClick={() => presenter.auth.openAuthModal('login')}
                    >
                      {t('用邮箱登录', 'Continue with email')}
                    </button>
                    <div className="flex gap-2">
                      <button
                        className={`${buttonClass} border border-slate-200 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5`}
                        onClick={() => presenter.auth.loginWithGoogle()}
                      >
                        Google
                      </button>
                      <button
                        className={`${buttonClass} border border-slate-200 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-white/5`}
                        onClick={() => presenter.auth.loginWithGithub()}
                      >
                        GitHub
                      </button>
                    </div>
                  </>
                )}
                <button
                  className={`${buttonClass} text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5`}
                  onClick={() => returnToApp(undefined, true)}
                  disabled={submitting}
                >
                  {t('取消，返回应用', 'Cancel and return to app')}
                </button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-violet-100 text-violet-600">
                {finished ? <Check /> : <LockKeyhole />}
              </div>
              <h1 className="text-xl font-bold">
                {finished
                  ? t('可以返回应用了', 'Return to your application')
                  : t('无法继续授权', 'Unable to authorize')}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {finished
                  ? t(
                      '请关闭此窗口。若登录没有完成，请从应用重新登录。',
                      'Close this window. Restart login from the app if needed.'
                    )
                  : t(
                      '链接可能已过期，或应用来源不匹配。请从应用重新发起登录。',
                      'The request may have expired or the application origin does not match. Restart login from the app.'
                    )}
              </p>
              <a
                className="mt-5 inline-block text-sm text-violet-600 dark:text-violet-400"
                href={context?.origin || '/'}
              >
                {t('返回', 'Go back')}
              </a>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700 dark:bg-red-400/10 dark:text-red-300"
            >
              {error}
            </p>
          )}
        </section>
        <footer className="mt-6 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <p className="flex items-center justify-center gap-1.5">
            <LockKeyhole size={12} />
            {t(
              '由 GemiGo 安全连接你的账号与应用',
              'GemiGo securely connects your account to this application'
            )}
          </p>
          <p className="mt-2">
            {t(
              '你的密码和上游 API 密钥不会提供给应用。',
              'Your password and upstream API keys are never shared with the app.'
            )}
          </p>
        </footer>
      </div>
    </main>
  );
}
