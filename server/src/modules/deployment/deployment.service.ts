import * as path from 'path';
import * as fs from 'fs';
import {
  deployments,
  analysisSessions,
} from './state.js';
import { CONFIG, DEPLOY_TARGET } from '../../common/config/config.js';
import { applyFixesForDeployment } from './fixPipeline.js';
import { deployToCloudflarePages } from './providers/cloudflarePagesProvider.js';
import { deployToR2 } from './providers/r2Provider.js';
import { SourceType } from '../../common/types.js';

import {
  appendLog,
  updateStatus,
  broadcastEvent,
  setDeploymentStage,
} from './pipeline/deploymentEvents.js';
import { materializeSourceForDeployment } from './pipeline/sourceMaterialization.js';
import {
  copyDir,
  runCommand,
  deployToLocalStatic,
} from './pipeline/deploymentBuild.js';
import {
  findAIClientFile,
  prepareAnalysisSession,
} from './pipeline/analysisSession.js';
import {
  metadataService,
  type ResolvedProjectMetadata,
} from '../metadata/index.js';

export {
  appendLog,
  updateStatus,
  broadcastEvent,
  setDeploymentStage,
  copyDir,
  runCommand,
  findAIClientFile,
  prepareAnalysisSession,
};

type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface PackageManagerInfo {
  name: PackageManagerName;
  reason: string;
}

function detectPackageManager(workDir: string): PackageManagerInfo {
  // 1) package.json "packageManager" field, e.g. "pnpm@9.12.0"
  const packageJsonPath = path.join(workDir, 'package.json');
  try {
    if (fs.existsSync(packageJsonPath)) {
      const raw = fs.readFileSync(packageJsonPath, 'utf8');
      const pkg = JSON.parse(raw) as { packageManager?: unknown };
      if (typeof pkg.packageManager === 'string') {
        const [rawName] = pkg.packageManager.split('@');
        const name = rawName.trim();
        if (name === 'pnpm' || name === 'yarn' || name === 'bun' || name === 'npm') {
          return {
            name,
            reason: `packageManager field: ${pkg.packageManager}`,
          };
        }
      }
    }
  } catch {
    // Ignore parse / fs errors and fall back to lockfile detection.
  }

  // 2) Lockfiles
  const lockCandidates: Array<{ name: PackageManagerName; file: string }> = [
    { name: 'pnpm', file: 'pnpm-lock.yaml' },
    { name: 'yarn', file: 'yarn.lock' },
    { name: 'bun', file: 'bun.lockb' },
    { name: 'npm', file: 'package-lock.json' },
    { name: 'npm', file: 'npm-shrinkwrap.json' },
  ];

  for (const candidate of lockCandidates) {
    const lockPath = path.join(workDir, candidate.file);
    if (fs.existsSync(lockPath)) {
      return {
        name: candidate.name,
        reason: `lockfile: ${candidate.file}`,
      };
    }
  }

  // 3) Fallback to npm as the most universally available choice.
  return {
    name: 'npm',
    reason: 'default: no packageManager field or known lockfile',
  };
}

export class DeploymentService {
  private accepting = true;
  private pending = 0;
  private tail: Promise<void> = Promise.resolve();

  pendingCount(): number { return this.pending; }

  setAccepting(value: boolean): void { this.accepting = value; }

  canAccept(): boolean { return this.accepting && this.pending < 5; }

  runDeployment(id: string): Promise<void> {
    this.pending++;
    const run = this.tail.then(() => this.executeDeployment(id));
    this.tail = run.catch(() => {});
    return run.finally(() => { this.pending--; });
  }

