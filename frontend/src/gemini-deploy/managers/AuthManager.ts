import { APP_CONFIG } from '../constants';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const API_BASE = APP_CONFIG.API_BASE_URL.replace(/\/+$/, '');

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
    const redirect = window.location.href;
    window.location.href = `${API_BASE}/auth/google/start?redirect=${encodeURIComponent(
      redirect,
    )}`;
  };

  loginWithGithub = (): void => {
    const redirect = window.location.href;
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
