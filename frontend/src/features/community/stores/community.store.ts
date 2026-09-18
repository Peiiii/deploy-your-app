import { create } from 'zustand';
import type { FeedbackCategory, FeedbackComment, FeedbackPost, FeedbackStatus } from '@/types';

interface CommunityState {
  posts: FeedbackPost[];
  total: number;
  categoryFilter: FeedbackCategory | null;
  statusFilter: FeedbackStatus | null;
  isLoading: boolean;
  error: string | null;
  composerOpen: boolean;
  composerTitle: string;
  composerContent: string;
  composerCategory: FeedbackCategory | null;
  isSubmitting: boolean;
  expandedPostId: string | null;
  commentsByPost: Record<string, FeedbackComment[]>;
  loadingCommentsPostId: string | null;
  commentDrafts: Record<string, string>;
  submittingCommentPostId: string | null;
  actions: {
    setPosts: (posts: FeedbackPost[], total: number) => void;
    replacePost: (post: FeedbackPost) => void;
    removePost: (postId: string) => void;
    setCategoryFilter: (category: FeedbackCategory | null) => void;
    setStatusFilter: (status: FeedbackStatus | null) => void;
    clearPrivateFeedback: () => void;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setComposerOpen: (open: boolean) => void;
    setComposerTitle: (title: string) => void;
    setComposerContent: (content: string) => void;
    setComposerCategory: (category: FeedbackCategory | null) => void;
    setIsSubmitting: (submitting: boolean) => void;
    resetComposer: () => void;
    setExpandedPostId: (postId: string | null) => void;
    setComments: (postId: string, comments: FeedbackComment[]) => void;
    appendComment: (postId: string, comment: FeedbackComment) => void;
    removeComment: (postId: string, commentId: string) => void;
    setLoadingCommentsPostId: (postId: string | null) => void;
    setCommentDraft: (postId: string, content: string) => void;
    setSubmittingCommentPostId: (postId: string | null) => void;
  };
}

export const useCommunityStore = create<CommunityState>((set) => ({
  posts: [],
  total: 0,
  categoryFilter: null,
  statusFilter: null,
  isLoading: false,
  error: null,
  composerOpen: false,
  composerTitle: '',
  composerContent: '',
  composerCategory: null,
  isSubmitting: false,
  expandedPostId: null,
  commentsByPost: {},
  loadingCommentsPostId: null,
  commentDrafts: {},
  submittingCommentPostId: null,
  actions: {
    setPosts: (posts, total) => set({ posts, total }),
    replacePost: (post) =>
      set((state) => ({
        posts: state.posts.map((item) => (item.id === post.id ? post : item)),
      })),
    removePost: (postId) =>
      set((state) => ({
        posts: state.posts.filter((post) => post.id !== postId),
        total: Math.max(0, state.total - 1),
        expandedPostId: state.expandedPostId === postId ? null : state.expandedPostId,
      })),
    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    setStatusFilter: (statusFilter) => set({ statusFilter }),
    clearPrivateFeedback: () =>
      set({
        posts: [],
        total: 0,
        error: null,
        composerOpen: false,
        composerTitle: '',
        composerContent: '',
        composerCategory: null,
        isSubmitting: false,
        expandedPostId: null,
        commentsByPost: {},
        loadingCommentsPostId: null,
        commentDrafts: {},
        submittingCommentPostId: null,
      }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    setComposerOpen: (composerOpen) => set({ composerOpen }),
    setComposerTitle: (composerTitle) => set({ composerTitle }),
    setComposerContent: (composerContent) => set({ composerContent }),
    setComposerCategory: (composerCategory) => set({ composerCategory }),
    setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
    resetComposer: () =>
      set({
        composerOpen: false,
        composerTitle: '',
        composerContent: '',
        composerCategory: null,
        isSubmitting: false,
      }),
    setExpandedPostId: (expandedPostId) => set({ expandedPostId }),
    setComments: (postId, comments) =>
      set((state) => ({
        commentsByPost: { ...state.commentsByPost, [postId]: comments },
      })),
    appendComment: (postId, comment) =>
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [postId]: [...(state.commentsByPost[postId] ?? []), comment],
        },
        posts: state.posts.map((post) =>
          post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post
        ),
      })),
    removeComment: (postId, commentId) =>
      set((state) => ({
        commentsByPost: {
          ...state.commentsByPost,
          [postId]: (state.commentsByPost[postId] ?? []).filter(
            (comment) => comment.id !== commentId
          ),
        },
        posts: state.posts.map((post) =>
          post.id === postId
            ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) }
            : post
        ),
      })),
    setLoadingCommentsPostId: (loadingCommentsPostId) => set({ loadingCommentsPostId }),
    setCommentDraft: (postId, content) =>
      set((state) => ({
        commentDrafts: { ...state.commentDrafts, [postId]: content },
      })),
    setSubmittingCommentPostId: (submittingCommentPostId) => set({ submittingCommentPostId }),
  },
}));
