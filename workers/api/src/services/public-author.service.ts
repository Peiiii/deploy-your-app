import type { PublicAuthorIdentity } from '@gemigo/public-author';
import { resolvePublicAuthorIdentity } from '@gemigo/public-author';
import { authRepository } from '../repositories/auth.repository';
import type { Project } from '../types/project';
import type { User } from '../types/user';

/** Owns the server-side public identity policy for users and projects. */
export class PublicAuthorService {
  resolveForUser = (user: Pick<User, 'id' | 'handle' | 'displayName'>): PublicAuthorIdentity =>
    resolvePublicAuthorIdentity({
      ownerId: user.id,
      handle: user.handle,
      displayName: user.displayName,
    });

  enrichProjects = async (db: D1Database, projects: Project[]): Promise<Project[]> => {
    const ownerIds = Array.from(
      new Set(
        projects
          .map((project) => project.ownerId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const users = await authRepository.findUsersByIds(db, ownerIds);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return projects.map((project) => {
      const user = project.ownerId ? usersById.get(project.ownerId) : undefined;
      const publicAuthor = resolvePublicAuthorIdentity({
        ownerId: project.ownerId,
        displayName: user?.displayName,
        handle: user?.handle,
        projectId: project.id,
        sourceType: project.sourceType,
        repoUrl: project.repoUrl,
      });

      return {
        ...project,
        publicAuthor,
        // Preserve the old flat fields while clients migrate to publicAuthor.
        ownerHandle: publicAuthor.handle,
        ownerDisplayName:
          publicAuthor.kind === 'profile' &&
          publicAuthor.label !== (publicAuthor.handle ? `@${publicAuthor.handle}` : null)
            ? publicAuthor.label
            : null,
      };
    });
  };
}

export const publicAuthorService = new PublicAuthorService();
