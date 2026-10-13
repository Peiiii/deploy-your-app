import { createStore } from 'zustand/vanilla';
import type { ProjectComment } from '@/types';
import { PreviewCommentsManager } from '@/features/home/managers/preview-comments.manager';
import { notificationRequest } from './notifications.manager';
interface Context {
  project: { id: string; name: string; url?: string };
  items: ProjectComment[];
  target: ProjectComment | null;
  parent: ProjectComment | null;
  total: number;
  page: number;
}
export class DiscussionManager {
  readonly comments: PreviewCommentsManager;
  readonly store = createStore<{
    project: Context['project'] | null;
    loading: boolean;
    error: string | null;
  }>(() => ({ project: null, loading: false, error: null }));
  private generation = 0;
  constructor(
    private readonly projectId: string,
    requireLogin: (force?: boolean) => boolean
  ) {
    this.comments = new PreviewCommentsManager(projectId, requireLogin);
  }
  load = async (commentId: string | null) => {
    const generation = ++this.generation;
    this.comments.invalidate();
    this.store.setState({ project: null, loading: true, error: null });
    try {
      const context = await notificationRequest<Context>(
        '/projects/' +
          encodeURIComponent(this.projectId) +
          '/comments/context' +
          (commentId ? '?commentId=' + encodeURIComponent(commentId) : '')
      );
      if (generation !== this.generation) return;
      const focused = [context.target, context.parent].filter(
        (item): item is ProjectComment => !!item
      );
      const items = [
        ...focused,
        ...context.items.filter((item) => !focused.some((focus) => focus.id === item.id)),
      ];
      this.comments.store.setState({ items, total: context.total, page: context.page });
      this.store.setState({ project: context.project });
      return true;
    } catch (error) {
      if (generation === this.generation)
        this.store.setState({ error: error instanceof Error ? error.message : 'Request failed' });
      return false;
    } finally {
      if (generation === this.generation) this.store.setState({ loading: false });
    }
  };
  dispose = () => {
    this.generation++;
    this.comments.invalidate();
  };
}
