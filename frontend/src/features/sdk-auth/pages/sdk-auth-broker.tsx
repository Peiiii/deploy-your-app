import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { sdkAuthorize } from '@/services/http/sdk-auth-api';

function parseScopes(raw: string | null): string[] {
  if (!raw) return ['identity:basic'];
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ['identity:basic'];
}

function requireParam(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length > 512) return null;
  return trimmed;
}

function isAllowedOpenerOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return false;
    }
    if (url.protocol === 'https:' && !url.hostname.endsWith('.gemigo.app')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function SdkAuthBrokerPage(): JSX.Element {
  const presenter = usePresenter();
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const query = useMemo(() => {
    const appId = requireParam(params.get('app_id') ?? params.get('appId'));
    const rawScopes = params.get('scope') ?? params.get('scopes');
    const scopes = parseScopes(rawScopes);
    const pkceChallenge =
      requireParam(params.get('code_challenge') ?? params.get('codeChallenge'));
    const pkceMethod = (params.get('code_challenge_method') ?? 'S256').trim();
    const clientState = requireParam(params.get('state'));
    const openerOrigin = requireParam(params.get('origin'));

    return {
      appId,
      scopes,
      pkceChallenge,
      pkceMethod,
      clientState,
      openerOrigin,
    };
  }, [params]);

  const invalidMessage = useMemo(() => {
    if (!query.appId || !query.pkceChallenge || !query.clientState || !query.openerOrigin) {
      return 'Missing required query params. Please retry login from the app.';
    }
    if (query.pkceMethod !== 'S256') {
      return 'Unsupported PKCE method.';
    }
    if (!isAllowedOpenerOrigin(query.openerOrigin)) {
      return 'Invalid opener origin.';
    }
    return null;
  }, [query]);

  useEffect(() => {
    // Ensure we have current session in this popup window.
    void presenter.auth.loadCurrentUser();
  }, [presenter.auth]);

  const postToOpener = (payload: unknown) => {
    if (!window.opener || !query.openerOrigin) return;
    window.opener.postMessage(payload, query.openerOrigin);
  };

  const onAllow = async () => {
    setSubmitError(null);
    if (!query.appId || !query.pkceChallenge || !query.clientState) return;

    setSubmitting(true);
    try {
      const { code, expiresIn } = await sdkAuthorize({
        appId: query.appId,
        scopes: query.scopes,
        codeChallenge: query.pkceChallenge,
      });

      postToOpener({
        type: 'gemigo:sdk-auth-code',
        code,
        expiresIn,
        state: query.clientState,
        appId: query.appId,
        scopes: query.scopes,
      });

      window.close();
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        presenter.auth.openAuthModal('login');
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to authorize';
      postToOpener({
        type: 'gemigo:sdk-auth-error',
        error: message,
        state: query.clientState,
      });
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeny = () => {
    if (!query.clientState) return;
    postToOpener({
      type: 'gemigo:sdk-auth-error',
      error: 'access_denied',
      state: query.clientState,
    });
    window.close();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-sm text-white/60">GemiGo</div>
          <div className="text-xl font-bold">App 授权</div>
        </div>

        {invalidMessage && (
          <div className="text-red-300 text-sm">{invalidMessage}</div>
        )}

        {!invalidMessage && (
          <>
            <div className="rounded-xl border border-white/10 p-4 bg-white/5 space-y-2">
              <div className="text-sm text-white/60">App</div>
              <div className="font-semibold">{query.appId ?? '-'}</div>
              <div className="text-sm text-white/60 mt-3">Scopes</div>
              <div className="flex flex-wrap gap-2">
                {query.scopes.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {!user && !authLoading && (
              <div className="space-y-3">
                <div className="text-sm text-white/70">
                  需要登录后才能授权此 App。
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    className="flex-1 rounded-xl bg-white text-black font-semibold py-2 hover:bg-white/90"
                    onClick={() => presenter.auth.openAuthModal('login')}
                  >
                    邮箱登录
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-white/10 border border-white/15 font-semibold py-2 hover:bg-white/15"
                    onClick={() => presenter.auth.loginWithGoogle()}
                  >
                    Google 登录
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-white/10 border border-white/15 font-semibold py-2 hover:bg-white/15"
                    onClick={() => presenter.auth.loginWithGithub()}
                  >
                    GitHub 登录
                  </button>
                </div>
              </div>
            )}

            {authLoading && (
              <div className="text-sm text-white/60">加载中…</div>
            )}

            {!!user && !authLoading && (
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-xl bg-white text-black font-semibold py-2 hover:bg-white/90"
                  onClick={onAllow}
                  disabled={submitting}
                >
                  允许
                </button>
                <button
                  className="flex-1 rounded-xl bg-white/10 border border-white/15 font-semibold py-2 hover:bg-white/15"
                  onClick={onDeny}
                  disabled={submitting}
                >
                  拒绝
                </button>
              </div>
            )}

            {submitting && (
              <div className="text-sm text-white/60">处理中…</div>
            )}

            {submitError && (
              <div className="text-sm text-red-300">{submitError}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
