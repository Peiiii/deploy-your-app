import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  APPS_ROOT_DOMAIN,
  DEPLOY_TARGET,
  CONFIG,
} from './config.js';
import {
  createProjectRecord,
  type CreateProjectRecordInput,
  getAllProjects,
  updateProjectRecord,
} from './projectRepository.js';
import type { Project } from './types.js';
import { slugify } from './utils.js';
import { getAIService } from './ai/aiService.js';

// Type definitions
interface CreateProjectInput {
  name: string;
  sourceType?: 'github' | 'zip';
  identifier: string;
}

export function getProjects(): Project[] {
  return getAllProjects();
}

async function buildClassificationContext(slug: string): Promise<string | null> {
  const appDir = path.join(CONFIG.paths.staticRoot, slug);
  const snippets: string[] = [];

  try {
    const indexPath = path.join(appDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = await fs.promises.readFile(indexPath, 'utf8');
      const trimmed = html.slice(0, 1500);
      snippets.push(`index.html (first ${trimmed.length} chars):\n${trimmed}`);
    }

    const fileNames: string[] = [];
    try {
      const entries = await fs.promises.readdir(appDir, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
        fileNames.push(name);
        if (fileNames.length >= 20) break;
      }
    } catch {
      // If the directory doesn't exist (e.g. R2 deploy target), skip filenames.
    }

    if (fileNames.length > 0) {
      snippets.push(`Top-level files:\n${fileNames.join(', ')}`);
    }
  } catch (err) {
    console.error('Failed to build AI classification context:', err);
  }

  if (snippets.length === 0) return null;

  const combined = snippets.join('\n\n');
  return combined.length > 2000 ? combined.slice(0, 2000) : combined;
}

export async function createProject({
  name,
  sourceType,
  identifier,
}: CreateProjectInput): Promise<Project> {
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

  // Default metadata when AI is unavailable or fails.
  let finalName = name;
  let category = 'Other';
  let tags: string[] = [];
  let description: string | undefined;

  const aiService = getAIService();
  const context = await buildClassificationContext(slug);
  // Try to classify with platform AI; fall back silently on failure.
  const aiResult = await aiService.classifyProjectCategoryAndTags(
    name,
    identifier,
    context ?? undefined,
  );
  if (aiResult.name && aiResult.name.trim().length > 0) {
    finalName = aiResult.name.trim();
  }
  if (aiResult.category) {
    category = aiResult.category;
  }
  if (aiResult.tags && aiResult.tags.length > 0) {
    tags = aiResult.tags;
  }
  if (aiResult.description && aiResult.description.trim().length > 0) {
    description = aiResult.description.trim();
  }

  const project: Project = {
    id,
    name: finalName,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: 'Live',
    url,
    description,
    framework: 'Unknown',
    category,
    tags,
    deployTarget: DEPLOY_TARGET,
  };
  const recordInput: CreateProjectRecordInput = {
    id,
    name: finalName,
    repoUrl: identifier,
    sourceType,
    lastDeployed: now,
    status: project.status,
    url,
    description,
    framework: project.framework,
    category,
    tags,
    deployTarget: project.deployTarget,
  };

  // Persist to the local SQLite database so that project list survives
  // backend restarts during development.
  createProjectRecord(recordInput);

  return project;
}

export function updateProject(
  id: string,
  input: {
    name?: string;
    repoUrl?: string;
    description?: string;
    category?: string;
    tags?: string[];
  },
): Project | null {
  return updateProjectRecord(id, input);
}
