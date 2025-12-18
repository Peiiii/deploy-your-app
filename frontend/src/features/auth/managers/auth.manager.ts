import { APP_CONFIG } from '@/constants';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import type { User } from '@/types';

const API_BASE = APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');
const DESKTOP_DEEP_LINK = 'gemigo-desktop://auth';

const isDesktopShell = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const searchParams = new URLSearchParams(window.location.search);
  return ua.includes('Electron') || searchParams.get('desktop') === '1';
};

const getRedirectTarget = (): string =>
  isDesktopShell() ? DESKTOP_DEEP_LINK : window.location.href;

// Manager for auth-related actions. State is kept in the auth store; this
// class only coordinates side-effects and updates the store.
export class AuthManager {
  // -------------------
  // Session / identity
  // -------------------

  loadCurrentUser = async (): Promise<void> => {
    useAuthStore.setState({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/me`, {
        credentials: 'include',
      });
      if (!res.ok) {
        // Treat non-OK as "not logged in" for now.
        useAuthStore.setState({ user: null, isLoading: false });
        return;
      }
      const data = (await res.json()) as { user: User | null };
      useAuthStore.setState({
        user: data.user ?? null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Failed to load current user', err);
      useAuthStore.setState({
        user: null,
        isLoading: false,
        error: 'failed_to_load_user',
      });
    }
  };

  getCurrentUser = (): User | null => {
    return useAuthStore.getState().user;
  };

  updateHandle = async (handle: string): Promise<void> => {
    const trimmed = handle.trim();
    if (!trimmed) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/me/handle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: trimmed }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | { user?: User; error?: string }
        | undefined;

      if (!res.ok || !data?.user) {
        const message =
          data?.error ||
          (res.status === 409
            ? 'Handle 已被占用，请换一个。'
            : '更新 Handle 失败，请稍后再试。');
        throw new Error(message);
      }

      useAuthStore.setState({
        user: data.user,
      });
    } catch (err) {
      console.error('Failed to update handle', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('更新 Handle 失败，请稍后再试。');
    }
  };

  logout = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to logout', err);
    } finally {
      useAuthStore.setState({ user: null });
    }
  };

  // -------------------
  // OAuth helpers
  // -------------------

  loginWithGoogle = (): void => {
    const redirect = getRedirectTarget();
    window.location.href = `${API_BASE}/auth/google/start?redirect=${encodeURIComponent(
      redirect,
    )}`;
  };

  loginWithGithub = (): void => {
    const redirect = getRedirectTarget();
    window.location.href = `${API_BASE}/auth/github/start?redirect=${encodeURIComponent(
      redirect,
    )}`;
  };

  // -------------------
  // Email/password modal
  // -------------------

  openAuthModal = (mode: 'login' | 'signup'): void => {
    const state = useAuthStore.getState();
    useAuthStore.setState({
      modalOpen: true,
      mode,
      error: null,
      // 保留当前 email，减少重复输入；密码重置
      email: state.email,
      password: '',
      confirmPassword: '',
      passwordVisible: false,
      confirmPasswordVisible: false,
    });
  };

  closeAuthModal = (): void => {
    useAuthStore.setState({
      modalOpen: false,
      password: '',
      confirmPassword: '',
      isSubmitting: false,
      error: null,
    });
  };

  setEmail = (email: string): void => {
    useAuthStore.setState({ email, error: null });
  };

  setPassword = (password: string): void => {
    useAuthStore.setState({ password, error: null });
  };

  setConfirmPassword = (password: string): void => {
    useAuthStore.setState({ confirmPassword: password, error: null });
  };

  togglePasswordVisible = (): void => {
    const { passwordVisible } = useAuthStore.getState();
    useAuthStore.setState({ passwordVisible: !passwordVisible });
  };

  toggleConfirmPasswordVisible = (): void => {
    const { confirmPasswordVisible } = useAuthStore.getState();
    useAuthStore.setState({ confirmPasswordVisible: !confirmPasswordVisible });
  };

  private validateEmailAndPassword = (): { ok: boolean } => {
    const { email, password, confirmPassword, mode } = useAuthStore.getState();

    if (!email.trim() || !password.trim()) {
      useAuthStore.setState({
        error: 'Email 和密码不能为空。',
      });
      return { ok: false };
    }

    if (mode === 'signup') {
      if (!confirmPassword.trim()) {
        useAuthStore.setState({
          error: '请再次输入密码。',
        });
        return { ok: false };
      }
      if (password !== confirmPassword) {
        useAuthStore.setState({
          error: '两次输入的密码不一致。',
        });
        return { ok: false };
      }
      if (password.trim().length < 8) {
        useAuthStore.setState({
          error: '密码长度至少为 8 位。',
        });
        return { ok: false };
      }
    }

    return { ok: true };
  };

  submitEmailLogin = async (): Promise<void> => {
    if (!this.validateEmailAndPassword().ok) return;

    const { email, password } = useAuthStore.getState();
    useAuthStore.setState({ isSubmitting: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/auth/email/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | { user?: User; error?: string }
        | undefined;

      if (!res.ok || !data?.user) {
        useAuthStore.setState({
          isSubmitting: false,
          error: data?.error || '登录失败，请检查邮箱和密码。',
        });
        return;
      }

      useAuthStore.setState({
        user: data.user,
        modalOpen: false,
        isSubmitting: false,
        password: '',
        error: null,
      });
    } catch (err) {
      console.error('Email login failed', err);
      useAuthStore.setState({
        isSubmitting: false,
        error: '网络错误，请稍后再试。',
      });
    }
  };

  submitEmailSignup = async (): Promise<void> => {
    if (!this.validateEmailAndPassword().ok) return;

    const { email, password } = useAuthStore.getState();
    useAuthStore.setState({ isSubmitting: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/auth/email/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as
        | { user?: User; error?: string }
        | undefined;

      if (!res.ok || !data?.user) {
        useAuthStore.setState({
          isSubmitting: false,
          error: data?.error || '注册失败，请稍后再试。',
        });
        return;
      }

      useAuthStore.setState({
        user: data.user,
        modalOpen: false,
        isSubmitting: false,
        password: '',
        error: null,
      });
    } catch (err) {
      console.error('Email signup failed', err);
      useAuthStore.setState({
        isSubmitting: false,
        error: '网络错误，请稍后再试。',
      });
    }
  };
}
