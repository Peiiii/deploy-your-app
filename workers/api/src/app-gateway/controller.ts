import type { ApiWorkerEnv } from '../types/env';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { sdkAuthService } from '../services/sdk-auth.service';
import { getSessionIdFromRequest } from '../utils/auth';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../utils/error-handler';
import { gatewayJson } from './response';
import { connectionName } from './config';
import { GatewayRepository } from './repository';
import { limitedText } from './body';
import { ticketHash } from './vault';

function object(env: ApiWorkerEnv, projectId: string): DurableObjectStub {
  if (!env.APP_GATEWAY) throw new AppError('App API connections are unavailable.', 503);
  return env.APP_GATEWAY.get(env.APP_GATEWAY.idFromName(projectId));
}
function safeError(error: unknown): Response {
  return gatewayJson(
    {
      error:
        error instanceof AppError
          ? error.message
          : 'The API connection could not complete. Please retry.',
      code: error instanceof AppError ? error.code : 'GATEWAY_ERROR',
    },
    error instanceof AppError ? error.statusCode : 502
  );
}

export const appGatewayController = {
  async deleteProject(env: ApiWorkerEnv, projectId: string, ownerId: string): Promise<Response> {
    return object(env, projectId).fetch(
      new Request('https://gateway.internal/delete-project', {
        method: 'DELETE',
        headers: { 'x-project-id': projectId, 'x-owner-id': ownerId },
      })
    );
  },

  async manage(
    req: Request,
    env: ApiWorkerEnv,
    projectId: string,
    operation: string,
    name = ''
  ): Promise<Response> {
    try {
      const session = getSessionIdFromRequest(req);
      const user = session && (await authRepository.getSessionWithUser(env.PROJECTS_DB, session));
      const project = await projectService.getProjectById(env.PROJECTS_DB, projectId);
      if (!user) throw new UnauthorizedError('Login required.');
      if (!project || project.isDeleted) throw new NotFoundError('Project not found.');
      if (project.ownerId !== user.user.id)
        throw new ForbiddenError('Only the project owner can manage API connections.');
      // Mutations are cookie-authenticated: enforce same-site origin, not merely CORS.
      if (req.method !== 'GET') {
        const origin = req.headers.get('origin');
        const allowed = [new URL(req.url).origin, env.AUTH_REDIRECT_BASE || 'https://gemigo.io'];
        if (origin && !allowed.includes(origin))
          throw new ForbiddenError('Untrusted settings origin.');
        if (!req.headers.get('content-type')?.startsWith('application/json'))
          throw new ValidationError('Send application/json.');
      }
      if (name) connectionName(name);
      if (req.method !== 'GET' && Number(req.headers.get('content-length')) > 131072)
        throw new ValidationError('Settings request is too large.');
      const body = req.method === 'GET' ? undefined : await limitedText(req, 131072);
      if (body && body.length > 131072) throw new ValidationError('Settings request is too large.');
      return await object(env, projectId).fetch(
        new Request(`https://gateway.internal/${operation}/${encodeURIComponent(name)}`, {
          method: req.method,
          headers: { 'x-project-id': projectId, 'content-type': 'application/json' },
          body,
        })
      );
    } catch (error) {
      return safeError(error);
    }
  },

  async tickets(
    req: Request,
    env: ApiWorkerEnv,
    projectId: string,
    name: string
  ): Promise<Response> {
    try {
      connectionName(name);
      const project = await projectService.getProjectById(env.PROJECTS_DB, projectId);
      if (!project || project.isDeleted || project.status !== 'Live')
        throw new NotFoundError('The application is not published.');
      const row = await new GatewayRepository(env.PROJECTS_DB, projectId).connection(name);
      if (!row) throw new NotFoundError('API connection not found.');
      const config = JSON.parse(row.config);
      if (!config.enabled) throw new ForbiddenError('This API connection is disabled.');
      const origin = req.headers.get('origin');
      const appOrigin = project.url && new URL(project.url).origin;
      if (!origin || origin !== appOrigin)
        throw new ForbiddenError('Open this connection from its published application.');
      let subject: string;
      if (req.headers.has('authorization')) {
        const identity = await sdkAuthService.me(req, env.PROJECTS_DB);
        if (identity.appId !== project.slug)
          throw new ForbiddenError('The login belongs to a different application.');
        subject = `user:${identity.appUserId}`;
      } else {
        if (config.access === 'login')
          throw new UnauthorizedError(
            'Log in to this application before using its API connection.'
          );
        const address = req.headers.get('cf-connecting-ip');
        if (!address) throw new ForbiddenError('Anonymous caller identity is unavailable.');
        subject = `anonymous:${await ticketHash(`${env.APP_SECRETS_KEYS}:${projectId}:${address}`)}`;
      }
      const response = await object(env, projectId).fetch(
        new Request(`https://gateway.internal/ticket/${name}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-project-id': projectId },
          body: JSON.stringify({ subject, origin }),
        })
      );
      if (!response.ok) return response;
      const data = (await response.json()) as { ticket: string; expiresAt: number };
      const base = new URL(env.APP_GATEWAY_PUBLIC_ORIGIN || env.AUTH_REDIRECT_BASE || req.url)
        .origin;
      return gatewayJson({
        ...data,
        httpUrl: `${base}/api/v1/gateway/${encodeURIComponent(projectId)}/${name}`,
        websocketUrl: `${base.replace(/^http/, 'ws')}/api/v1/gateway/${encodeURIComponent(projectId)}/${name}`,
      });
    } catch (error) {
      return safeError(error);
    }
  },

  async invoke(
    req: Request,
    env: ApiWorkerEnv,
    projectId: string,
    name: string
  ): Promise<Response> {
    try {
      connectionName(name);
      const url = new URL(req.url);
      const ticket = req.headers.get('x-gemigo-ticket') || url.searchParams.get('ticket');
      if (!ticket || ticket.length > 100)
        throw new UnauthorizedError('A connection ticket is required.');
      const headers = new Headers({
        'x-project-id': projectId,
        'x-gemigo-ticket': ticket,
        origin: req.headers.get('origin') || '',
      });
      if (req.headers.get('upgrade') === 'websocket') headers.set('upgrade', 'websocket');
      if (req.method === 'POST') headers.set('content-type', 'application/json');
      return await object(env, projectId).fetch(
        new Request(`https://gateway.internal/invoke/${name}`, {
          method: req.method,
          headers,
          body: req.method === 'POST' ? req.body : undefined,
        })
      );
    } catch (error) {
      return safeError(error);
    }
  },
};
