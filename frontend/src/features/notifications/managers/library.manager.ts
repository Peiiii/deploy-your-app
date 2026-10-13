import { unfollowUser } from '@/services/http/follow-api';
import { createStore } from 'zustand/vanilla';
import { notificationRequest } from './notifications.manager';
export interface LibraryItem {
  id: string;
  name?: string;
  url?: string;
  handle?: string;
  display_name?: string;
  description?: string;
  published_at?: number;
}
export class LibraryManager {
  readonly store = createStore<{
    items: LibraryItem[];
    loading: boolean;
    error: string | null;
    cursor: string | number | null;
  }>(() => ({ items: [], loading: false, error: null, cursor: null }));
  private generation = 0;
  load = async (kind: string, append = false) => {
    const previous = this.store.getState();
    if (append && previous.loading) return false;
    const generation = ++this.generation;
    this.store.setState({
      loading: true,
      error: null,
      ...(!append ? { items: [], cursor: null } : {}),
    });
    const path =
      kind === 'favorites'
        ? '/me/favorites'
        : kind === 'followers'
          ? '/me/followers'
          : kind === 'following'
            ? '/me/following'
            : '/me/following/publications';
    try {
      const data = await notificationRequest<{
        items: LibraryItem[];
        cursor?: string | number | null;
      }>(
        path + (append && previous.cursor ? '?before=' + encodeURIComponent(previous.cursor) : '')
      );
      if (generation !== this.generation) return false;
      this.store.setState({
        items: append
          ? [
              ...previous.items,
              ...data.items.filter((item) => !previous.items.some((old) => old.id === item.id)),
            ]
          : data.items,
        cursor: data.cursor ?? null,
      });
      return true;
    } catch (error) {
      if (generation === this.generation)
        this.store.setState({ error: error instanceof Error ? error.message : 'Request failed' });
      return false;
    } finally {
      if (generation === this.generation) this.store.setState({ loading: false });
    }
  };
  unfollow = async (identifier: string) => {
    const generation = this.generation;
    await unfollowUser(identifier);
    if (generation !== this.generation) return;
    await this.load('following');
  };
  dispose = () => {
    this.generation++;
    this.store.setState({ items: [], loading: false, cursor: null, error: null });
  };
}
