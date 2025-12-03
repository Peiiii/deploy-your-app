import { randomUUID } from 'crypto';
import type { Project } from './types.js';
import { slugify } from './utils.js';
import { DEPLOY_TARGET, APPS_ROOT_DOMAIN } from './config.js';
import {
  createProjectRecord,
  type CreateProjectRecordInput,
  getAllProjects,
} from './projectRepository.js';

export function getProjects(): Project[] {
  return getAllProjects();
}

interface CreateProjectInput {
  name: string;
  sourceType?: 'github' | 'zip';
  identifier: string;
}

export function createProject({
  name,
  sourceType,
  identifier,
}: CreateProjectInput): Project {
  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = slugify(name);

  // For local deployments, we can compute the URL eagerly.
  // For R2 deployments, the public URL is also deterministic:
  //   https://<slug>.<APPS_ROOT_DOMAIN>/
  // For legacy Cloudflare Pages deployments, the final URL is only known
  // after the first successful deploy, so we leave it undefined and let the
  // deployment pipeline fill it in.
  let url: string | undefined;
  if (DEPLOY_TARGET === 'local') {
    url = `/apps/${encodeURIComponent(slug)}/`;
  } else if (DEPLOY_TARGET === 'r2') {
    url = `https://${slug}.${APPS_ROOT_DOMAIN}/`;
  }

  const project: Project = {
    id,
    name,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: 'Live',
    url,
    framework: 'Unknown',
    deployTarget: DEPLOY_TARGET,
  };
  const recordInput: CreateProjectRecordInput = {
    id,
    name,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: project.status,
    url,
    framework: project.framework,
    deployTarget: project.deployTarget,
  };

  // Persist to the local SQLite database so that project list survives
  // backend restarts during development.
  createProjectRecord(recordInput);

  return project;
}