  private async executeDeployment(id: string): Promise<void> {
    const deployment = deployments.get(id);
    if (!deployment) return;

    const project = deployment.project;
    const normalizedSourceType = project.sourceType ?? SourceType.GitHub;
    project.sourceType = normalizedSourceType;
    const analysisId = project.analysisId;
    const hadSlugFromClient =
      typeof project.slug === 'string' && project.slug.trim().length > 0;
    let slug = hadSlugFromClient ? project.slug!.trim() : undefined;
    project.slug = slug;
    project.category = project.category ?? 'Other';
    project.tags = project.tags ?? [];

    // Reuse an existing prepared repo when analysis has been run, otherwise create a fresh workdir.
    const isFromAnalysis = Boolean(deployment.workDir);
    let workDir = deployment.workDir;
    if (!workDir) {
      workDir = path.join(CONFIG.paths.buildsRoot, id);
      deployment.workDir = workDir;
    }

    let metadataForClient: ResolvedProjectMetadata | null = null;

    try {
      setDeploymentStage(id, 'source');
      updateStatus(id, 'BUILDING');
      appendLog(id, `Starting deployment for "${project.name}"`, 'info');
      if (analysisId) {
        appendLog(id, `Using analysis session ${analysisId} (precomputed metadata/workdir).`, 'info');
      }

      const needsMetadata =
        !slug ||
        !project.description ||
        !project.category ||
        !project.tags ||
        project.tags.length === 0;

      if (needsMetadata) {
        appendLog(
          id,
          'Generating project metadata (name, slug, tags) from source content...',
          'info',
        );
        const previousName = project.name;
        const previousSlug = slug;
        metadataForClient = await metadataService.ensureProjectMetadata({
          seedName: project.name,
          identifier: project.repoUrl,
          sourceType: normalizedSourceType,
          htmlContent: project.htmlContent,
          workDir,
        });
        project.name = metadataForClient.name;
        // Preserve caller-provided slug once it exists; metadata generation is
        // primarily used to fill missing descriptive fields.
        project.slug = slug || metadataForClient.slug;
        project.description = metadataForClient.description;
        project.category = metadataForClient.category;
        project.tags = metadataForClient.tags;
        slug = project.slug;

        if (
          metadataForClient.name !== previousName &&
          typeof previousName === 'string' &&
          previousName.trim().length > 0
        ) {
          appendLog(
            id,
            `AI renamed project to "${metadataForClient.name}".`,
            'info',
          );
        }
        if (metadataForClient.slug !== previousSlug) {
          appendLog(
            id,
            `Using AI-generated slug "${metadataForClient.slug}" for deployment.`,
            'info',
          );
        }
      }

      if (!slug) {
        throw new Error(
          'Slug could not be determined during deployment. Please set a slug and retry.',
        );
      }

      appendLog(id, `Resolved slug: "${slug}"`, 'info');

      if (isFromAnalysis) {
        appendLog(id, `Reusing prepared repository at ${workDir}`, 'info');
      } else {
        await materializeSourceForDeployment(id, project, workDir);
      }

      await applyFixesForDeployment(id, workDir);

      const hasPackageJson = fs.existsSync(path.join(workDir, 'package.json'));
      const packageJson = hasPackageJson ? JSON.parse(fs.readFileSync(path.join(workDir, 'package.json'), 'utf8')) : null;
      const treatAsStatic = project.sourceType === SourceType.Html || !hasPackageJson || !packageJson?.scripts?.build;
      setDeploymentStage(id, treatAsStatic ? 'validate' : 'install', treatAsStatic ? 'static' : 'build');

      let distPath: string | null = null;

      if (treatAsStatic) {
        appendLog(
          id,
          'Using ready static assets; no install/build is needed.',
          'info',
        );
        distPath = workDir;
      } else {
        const packageManager = detectPackageManager(workDir);
        appendLog(
          id,
          `Detected package manager: ${packageManager.name} (${packageManager.reason})`,
          'info',
        );

        const installEnv =
          packageManager.name === 'npm' || packageManager.name === 'pnpm'
            ? { npm_config_production: 'false' }
            : undefined;

        if (packageManager.name === 'pnpm') {
          appendLog(id, 'Installing dependencies with pnpm', 'info');
          await runCommand(id, 'pnpm', ['install'], {
            cwd: workDir,
            env: installEnv,
          });

          setDeploymentStage(id, 'build');
          appendLog(id, 'Building project (pnpm run build)', 'info');
          await runCommand(id, 'pnpm', ['run', 'build'], { cwd: workDir });
        } else if (packageManager.name === 'yarn') {
          appendLog(id, 'Installing dependencies with yarn', 'info');
          await runCommand(id, 'yarn', ['install'], {
            cwd: workDir,
          });

          setDeploymentStage(id, 'build');
          appendLog(id, 'Building project (yarn build)', 'info');
          await runCommand(id, 'yarn', ['build'], { cwd: workDir });
        } else if (packageManager.name === 'bun') {
          appendLog(id, 'Installing dependencies with bun', 'info');
          await runCommand(id, 'bun', ['install'], {
            cwd: workDir,
          });

          setDeploymentStage(id, 'build');
          appendLog(id, 'Building project (bun run build)', 'info');
          await runCommand(id, 'bun', ['run', 'build'], { cwd: workDir });
        } else {
          appendLog(id, 'Installing dependencies with npm', 'info');
          await runCommand(id, 'npm', ['install'], {
            cwd: workDir,
            env: installEnv,
          });

          setDeploymentStage(id, 'build');
          appendLog(id, 'Building project (npm run build)', 'info');
          await runCommand(id, 'npm', ['run', 'build'], { cwd: workDir });
        }

        const candidates = ['dist', 'build', 'out'];

        for (const candidate of candidates) {
          const full = path.join(workDir, candidate);
          if (fs.existsSync(full)) {
            distPath = full;
            break;
          }
        }
      }

      if (!distPath) {
        throw new Error(
          'Could not find build output directory (tried dist/, build/, out/)',
        );
      }

      setDeploymentStage(id, 'validate');
      const outputRelative = path.relative(fs.realpathSync(workDir), fs.realpathSync(distPath));
      if (outputRelative.startsWith('..') || path.isAbsolute(outputRelative)) throw new Error('Build output must remain inside the project directory.');
      if (!fs.existsSync(path.join(distPath, 'index.html')) || !fs.lstatSync(path.join(distPath, 'index.html')).isFile()) {
        throw Object.assign(new Error('No index.html found in the published directory. Upload the built dist/build/out folder, or provide a build script that produces index.html.'), { code: 'missing_entry' });
      }
      if (treatAsStatic && /<script\b[^>]*\bsrc\s*=\s*["'][^"']*\.(?:tsx?|jsx)(?:[?#][^"']*)?["']/i.test(fs.readFileSync(path.join(distPath, 'index.html'), 'utf8'))) {
        throw Object.assign(new Error('This is source code that requires a build. Add a package.json build script, or upload the built dist/build/out directory.'), { code: 'missing_build_script' });
      }
      let outputBytes = 0, outputFiles = 0;
      const checkOutput = async (directory: string): Promise<void> => {
        for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await checkOutput(file);
          else if (entry.isFile()) {
            outputFiles++; outputBytes += (await fs.promises.stat(file)).size;
            if (outputFiles > 10000 || outputBytes > 500 * 1024 * 1024) throw Object.assign(new Error('Published assets exceed 500 MB or 10,000 files. Remove unused assets and dependencies.'), { code: 'archive_too_large' });
          }
        }
      };
      await checkOutput(distPath);
      await applyFixesForDeployment(id, workDir, distPath);

      const target = project.deployTarget || DEPLOY_TARGET;

      setDeploymentStage(id, 'publish');
      updateStatus(id, 'DEPLOYING');
      appendLog(id, `Using deploy target: ${target}`, 'info');

      let finalUrl: string;
      let providerUrl: string | undefined;
      let cloudflareProjectName: string | undefined;

      if (target === 'cloudflare') {
        const result = await deployToCloudflarePages({
          slug,
          distPath,
          log: (message, level = 'info') => appendLog(id, message, level),
        });
        finalUrl = result.publicUrl;
        providerUrl = result.providerUrl;
        cloudflareProjectName = result.projectName;
      } else if (target === 'r2') {
        const result = await deployToR2({
          slug,
          distPath,
          deploymentId: id,
          log: (message, level = 'info') => appendLog(id, message, level),
        });
        finalUrl = result.publicUrl;
        providerUrl = `r2://${result.storagePrefix}`;
      } else {
        finalUrl = await deployToLocalStatic({
          deploymentId: id,
          slug,
          distPath,
        });
      }

      project.url = finalUrl;
      project.deployTarget = target;
      if (providerUrl) {
        project.providerUrl = providerUrl;
      }
      if (cloudflareProjectName) {
        project.cloudflareProjectName = cloudflareProjectName;
      }

      appendLog(
        id,
        `Deployment complete. App is available at ${finalUrl}`,
        'success',
      );

      const successMetadata = metadataForClient
        ? {
            ...metadataForClient,
            slug,
          }
        : {
            name: project.name,
            slug,
            description: project.description,
            category: project.category ?? 'Other',
            tags: project.tags ?? [],
          };

      updateStatus(id, 'SUCCESS', { stage: 'complete', buildMode: deployment.buildMode,
        projectMetadata: {
          ...successMetadata,
          url: finalUrl,
        },
      });
    } catch (err: unknown) {
      const errorMessage =
        err && (err as Error).message ? (err as Error).message : String(err);
      appendLog(
        id,
        `Deployment failed: ${errorMessage}`,
        'error',
      );
      const errorCode = (err as { code?: string })?.code ?? `${deployment.stage ?? 'source'}_failed`;
      updateStatus(id, 'FAILED', { errorMessage, errorCode, stage: deployment.stage, buildMode: deployment.buildMode });
    } finally {
      if (analysisId && analysisSessions.has(analysisId)) {
        analysisSessions.delete(analysisId);
      }

      // Terminal receipts own history; release live payloads from memory.
      deployments.delete(id);
      // Best-effort cleanup of the per-deployment working directory so we don't
      // accumulate cloned repos / node_modules under data/builds over time.
      if (workDir) {
        try {
          const buildsRoot = path.resolve(CONFIG.paths.buildsRoot);
          const normalizedWorkDir = path.resolve(workDir);

          // Guard against accidentally deleting outside the configured builds root.
          if (normalizedWorkDir.startsWith(buildsRoot)) {
            await fs.promises.rm(normalizedWorkDir, {
              recursive: true,
              force: true,
            });
          }
        } catch (cleanupErr) {
          appendLog(
            id,
            `Warning: failed to clean up build directory: ${
              cleanupErr && (cleanupErr as Error).message
                ? (cleanupErr as Error).message
                : String(cleanupErr)
            }`,
            'warning',
          );
        }
      }
    }
  }
}

export const deploymentService = new DeploymentService();
