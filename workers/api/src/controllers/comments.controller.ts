import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, readJson } from '../utils/http';
import { ValidationError } from '../utils/error-handler';
import { validateOptionalString, validateRequiredString } from '../utils/validation';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { configService } from '../services/config.service';
import { commentService } from '../services/comment.service';

type Viewer = { userId: string; isAdmin: boolean } | null;

async function resolveViewer(
  request: Request,
  env: ApiWorkerEnv,
  db: D1Database,
): Promise<Viewer> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const sessionWithUser = await authRepository.getSessionWithUser(db, sessionId);
  if (!sessionWithUser) return null;

  const isAdmin = configService.isAdminUser(sessionWithUser.user, env);
  return { userId: sessionWithUser.user.id, isAdmin };
}

class CommentsController {
  // GET /api/v1/projects/:id/comments?page=&pageSize=
  async listProjectComments(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)),
    );

    const viewer = await resolveViewer(request, env, db);
    const result = await commentService.listProjectComments(db, projectId, {
      page,
      pageSize,
      viewer,
    });
    return jsonResponse(result);
  }

  // POST /api/v1/projects/:id/comments
  async createProjectComment(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ): Promise<Response> {
    const viewer = await resolveViewer(request, env, db);
    if (!viewer) {
      return jsonResponse({ error: 'Login required.', code: 'UNAUTHORIZED' }, 401);
    }

    const body = await readJson(request);
    const content = validateRequiredString(body.content, 'content');
    const replyToCommentId =
      validateOptionalString(body.replyToCommentId) ?? null;

    if (replyToCommentId && replyToCommentId.length > 128) {
      throw new ValidationError('replyToCommentId is invalid');
    }

    const comment = await commentService.createProjectComment(db, projectId, {
      userId: viewer.userId,
      isAdmin: viewer.isAdmin,
      content,
      replyToCommentId,
    });
    return jsonResponse({ comment });
  }

  // DELETE /api/v1/comments/:id
  async deleteComment(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    commentId: string,
  ): Promise<Response> {
    const viewer = await resolveViewer(request, env, db);
    if (!viewer) {
      return jsonResponse({ error: 'Login required.', code: 'UNAUTHORIZED' }, 401);
    }

    await commentService.deleteComment(db, commentId, viewer);
    return jsonResponse({ ok: true });
  }
}

export const commentsController = new CommentsController();

