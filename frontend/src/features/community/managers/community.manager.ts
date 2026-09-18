import i18n from '@/i18n/config';
import type { AuthManager } from '@/features/auth/managers/auth.manager';
import { useCommunityStore } from '@/features/community/stores/community.store';
import type { UIManager } from '@/managers/ui.manager';
import {
  CommunityApiError,
  createFeedbackComment,
  createFeedbackPost,
  deleteFeedbackComment,
  deleteFeedbackPost,
  fetchFeedbackComments,
  fetchFeedbackPosts,
  updateFeedbackStatus,
} from '@/services/http/community-api';
import type { FeedbackStatus } from '@/types';

export class CommunityManager {
  private loadRequestId = 0;

  constructor(
    private readonly authManager: AuthManager,
    private readonly uiManager: UIManager
  ) {}

  private getErrorMessage = (error: unknown): string => {
    if (error instanceof CommunityApiError && error.status === 429) {
      return i18n.t('community.errors.rateLimited');
    }
    if (error instanceof Error && error.message) return error.message;
    return i18n.t('community.errors.generic');
  };

  private requireAuth = (): boolean => {
    if (this.authManager.getCurrentUser()) return true;
    this.authManager.openAuthModal('login');
    this.uiManager.showToast(i18n.t('community.signInPrompt'), 'info');
    return false;
  };

  loadPosts = async (): Promise<void> => {
    const requestId = ++this.loadRequestId;
    const state = useCommunityStore.getState();
    const isAdmin = Boolean(this.authManager.getCurrentUser()?.isAdmin);
    state.actions.setIsLoading(true);
    state.actions.setError(null);
    try {
      const result = await fetchFeedbackPosts({
        category: isAdmin ? (state.categoryFilter ?? undefined) : undefined,
        status: isAdmin ? (state.statusFilter ?? undefined) : undefined,
        page: 1,
        pageSize: 50,
      });
      if (requestId === this.loadRequestId) {
        useCommunityStore.getState().actions.setPosts(result.items, result.total);
      }
    } catch (error) {
      if (requestId === this.loadRequestId) {
        useCommunityStore.getState().actions.setError(this.getErrorMessage(error));
      }
    } finally {
      if (requestId === this.loadRequestId) {
        useCommunityStore.getState().actions.setIsLoading(false);
      }
    }
  };

  clearPrivateFeedback = (): void => {
    this.loadRequestId += 1;
    const actions = useCommunityStore.getState().actions;
    actions.clearPrivateFeedback();
    actions.setIsLoading(false);
  };

  openComposer = (): void => {
    if (!this.requireAuth()) return;
    useCommunityStore.getState().actions.setComposerOpen(true);
  };

  submitPost = async (): Promise<void> => {
    if (!this.requireAuth()) return;
    const state = useCommunityStore.getState();
    if (!state.composerTitle.trim() || !state.composerContent.trim()) {
      this.uiManager.showErrorToast(i18n.t('community.errors.required'));
      return;
    }
    state.actions.setIsSubmitting(true);
    try {
      await createFeedbackPost({
        title: state.composerTitle,
        content: state.composerContent,
        category: state.composerCategory ?? undefined,
      });
      state.actions.resetComposer();
      this.uiManager.showSuccessToast(i18n.t('community.feedbackPublished'));
      await this.loadPosts();
    } catch (error) {
      state.actions.setIsSubmitting(false);
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    }
  };

  setStatus = async (postId: string, status: FeedbackStatus): Promise<void> => {
    try {
      const updated = await updateFeedbackStatus(postId, status);
      useCommunityStore.getState().actions.replacePost(updated);
      this.uiManager.showSuccessToast(i18n.t('community.statusUpdated'));
    } catch (error) {
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    }
  };

  toggleComments = async (postId: string): Promise<void> => {
    const state = useCommunityStore.getState();
    if (state.expandedPostId === postId) {
      state.actions.setExpandedPostId(null);
      return;
    }
    state.actions.setExpandedPostId(postId);
    if (state.commentsByPost[postId]) return;
    state.actions.setLoadingCommentsPostId(postId);
    try {
      const comments = await fetchFeedbackComments(postId);
      state.actions.setComments(postId, comments);
    } catch (error) {
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    } finally {
      state.actions.setLoadingCommentsPostId(null);
    }
  };

  submitComment = async (postId: string): Promise<void> => {
    if (!this.requireAuth()) return;
    const state = useCommunityStore.getState();
    const content = state.commentDrafts[postId]?.trim() ?? '';
    if (!content) return;
    state.actions.setSubmittingCommentPostId(postId);
    try {
      const comment = await createFeedbackComment(postId, content);
      state.actions.appendComment(postId, comment);
      state.actions.setCommentDraft(postId, '');
    } catch (error) {
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    } finally {
      state.actions.setSubmittingCommentPostId(null);
    }
  };

  deletePost = async (postId: string): Promise<void> => {
    const confirmed = await this.uiManager.showConfirm({
      title: i18n.t('community.deleteFeedback'),
      message: i18n.t('community.deleteFeedbackConfirm'),
      primaryLabel: i18n.t('common.delete'),
      secondaryLabel: i18n.t('common.cancel'),
    });
    if (!confirmed) return;
    try {
      await deleteFeedbackPost(postId);
      useCommunityStore.getState().actions.removePost(postId);
    } catch (error) {
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    }
  };

  deleteComment = async (postId: string, commentId: string): Promise<void> => {
    try {
      await deleteFeedbackComment(commentId);
      useCommunityStore.getState().actions.removeComment(postId, commentId);
    } catch (error) {
      this.uiManager.showErrorToast(this.getErrorMessage(error));
    }
  };
}
