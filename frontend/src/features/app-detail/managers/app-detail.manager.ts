import { createStore } from 'zustand/vanilla';
import { APP_CONFIG } from '@/constants';
import type { PublicApp } from '@/types';

interface AppDetailState {
  app: PublicApp | null;
  loading: boolean;
  error: 'not-found' | 'network' | null;
}

export class AppDetailManager {
  readonly store = createStore<AppDetailState>(() => ({ app: null, loading: true, error: null }));
  private request: AbortController | null = null;

  constructor(private readonly id: string) {}

  load = async () => {
    this.cancel();
    const request = new AbortController();
    this.request = request;
    this.store.setState({ app: null, loading: true, error: null });
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/apps/${encodeURIComponent(this.id)}`, {
        signal: request.signal,
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'not-found' : 'network');
      const { app } = await response.json() as { app: PublicApp };
      if (this.request === request) this.store.setState({ app, loading: false });
    } catch (error) {
      if (this.request !== request) return;
      this.store.setState({ loading: false, error: error instanceof Error && error.message === 'not-found' ? 'not-found' : 'network' });
    }
  };

  cancel = () => {
    this.request?.abort();
    this.request = null;
  };
}
