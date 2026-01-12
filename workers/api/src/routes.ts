import type { ApiWorkerEnv } from './types/env';
import { ConfigurationError } from './utils/error-handler';
import { createRouter, type Router } from './utils/routing';
import { deployController } from './controllers/deploy.controller';
import { authController } from './controllers/auth.controller';
import { projectsController } from './controllers/projects.controller';
import { analyticsController } from './controllers/analytics.controller';
import { engagementController } from './controllers/engagement.controller';
import { profileController } from './controllers/profile.controller';
import { adminController } from './controllers/admin.controller';
import { commentsController } from './controllers/comments.controller';
import { sdkAuthController } from './controllers/sdk-auth.controller';
import { sdkCloudController } from './controllers/sdk-cloud.controller';

/**
 * Build the API router for a given request/environment.
 *
 * This centralizes all route definitions so controllers stay focused on
 * business logic, similar to NestJS 模块里集中声明的路由。
 */
export function buildApiRouter(env: ApiWorkerEnv, url: URL): Router {
  const router = createRouter();

  // Lazily resolve D1 binding – only for DB-backed routes.
  const requireDb = (): D1Database => {
    const db = env.PROJECTS_DB;
    if (!db) {
      throw new ConfigurationError(
        'PROJECTS_DB binding is missing in Worker environment.',
      );
    }
    return db;
  };

  // --------------------
  // Deploy routes (proxy to Node deploy service)
  // --------------------
  router.add({
    path: '/api/v1/deploy',
    method: 'POST',
    handler: (req) => deployController.startDeployment(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/analyze',
    method: 'POST',
    handler: (req) => deployController.analyzeSource(req, env),
  });

  router.add({
    path: '/api/v1/deployments/:id/stream',
    method: 'GET',
    handler: (req, params) =>
      deployController.streamDeployment(req, env, params.id),
  });

  // --------------
  // Auth routes
  // --------------
  router.add({
    path: '/api/v1/me',
    method: 'GET',
    handler: (req) => authController.handleMe(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/me/handle',
    method: 'PATCH',
    handler: (req) => authController.handleUpdateHandle(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/logout',
    method: 'POST',
    handler: (req) => authController.handleLogout(req, requireDb()),
  });

  router.add({
    path: '/api/v1/auth/email/signup',
    method: 'POST',
    handler: (req) => authController.handleEmailSignup(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/auth/email/login',
    method: 'POST',
    handler: (req) => authController.handleEmailLogin(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/auth/google/start',
    method: 'GET',
    handler: (req) => {
      void req;
      return authController.handleGoogleStart(env, url);
    },
  });

  router.add({
    path: '/api/v1/auth/google/callback',
    method: 'GET',
    handler: (req) =>
      authController.handleGoogleCallback(req, env, requireDb(), url),
  });

  router.add({
    path: '/api/v1/auth/github/start',
    method: 'GET',
    handler: (req) => {
      void req;
      return authController.handleGithubStart(env, url);
    },
  });

  router.add({
    path: '/api/v1/auth/github/callback',
    method: 'GET',
    handler: (req) =>
      authController.handleGithubCallback(req, env, requireDb(), url),
  });

  router.add({
    path: '/api/v1/auth/desktop/login',
    method: 'GET',
    handler: (req) =>
      authController.handleDesktopLogin(req, env, requireDb()),
  });

  // -----------------
  // Projects routes
  // -----------------
  router.add({
    path: '/api/v1/projects',
    method: 'GET',
    handler: (req) => projectsController.listProjects(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/projects/by-repo',
    method: 'GET',
    handler: (req) =>
      projectsController.findProjectByRepo(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/projects',
    method: 'POST',
    handler: (req) =>
      projectsController.createProject(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/projects/draft',
    method: 'POST',
    handler: (req) =>
      projectsController.createDraftProject(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/projects/explore',
    method: 'GET',
    handler: (req) =>
      projectsController.listExploreProjects(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/projects/:id',
    method: 'PATCH',
    handler: (req, params) =>
      projectsController.updateProject(req, env, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/deployment',
    method: 'PATCH',
    handler: (req, params) =>
      projectsController.updateProjectDeployment(
        req,
        env,
        requireDb(),
        params.id,
      ),
  });

  router.add({
    path: '/api/v1/projects/:id',
    method: 'DELETE',
    handler: (req, params) =>
      projectsController.deleteProject(req, env, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/thumbnail',
    method: 'POST',
    handler: (req, params) =>
      projectsController.uploadThumbnail(req, env, requireDb(), params.id),
  });

  // -----------------
  // Gemigo Cloud (App SDK hosted backend)
  // -----------------
  // Cloud KV (user-private)
  router.add({
    path: '/api/v1/cloud/kv/get',
    method: 'GET',
    handler: (req) => sdkCloudController.kvGet(req, env, requireDb()),
  });
  router.add({
    path: '/api/v1/cloud/kv/set',
    method: 'POST',
    handler: (req) => sdkCloudController.kvSet(req, env, requireDb()),
  });
  router.add({
    path: '/api/v1/cloud/kv/delete',
    method: 'POST',
    handler: (req) => sdkCloudController.kvDelete(req, env, requireDb()),
  });
  router.add({
    path: '/api/v1/cloud/kv/list',
    method: 'GET',
    handler: (req) => sdkCloudController.kvList(req, env, requireDb()),
  });

  // Cloud DB (collections)
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/docs',
    method: 'POST',
    handler: (req, params) =>
      sdkCloudController.dbCreateDoc(req, env, requireDb(), params.collection),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/docs/:id',
    method: 'GET',
    handler: (req, params) =>
      sdkCloudController.dbGetDoc(req, env, requireDb(), params.collection, params.id),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/docs/:id',
    method: 'PATCH',
    handler: (req, params) =>
      sdkCloudController.dbUpdateDoc(req, env, requireDb(), params.collection, params.id),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/docs/:id',
    method: 'PUT',
    handler: (req, params) =>
      sdkCloudController.dbSetDoc(req, env, requireDb(), params.collection, params.id),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/docs/:id',
    method: 'DELETE',
    handler: (req, params) =>
      sdkCloudController.dbDeleteDoc(req, env, requireDb(), params.collection, params.id),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/query',
    method: 'POST',
    handler: (req, params) =>
      sdkCloudController.dbQuery(req, env, requireDb(), params.collection),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/count',
    method: 'POST',
    handler: (req, params) =>
      sdkCloudController.dbCount(req, env, requireDb(), params.collection),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/update',
    method: 'POST',
    handler: (req, params) =>
      sdkCloudController.dbWhereUpdate(req, env, requireDb(), params.collection),
  });
  router.add({
    path: '/api/v1/cloud/db/collections/:collection/remove',
    method: 'POST',
    handler: (req, params) =>
      sdkCloudController.dbWhereRemove(req, env, requireDb(), params.collection),
  });

  // Cloud Blob (signed URLs backed by R2)
  router.add({
    path: '/api/v1/cloud/blob/upload-url',
    method: 'POST',
    handler: (req) => sdkCloudController.blobCreateUploadUrl(req, env, requireDb()),
  });
  router.add({
    path: '/api/v1/cloud/blob/download-url',
    method: 'POST',
    handler: (req) => sdkCloudController.blobGetDownloadUrl(req, env, requireDb()),
  });
  router.add({
    path: '/api/v1/cloud/blob/upload',
    method: 'PUT',
    handler: (req) => sdkCloudController.blobUpload(req, env),
  });
  router.add({
    path: '/api/v1/cloud/blob/download',
    method: 'GET',
    handler: (req) => sdkCloudController.blobDownload(req, env),
  });

  // Cloud Functions (RPC)
  router.add({
    path: '/api/v1/cloud/functions/call',
    method: 'POST',
    handler: (req) => sdkCloudController.functionsCall(req, env, requireDb()),
  });

  // -----------------
  // Admin routes
  // -----------------
  router.add({
    path: '/api/v1/admin/projects',
    method: 'GET',
    handler: (req) => adminController.listProjects(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission',
    method: 'GET',
    handler: (req, params) =>
      adminController.getCloudDbCollectionPermission(req, env, requireDb(), params.appId, params.collection),
  });

  router.add({
    path: '/api/v1/admin/cloud/db/apps/:appId/collections/:collection/permission',
    method: 'PUT',
    handler: (req, params) =>
      adminController.setCloudDbCollectionPermission(req, env, requireDb(), params.appId, params.collection),
  });

  router.add({
    path: '/api/v1/admin/projects/:id',
    method: 'DELETE',
    handler: (req, params) =>
      adminController.softDeleteProject(req, env, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/admin/projects/:id/restore',
    method: 'POST',
    handler: (req, params) =>
      adminController.restoreProject(req, env, requireDb(), params.id),
  });

  // -----------------
  // Analytics routes
  // -----------------

  router.add({
    path: '/api/v1/analytics/ping/:slug',
    method: 'GET',
    handler: (_req, params) =>
      analyticsController.pingPageView(requireDb(), params.slug),
  });

  router.add({
    path: '/api/v1/projects/:id/stats',
    method: 'GET',
    handler: (req, params) =>
      analyticsController.getProjectStats(req, requireDb(), params.id),
  });

  // -----------------
  // Engagement routes (likes / favorites)
  // -----------------

  router.add({
    path: '/api/v1/projects/:id/reactions',
    method: 'GET',
    handler: (req, params) =>
      engagementController.getReactionsForProject(
        req,
        requireDb(),
        params.id,
      ),
  });

  router.add({
    path: '/api/v1/projects/reactions',
    method: 'GET',
    handler: (req) =>
      engagementController.getReactionsForProjectsBulk(req, requireDb()),
  });

  router.add({
    path: '/api/v1/projects/:id/like',
    method: 'POST',
    handler: (req, params) =>
      engagementController.likeProject(req, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/like',
    method: 'DELETE',
    handler: (req, params) =>
      engagementController.unlikeProject(req, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/favorite',
    method: 'POST',
    handler: (req, params) =>
      engagementController.favoriteProject(req, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/favorite',
    method: 'DELETE',
    handler: (req, params) =>
      engagementController.unfavoriteProject(req, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/me/favorites',
    method: 'GET',
    handler: (req) =>
      engagementController.listFavoritesForCurrentUser(
        req,
        requireDb(),
      ),
  });

  // -----------------
  // Comments routes (community discussions)
  // -----------------

  router.add({
    path: '/api/v1/projects/:id/comments',
    method: 'GET',
    handler: (req, params) =>
      commentsController.listProjectComments(req, env, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/projects/:id/comments',
    method: 'POST',
    handler: (req, params) =>
      commentsController.createProjectComment(req, env, requireDb(), params.id),
  });

  router.add({
    path: '/api/v1/comments/:id',
    method: 'DELETE',
    handler: (req, params) =>
      commentsController.deleteComment(req, env, requireDb(), params.id),
  });

  // -----------------
  // SDK Auth routes (App SDK V0)
  // -----------------

  router.add({
    path: '/api/v1/sdk/authorize',
    method: 'POST',
    handler: (req) =>
      sdkAuthController.authorize(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/sdk/token',
    method: 'POST',
    handler: (req) =>
      sdkAuthController.token(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/sdk/me',
    method: 'GET',
    handler: (req) =>
      sdkAuthController.me(req, env, requireDb()),
  });

  router.add({
    path: '/api/v1/sdk/_debug',
    method: 'GET',
    handler: (req) =>
      sdkAuthController.debug(req, env, requireDb()),
  });

  // -----------------
  // Profile routes (community profiles)
  // -----------------

  router.add({
    path: '/api/v1/me/profile',
    method: 'GET',
    handler: (req) => profileController.getMyProfile(req, requireDb()),
  });

  router.add({
    path: '/api/v1/me/profile',
    method: 'PUT',
    handler: (req) => profileController.updateMyProfile(req, requireDb()),
  });

  router.add({
    path: '/api/v1/users/:id/profile',
    method: 'GET',
    handler: (_req, params) =>
      profileController.getPublicProfile(requireDb(), params.id),
  });

  return router;
}
