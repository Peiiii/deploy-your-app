import { createStore } from 'zustand/vanilla';
import { createProjectComment, deleteComment, fetchProjectComments } from '@/services/http/comments-api';
import type { ProjectComment } from '@/types';

interface PreviewCommentsState {
  items: ProjectComment[];
  total: number;
  page: number;
  loading: boolean;
  submitting: boolean;
  deletingId: string | null;
  error: boolean;
  draft: string;
  replyTo: ProjectComment | null;
}

/** One preview session; request generations prevent late reads replacing newer state. */
export class PreviewCommentsManager {
  readonly store = createStore<PreviewCommentsState>(() => ({
    items: [], total: 0, page: 0, loading: false, submitting: false,
    deletingId: null, error: false, draft: '', replyTo: null,
  }));
  private generation = 0;

  constructor(
    private readonly projectId: string,
    private readonly requireLogin: (force?: boolean) => boolean,
  ) {}

  setDraft = (draft: string) => this.store.setState({ draft });
  reply = (replyTo: ProjectComment | null) => this.store.setState({ replyTo });

  load = async (append = false) => {
    const state = this.store.getState();
    if (state.submitting || state.deletingId || (append && state.loading)) return;
    const generation = ++this.generation;
    const page = append ? state.page + 1 : 1;
    this.store.setState({ loading: true, error: false });
    try {
      const data = await fetchProjectComments(this.projectId, { page, pageSize: 30 });
      if (generation !== this.generation) return;
      this.store.setState((current) => ({
        items: append
          ? [...current.items, ...data.items.filter(item => !current.items.some(existing => existing.id === item.id))]
          : data.items,
        total: data.total, page,
      }));
    } catch {
      if (generation === this.generation) this.store.setState({ error: true });
    } finally {
      if (generation === this.generation) this.store.setState({ loading: false });
    }
  };

  submit = async () => {
    const state = this.store.getState();
    const content = state.draft.trim();
    if (!content || content.length > 500 || state.submitting || state.loading || state.deletingId) return;
    if (!this.requireLogin()) return;
    const generation = ++this.generation;
    this.store.setState({ submitting: true, error: false });
    try {
      const created = await createProjectComment(this.projectId, {
        content, replyToCommentId: state.replyTo?.id ?? null,
      });
      if (generation !== this.generation) return;
      this.store.setState(current => ({
        items: [created, ...current.items], total: current.total + 1,
        draft: '', replyTo: null,
      }));
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof Error && error.message === 'unauthorized') this.requireLogin(true);
      this.store.setState({ error: true });
    } finally {
      if (generation === this.generation) this.store.setState({ submitting: false });
    }
  };

  remove = async (comment: ProjectComment) => {
    const state = this.store.getState();
    if (!comment.canDelete || state.deletingId || state.submitting || state.loading) return;
    if (!this.requireLogin()) return;
    const generation = ++this.generation;
    this.store.setState({ deletingId: comment.id, error: false });
    try {
      await deleteComment(comment.id);
      if (generation !== this.generation) return;
      this.store.setState(current => ({
        items: current.items.filter(item => item.id !== comment.id),
        total: Math.max(0, current.total - 1),
        replyTo: current.replyTo?.id === comment.id ? null : current.replyTo,
        deletingId: null,
      }));
      await this.load();
    } catch (error) {
      if (generation === this.generation && error instanceof Error && error.message === 'unauthorized') this.requireLogin(true);
      if (generation === this.generation) this.store.setState({ error: true });
    } finally {
      if (generation === this.generation) this.store.setState({ deletingId: null });
    }
  };

  invalidate = () => {
    ++this.generation;
    this.store.setState({ items: [], total: 0, page: 0, loading: false, submitting: false, deletingId: null, replyTo: null, error: false });
  };
}
