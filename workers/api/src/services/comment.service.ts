import { commentRepository } from '../repositories/comment.repository';
import { projectService } from './project.service';
import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../utils/error-handler';
import type { ProjectComment } from '../types/comment';

type ViewerContext =
  | {
      userId: string;
      isAdmin: boolean;
    }
  | null;

const MAX_COMMENT_LENGTH = 500;
const MIN_SECONDS_BETWEEN_COMMENTS = 2;

function applyViewerPermissions(
  comment: ProjectComment,
  viewer: ViewerContext,
): ProjectComment {
  if (!viewer) {
    return { ...comment, canDelete: false };
  }
  return {
    ...comment,
    canDelete: viewer.isAdmin || viewer.userId === comment.author.id,
  };
}

class CommentService {
  async listProjectComments(
    db: D1Database,
    projectId: string,
    input: { page: number; pageSize: number; viewer: ViewerContext },
  ): Promise<{
    items: ProjectComment[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const page = Math.max(1, input.page);
    const pageSize = Math.min(50, Math.max(1, input.pageSize));
    const offset = (page - 1) * pageSize;

    const [total, items] = await Promise.all([
      commentRepository.countCommentsForProject(db, projectId),
      commentRepository.listCommentsForProject(db, projectId, {
        offset,
        limit: pageSize,
      }),
    ]);

    return {
      items: items.map((c) => applyViewerPermissions(c, input.viewer)),
      page,
      pageSize,
      total,
    };
  }

  async createProjectComment(
    db: D1Database,
    projectId: string,
    input: {
      userId: string;
      isAdmin: boolean;
      content: string;
      replyToCommentId: string | null;
    },
  ): Promise<ProjectComment> {
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const content = input.content.trim();
    if (!content) {
      throw new ValidationError('content cannot be empty');
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      throw new ValidationError(
        `content must be at most ${MAX_COMMENT_LENGTH} characters`,
      );
    }

    const latest = await commentRepository.getLatestCommentTimestampForUser(
      db,
      input.userId,
    );
    if (latest) {
      const latestMs = Date.parse(latest);
      if (Number.isFinite(latestMs)) {
        const secondsSince = (Date.now() - latestMs) / 1000;
        if (secondsSince < MIN_SECONDS_BETWEEN_COMMENTS) {
          throw new RateLimitError('Please wait before posting again.');
        }
      }
    }

    let replyToCommentId: string | null = null;
    if (input.replyToCommentId) {
      const target = await commentRepository.findCommentForReplyValidation(
        db,
        { commentId: input.replyToCommentId, projectId },
      );
      if (!target) {
        throw new ValidationError('replyToCommentId is invalid');
      }
      replyToCommentId = input.replyToCommentId;
    }

    const id = crypto.randomUUID();
    await commentRepository.insertComment(db, {
      id,
      projectId,
      userId: input.userId,
      content,
      replyToCommentId,
    });

    const comment = await commentRepository.getCommentById(db, id);
    if (!comment) {
      throw new Error('Failed to create comment');
    }

    return applyViewerPermissions(comment, {
      userId: input.userId,
      isAdmin: input.isAdmin,
    });
  }

  async deleteComment(
    db: D1Database,
    commentId: string,
    input: { userId: string; isAdmin: boolean },
  ): Promise<void> {
    const owner = await commentRepository.getCommentOwner(db, commentId);
    if (!owner) {
      throw new NotFoundError('Comment not found');
    }
    if (!input.isAdmin && owner.userId !== input.userId) {
      throw new ValidationError('No permission to delete this comment');
    }
    await commentRepository.softDeleteComment(db, commentId);
  }
}

export const commentService = new CommentService();

