import * as path from 'node:path';
import { GemigoApiClient } from './api.js';
import { loadManifest, resolveManifestPath } from './config.js';
import { loadSession } from './session-store.js';
import { validateStaticDirectory, zipDirectoryToBase64 } from './static-site.js';
import type { CreateProjectPayload, GemigoManifest } from './types.js';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function buildCreateProjectPayload(manifest: GemigoManifest): CreateProjectPayload {
  const defaultEntry = manifest.locales[manifest.defaultLocale];
  return {
    name: defaultEntry.name,
    identifier: `local-static:${manifest.slug ?? slugify(defaultEntry.name)}`,
    sourceType: 'zip',
    isPublic: manifest.visibility === 'public',
    metadata: {
      name: defaultEntry.name,
      ...(manifest.slug ? { slug: manifest.slug } : {}),
      ...(defaultEntry.description
        ? { description: defaultEntry.description }
        : {}),
      category: manifest.category,
      tags: manifest.tags,
      localization: {
        defaultLocale: manifest.defaultLocale,
        locales: manifest.locales,
      },
    },
  };
}

export async function deployStaticApp(options: {
  origin: string;
  dir?: string;
  configPath?: string;
  onOutput?: (line: string) => void;
}): Promise<{
  projectId: string;
  deploymentId: string;
  slug?: string;
  url?: string;
}> {
  const { origin, dir, configPath, onOutput } = options;
  const session = await loadSession();
  if (!session || !session.cookie) {
    throw new Error('Not logged in. Run "gemigo login" first.');
  }
  if (session.origin !== origin) {
    throw new Error(
      `Stored session is for ${session.origin}. Re-run "gemigo login" for ${origin}.`,
    );
  }

  const client = new GemigoApiClient(origin, session.cookie);
  const user = await client.getCurrentUser();
  if (!user) {
    throw new Error('Saved session is no longer valid. Run "gemigo login" again.');
  }

  const resolvedManifestPath = await resolveManifestPath(process.cwd(), configPath);
  const manifest = await loadManifest(resolvedManifestPath);
  const manifestDir = path.dirname(resolvedManifestPath);
  const sourceDir = dir
    ? path.resolve(process.cwd(), dir)
    : manifest.sourceDir
      ? path.resolve(manifestDir, manifest.sourceDir)
      : undefined;

  if (!sourceDir) {
    throw new Error(
      'No static directory provided. Pass a directory argument or set sourceDir in gemigo.app.json.',
    );
  }

  const validation = await validateStaticDirectory(sourceDir);
  onOutput?.(
    `Validated static directory: ${validation.dir} (${validation.fileCount} files)`,
  );

  const zipData = await zipDirectoryToBase64(validation.dir);
  const project = await client.createProject(buildCreateProjectPayload(manifest));
  onOutput?.(`Created project: ${project.name} (${project.id})`);

  const deployment = await client.startDeployment({
    id: project.id,
    sourceType: 'zip',
    zipData,
  });
  onOutput?.(`Started deployment: ${deployment.deploymentId}`);

  const finalStatus = await client.streamDeployment(deployment.deploymentId, {
    onLog: (event) => {
      onOutput?.(`[${event.level ?? 'info'}] ${event.message}`);
    },
    onStatus: (event) => {
      onOutput?.(`Status: ${event.status}`);
    },
  });

  if (finalStatus.status !== 'SUCCESS') {
    throw new Error(
      finalStatus.errorMessage ?? 'Deployment failed without an error message.',
    );
  }

  return {
    projectId: project.id,
    deploymentId: deployment.deploymentId,
    slug: finalStatus.projectMetadata?.slug ?? project.slug,
    url: finalStatus.projectMetadata?.url ?? project.url,
  };
}
