import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, readJson } from '../utils/http';
import { getSessionIdFromRequest } from '../utils/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/error-handler';
import { authRepository } from '../repositories/auth.repository';
import { projectService } from '../services/project.service';
import { sdkCloudRepository, type CloudDbPermissionMode } from '../repositories/sdk-cloud.repository';
import { parseSecurityRulesV0 } from '../utils/sdk-cloud-rules';

function normalizeSlug(raw: string, label: string): string {
  const value = String(raw ?? '').trim();
  if (!value) throw new ValidationError(`${label} is required`);
  if (value.length > 64) throw new ValidationError(`${label} is too long`);
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(value)) throw new ValidationError(`${label} is invalid`);
  return value;
}

function normalizeCollection(raw: string): string {
  return normalizeSlug(raw, 'collection');
}

function normalizeDbPermissionMode(raw: unknown): CloudDbPermissionMode {
  const mode = typeof raw === 'string' ? raw.trim() : '';
  if (
    mode === 'all_read_creator_write' ||
    mode === 'creator_read_write' ||
    mode === 'all_read_readonly' ||
    mode === 'none'
  ) {
    return mode;
  }
  throw new ValidationError('invalid permission mode');
}

class CloudDbSettingsController {
  private requireProjectOwner = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectId: string,
  ) => {
    const sessionId = getSessionIdFromRequest(request);
    if (!sessionId) {
      throw new UnauthorizedError('Login required.');
    }
    const sessionWithUser = await authRepository.getSessionWithUser(db, sessionId);
    if (!sessionWithUser) {
      throw new UnauthorizedError('Login required.');
    }

    const project = await projectService.getProjectById(db, projectId);
    if (!project) throw new NotFoundError('Project not found');
    if (!project.ownerId || project.ownerId !== sessionWithUser.user.id) {
      throw new UnauthorizedError('Only the project owner can manage Cloud DB settings.');
    }

    const appId = project.slug ? normalizeSlug(project.slug, 'project.slug') : null;
    if (!appId) {
      throw new ValidationError('Project slug is required to configure Cloud DB (appId).');
    }

    return { user: sessionWithUser.user, project, appId };
  };

  getCollectionPermission = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);
    const row = await sdkCloudRepository.getDbCollectionPermission(db, { appId, collection });
    return jsonResponse({
      projectId,
      appId,
      collection,
      mode: row?.mode ?? 'creator_read_write',
      updatedAt: row?.updatedAt ?? null,
    });
  };

  listCollections = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);

    const items = await sdkCloudRepository.listDbCollections(db, { appId });

    return jsonResponse({
      projectId,
      appId,
      items: items.map((entry) => ({
        collection: entry.collection,
        permission: entry.permission
          ? { mode: entry.permission.mode, updatedAt: entry.permission.updatedAt, isOverridden: true }
          : { mode: 'creator_read_write', updatedAt: null, isOverridden: false },
        rules: entry.rules
          ? { hasRules: true, updatedAt: entry.rules.updatedAt }
          : { hasRules: false, updatedAt: null },
      })),
    });
  };

  ensureCollection = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);

    const row = await sdkCloudRepository.ensureDbCollection(db, { appId, collection, now: Date.now() });

    return jsonResponse({
      projectId,
      appId: row.appId,
      collection: row.collection,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  };

  getCollectionFields = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);

    const url = new URL(request.url);
    const sampleRaw = url.searchParams.get('sample');
    const sampleLimit = sampleRaw ? Number(sampleRaw) : undefined;

    const res = await sdkCloudRepository.listDbCollectionFields(db, { appId, collection, sampleLimit });

    return jsonResponse({
      projectId,
      appId,
      collection,
      totalDocs: res.totalDocs,
      sampledDocs: res.sampledDocs,
      fields: res.fields,
      inferredAt: Date.now(),
    });
  };

  setCollectionPermission = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);

    await sdkCloudRepository.ensureDbCollection(db, { appId, collection, now: Date.now() });

    const body = (await readJson(request)) as { mode?: unknown };
    const mode = normalizeDbPermissionMode(body?.mode);

    const row = await sdkCloudRepository.setDbCollectionPermission(db, {
      appId,
      collection,
      mode,
      updatedAt: Date.now(),
    });

    return jsonResponse({
      projectId,
      appId: row.appId,
      collection: row.collection,
      mode: row.mode,
      updatedAt: row.updatedAt,
    });
  };

  deleteCollectionPermission = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);
    await sdkCloudRepository.deleteDbCollectionPermission(db, { appId, collection });
    return new Response(null, { status: 204 });
  };

  getCollectionSecurityRules = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);
    const row = await sdkCloudRepository.getDbCollectionSecurityRules(db, { appId, collection });
    return jsonResponse({
      projectId,
      appId,
      collection,
      rules: row ? (JSON.parse(row.rulesJson) as unknown) : null,
      updatedAt: row?.updatedAt ?? null,
    });
  };

  setCollectionSecurityRules = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);

    await sdkCloudRepository.ensureDbCollection(db, { appId, collection, now: Date.now() });

    const body = (await readJson(request)) as { rules?: unknown };
    const rules = parseSecurityRulesV0(body?.rules);
    const rulesJson = JSON.stringify(rules);
    if (rulesJson.length > 32 * 1024) throw new ValidationError('rules too large');

    const row = await sdkCloudRepository.setDbCollectionSecurityRules(db, {
      appId,
      collection,
      rulesJson,
      updatedAt: Date.now(),
    });

    return jsonResponse({
      projectId,
      appId: row.appId,
      collection: row.collection,
      rules,
      updatedAt: row.updatedAt,
    });
  };

  deleteCollectionSecurityRules = async (
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    projectIdRaw: string,
    collectionRaw: string,
  ): Promise<Response> => {
    const projectId = String(projectIdRaw ?? '').trim();
    if (!projectId) throw new ValidationError('projectId is required');
    const collection = normalizeCollection(collectionRaw);
    const { appId } = await this.requireProjectOwner(request, env, db, projectId);
    await sdkCloudRepository.deleteDbCollectionSecurityRules(db, { appId, collection });
    return new Response(null, { status: 204 });
  };
}

export const cloudDbSettingsController = new CloudDbSettingsController();
