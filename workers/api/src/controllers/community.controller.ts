import type { ApiWorkerEnv } from '../types/env';
import type { CommunityViewer, FeedbackCategory, FeedbackStatus } from '../types/community';
import { authRepository } from '../repositories/auth.repository';
import { communityService } from '../services/community.service';
import { configService } from '../services/config.service';
import { UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { jsonResponse, readJson } from '../utils/http';
import { validateRequiredString } from '../utils/validation';

class CommunityController {
  private resolveViewer = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database
  ): Promise<CommunityViewer | null> => {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) return null;
    const session = await authRepository.getSessionWithUser(db, sessionId);
    if (!session) return null;
    return {
      userId: session.user.id,
      isAdmin: configService.isAdminUser(session.user, env),
    };
  };

  private requireViewer = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database
  ): Promise<CommunityViewer> => {
    const viewer = await this.resolveViewer(request, env, db);
    if (!viewer) throw new UnauthorizedError('Login required.');
    return viewer;
  };

  listPosts = async (request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> => {
    const url = new URL(request.url);
    const categoryRaw = url.searchParams.get('category');
    const statusRaw = url.searchParams.get('status');
    if (categoryRaw && !communityService.isCategory(categoryRaw)) {
      throw new ValidationError('category is invalid');
    }
    if (statusRaw && !communityService.isStatus(statusRaw)) {
      throw new ValidationError('status is invalid');
    }
    const viewer = await this.requireViewer(request, env, db);
    const result = await communityService.listPosts(db, {
      viewer,
      category: categoryRaw as FeedbackCategory | null,
      status: statusRaw as FeedbackStatus | null,
      page: Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1),
      pageSize: Math.min(
        50,
        Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20)
      ),
    });
    return jsonResponse(result);
  };

  createPost = async (request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    const body = await readJson(request);
    const title = validateRequiredString(body.title, 'title');
    const content = validateRequiredString(body.content, 'content');
    const rawCategory = typeof body.category === 'string' ? body.category.trim() : '';
    if (rawCategory && !communityService.isCategory(rawCategory)) {
      throw new ValidationError('category is invalid');
    }
    const post = await communityService.createPost(db, {
      viewer,
      title,
      content,
      category: rawCategory ? (rawCategory as FeedbackCategory) : null,
    });
    return jsonResponse({ post }, 201);
  };

  updateStatus = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    postId: string
  ): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    const body = await readJson(request);
    const status = validateRequiredString(body.status, 'status');
    if (!communityService.isStatus(status)) {
      throw new ValidationError('status is invalid');
    }
    const post = await communityService.updateStatus(db, postId, viewer, status);
    return jsonResponse({ post });
  };

  deletePost = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    postId: string
  ): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    await communityService.deletePost(db, postId, viewer);
    return jsonResponse({ ok: true });
  };

  listComments = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    postId: string
  ): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    return jsonResponse(await communityService.listComments(db, postId, viewer));
  };

  createComment = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    postId: string
  ): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    const body = await readJson(request);
    const content = validateRequiredString(body.content, 'content');
    const comment = await communityService.createComment(db, postId, viewer, content);
    return jsonResponse({ comment }, 201);
  };

  deleteComment = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    commentId: string
  ): Promise<Response> => {
    const viewer = await this.requireViewer(request, env, db);
    await communityService.deleteComment(db, commentId, viewer);
    return jsonResponse({ ok: true });
  };
}

export const communityController = new CommunityController();
