import { jsonResponse, readJson } from '../utils/http';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from '../utils/error-handler';
import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import { profileService } from '../services/profile.service';

class ProfileController {
  // GET /api/v1/me/profile
  async getMyProfile(
    request: Request,
    db: D1Database,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to view profile.');
    }

    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to view profile.');
    }

    const profile = await profileService.getOrCreateProfile(
      db,
      sessionWithUser.user.id,
    );

    return jsonResponse({ profile });
  }

  // PUT /api/v1/me/profile
  async updateMyProfile(
    request: Request,
    db: D1Database,
  ): Promise<Response> {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required to update profile.');
    }

    const sessionWithUser = await authRepository.getSessionWithUser(
      db,
      sessionId,
    );
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required to update profile.');
    }

    const body = await readJson(request);

    if (
      body.bio === undefined &&
      body.links === undefined &&
      body.pinnedProjectIds === undefined
    ) {
      throw new ValidationError(
        'At least one of bio, links or pinnedProjectIds must be provided',
      );
    }

    if (
      body.pinnedProjectIds !== undefined &&
      !Array.isArray(body.pinnedProjectIds)
    ) {
      throw new ValidationError('pinnedProjectIds must be an array of IDs');
    }

    if (body.links !== undefined && !Array.isArray(body.links)) {
      throw new ValidationError('links must be an array');
    }

    const profile = await profileService.updateProfile(
      db,
      sessionWithUser.user.id,
      {
        bio: typeof body.bio === 'string' ? body.bio : undefined,
        links: Array.isArray(body.links) ? body.links : undefined,
        pinnedProjectIds: Array.isArray(body.pinnedProjectIds)
          ? body.pinnedProjectIds
          : undefined,
      },
    );

    return jsonResponse({ profile });
  }

  // GET /api/v1/users/:id/profile
  async getPublicProfile(
    request: Request,
    db: D1Database,
    identifier: string,
  ): Promise<Response> {
    if (!identifier || typeof identifier !== 'string') {
      throw new ValidationError('Invalid user identifier');
    }

    const result = await profileService.getPublicProfileByIdentifier(
      db,
      identifier,
    );
    if (!result) {
      throw new NotFoundError('User not found');
    }

    return jsonResponse(result);
  }
}

export const profileController = new ProfileController();
