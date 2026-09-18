import { communityRepository } from '../repositories/community.repository';
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../utils/error-handler';
import type {
  CommunityViewer,
  FeedbackCategory,
  FeedbackComment,
  FeedbackPost,
  FeedbackStatus,
} from '../types/community';

const FEEDBACK_CATEGORIES: FeedbackCategory[] = ['general', 'idea', 'bug', 'question'];
const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'planned', 'in_progress', 'completed'];
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 3000;
const MAX_COMMENT_LENGTH = 800;
const MIN_SECONDS_BETWEEN_POSTS = 10;
const MIN_SECONDS_BETWEEN_COMMENTS = 2;

class CommunityService {
  isCategory = (value: string): value is FeedbackCategory =>
    FEEDBACK_CATEGORIES.includes(value as FeedbackCategory);

  isStatus = (value: string): value is FeedbackStatus =>
    FEEDBACK_STATUSES.includes(value as FeedbackStatus);

  private withPostPermissions = (
    post: FeedbackPost,
    viewer: CommunityViewer | null
  ): FeedbackPost => ({
    ...post,
    canDelete: Boolean(viewer && (viewer.isAdmin || viewer.userId === post.author.id)),
    canUpdateStatus: Boolean(viewer?.isAdmin),
  });

  private withCommentPermissions = (
    comment: FeedbackComment,
    viewer: CommunityViewer | null
  ): FeedbackComment => ({
    ...comment,
    canDelete: Boolean(viewer && (viewer.isAdmin || viewer.userId === comment.author.id)),
  });

  private assertElapsed = (latestTimestamp: string | null, minimumSeconds: number): void => {
    if (!latestTimestamp) return;
    const latestMs = Date.parse(latestTimestamp);
    if (!Number.isFinite(latestMs)) return;
    if ((Date.now() - latestMs) / 1000 < minimumSeconds) {
      throw new RateLimitError('Please wait before posting again.');
    }
  };

  private assertCanAccessPost = (post: FeedbackPost, viewer: CommunityViewer): void => {
    if (!viewer.isAdmin && post.author.id !== viewer.userId) {
      throw new ForbiddenError('You do not have access to this feedback.');
    }
  };

  listPosts = async (
    db: D1Database,
    input: {
      viewer: CommunityViewer;
      category: FeedbackCategory | null;
      status: FeedbackStatus | null;
      page: number;
      pageSize: number;
    }
  ): Promise<{
    items: FeedbackPost[];
    page: number;
    pageSize: number;
    total: number;
  }> => {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(50, Math.max(1, input.pageSize));
    const result = await communityRepository.listPosts(db, {
      ownerId: input.viewer.isAdmin ? null : input.viewer.userId,
      category: input.category,
      status: input.status,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    return {
      items: result.items.map((post) => this.withPostPermissions(post, input.viewer)),
      page,
      pageSize,
      total: result.total,
    };
  };

  createPost = async (
    db: D1Database,
    input: {
      viewer: CommunityViewer;
      title: string;
      content: string;
      category: FeedbackCategory | null;
    }
  ): Promise<FeedbackPost> => {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title || title.length > MAX_TITLE_LENGTH) {
      throw new ValidationError(`title must be between 1 and ${MAX_TITLE_LENGTH} characters`);
    }
    if (!content || content.length > MAX_CONTENT_LENGTH) {
      throw new ValidationError(`content must be between 1 and ${MAX_CONTENT_LENGTH} characters`);
    }
    if (input.category && !this.isCategory(input.category)) {
      throw new ValidationError('category is invalid');
    }

    const latest = await communityRepository.getLatestPostTimestampForUser(db, input.viewer.userId);
    this.assertElapsed(latest, MIN_SECONDS_BETWEEN_POSTS);

    const id = crypto.randomUUID();
    await communityRepository.createPost(db, {
      id,
      userId: input.viewer.userId,
      title,
      content,
      category: input.category ?? 'general',
    });
    const post = await communityRepository.getPostById(db, id);
    if (!post) throw new Error('Failed to create feedback');
    return this.withPostPermissions(post, input.viewer);
  };

  updateStatus = async (
    db: D1Database,
    postId: string,
    viewer: CommunityViewer,
    status: FeedbackStatus
  ): Promise<FeedbackPost> => {
    if (!viewer.isAdmin) {
      throw new ForbiddenError('Only administrators can update feedback status');
    }
    if (!this.isStatus(status)) {
      throw new ValidationError('status is invalid');
    }
    const existing = await communityRepository.getPostById(db, postId);
    if (!existing) throw new NotFoundError('Feedback not found');

    await communityRepository.updateStatus(db, postId, status);
    const updated = await communityRepository.getPostById(db, postId);
    if (!updated) throw new NotFoundError('Feedback not found');
    return this.withPostPermissions(updated, viewer);
  };

  deletePost = async (db: D1Database, postId: string, viewer: CommunityViewer): Promise<void> => {
    const post = await communityRepository.getPostById(db, postId);
    if (!post) throw new NotFoundError('Feedback not found');
    if (!viewer.isAdmin && post.author.id !== viewer.userId) {
      throw new ForbiddenError('No permission to delete this feedback');
    }
    await communityRepository.softDeletePost(db, postId);
  };

  listComments = async (
    db: D1Database,
    postId: string,
    viewer: CommunityViewer
  ): Promise<{ items: FeedbackComment[] }> => {
    const post = await communityRepository.getPostById(db, postId);
    if (!post) throw new NotFoundError('Feedback not found');
    this.assertCanAccessPost(post, viewer);
    const items = await communityRepository.listComments(db, postId);
    return {
      items: items.map((comment) => this.withCommentPermissions(comment, viewer)),
    };
  };

  createComment = async (
    db: D1Database,
    postId: string,
    viewer: CommunityViewer,
    rawContent: string
  ): Promise<FeedbackComment> => {
    const post = await communityRepository.getPostById(db, postId);
    if (!post) throw new NotFoundError('Feedback not found');
    this.assertCanAccessPost(post, viewer);

    const content = rawContent.trim();
    if (!content || content.length > MAX_COMMENT_LENGTH) {
      throw new ValidationError(`content must be between 1 and ${MAX_COMMENT_LENGTH} characters`);
    }

    const latest = await communityRepository.getLatestCommentTimestampForUser(db, viewer.userId);
    this.assertElapsed(latest, MIN_SECONDS_BETWEEN_COMMENTS);

    const id = crypto.randomUUID();
    await communityRepository.createComment(db, {
      id,
      postId,
      userId: viewer.userId,
      content,
    });
    const comment = await communityRepository.getCommentById(db, id);
    if (!comment) throw new Error('Failed to create feedback comment');
    return this.withCommentPermissions(comment, viewer);
  };

  deleteComment = async (
    db: D1Database,
    commentId: string,
    viewer: CommunityViewer
  ): Promise<void> => {
    const comment = await communityRepository.getCommentById(db, commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    const post = await communityRepository.getPostById(db, comment.postId);
    if (!post) throw new NotFoundError('Feedback not found');
    this.assertCanAccessPost(post, viewer);
    if (!viewer.isAdmin && comment.author.id !== viewer.userId) {
      throw new ForbiddenError('No permission to delete this comment');
    }
    await communityRepository.softDeleteComment(db, commentId);
  };
}

export const communityService = new CommunityService();
