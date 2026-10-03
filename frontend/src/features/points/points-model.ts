import { createStore } from 'zustand/vanilla';
import { APP_CONFIG } from '@/constants';
export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'repeatable' | 'durable' | 'term';
  price: number;
  entitlement: string;
  units: number;
  period_seconds: number;
  delivery: 'grant' | 'ai';
  enabled: number;
}
export interface Sale {
  id: string;
  name: string;
  status: string;
  price: number;
  paid_minor: number;
  creator_minor: number;
  currency: string;
  created_at: number;
  app_name?: string;
  app_url?: string;
  error?: string;
  result?: string;
}
export interface Wallet {
  balance: number;
  trial: number;
  settings: {
    trial_points: number;
    trial_budget: number;
    trial_issued: number;
    live_payments: number;
  };
  lots: { id: string; kind: string; total: number; remaining: number; created_at: number }[];
  receipts: Sale[];
  subscriptions: { id: string; name: string; app_name: string; active: number; due_at: number }[];
  paymentStatus: string;
}
export interface AuthorPoints {
  items: Item[];
  sales: Sale[];
  cashEnabled: boolean;
}
export interface Confirmation {
  serviceInput: { topic: string } | null;
  intent: { id: string; state: string; origin: string; request_id: string };
  item: Item;
  app: { name: string };
  balance: { balance: number };
  receipt: { status: string; id: string } | null;
  expired: boolean;
}
interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
}
export class PointsModel<T> {
  readonly store = createStore<ResourceState<T>>(() => ({
    data: null,
    loading: true,
    busy: false,
    error: null,
    notice: null,
  }));
  constructor(readonly path: string) {}
  async api<R>(path: string, body?: unknown, method = 'POST'): Promise<R> {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/points${path}`, {
      credentials: 'include',
      method: body ? method : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = (await response.json()) as R & { error?: string };
    if (!response.ok) throw new Error(result.error || '请求失败');
    return result;
  }
  async load() {
    this.store.setState({ loading: true, error: null });
    try {
      this.store.setState({ data: await this.api<T>(this.path) });
    } catch (error) {
      this.store.setState({ error: error instanceof Error ? error.message : '加载失败' });
    } finally {
      this.store.setState({ loading: false });
    }
  }
  async action(path: string, body: unknown, notice: string, method = 'POST') {
    if (this.store.getState().busy) return null;
    this.store.setState({ busy: true, error: null, notice: null });
    try {
      const result = await this.api<unknown>(path, body, method);
      await this.load();
      this.store.setState({ notice });
      return result;
    } catch (error) {
      this.store.setState({ error: error instanceof Error ? error.message : '操作失败' });
      return null;
    } finally {
      this.store.setState({ busy: false });
    }
  }
  async confirm(subscribe: boolean) {
    const data = this.store.getState().data as Confirmation | null;
    if (!data) return;
    const result = await this.action(
      `${this.path}/confirm`,
      { subscribe },
      '消费已提交，可以返回应用。'
    );
    if (result && window.opener)
      window.opener.postMessage(
        { type: 'gemigo:points-result', state: data.intent.state, intentId: data.intent.id },
        data.intent.origin
      );
  }
}
