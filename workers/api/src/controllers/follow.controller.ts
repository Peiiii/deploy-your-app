import { jsonResponse } from '../utils/http';
import { UnauthorizedError, ValidationError } from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { followService } from '../services/follow.service';

class FollowController {
  private requireAuth = async (
    request: Request,
    db: D1Database,
    action: string,
  ): Promise<{ id: string }> => {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError(`Login required to ${action}.`);
    }

    const session = await authRepository.getSessionWithUser(db, sessionId);
    if (!session) {
      throw new UnauthorizedError(`Login required to ${action}.`);
    }

    return { id: session.user.id };
  };

  getFollowSummary = async (
    request: Request,
    db: D1Database,
    identifier: string,
  ): Promise<Response> => {
    if (!identifier || typeof identifier !== 'string') {
      throw new ValidationError('Invalid user identifier');
    }

    const sessionId = getSessionIdFromRequest(request);
    const viewerId = sessionId
      ? (await authRepository.getSessionWithUser(db, sessionId))?.user.id ?? null
      : null;

    const summary = await followService.getFollowSummary(db, identifier, viewerId);
    return jsonResponse(summary);
  };

  follow = async (
    request: Request,
    db: D1Database,
    identifier: string,
  ): Promise<Response> => {
    if (!identifier || typeof identifier !== 'string') {
      throw new ValidationError('Invalid user identifier');
    }

    const viewer = await this.requireAuth(request, db, 'follow a user');
    const summary = await followService.follow(db, viewer.id, identifier);
    return jsonResponse(summary);
  };

  unfollow = async (
    request: Request,
    db: D1Database,
    identifier: string,
  ): Promise<Response> => {
    if (!identifier || typeof identifier !== 'string') {
      throw new ValidationError('Invalid user identifier');
    }

    const viewer = await this.requireAuth(request, db, 'unfollow a user');
    const summary = await followService.unfollow(db, viewer.id, identifier);
    return jsonResponse(summary);
  };
}

export const followController = new FollowController();

