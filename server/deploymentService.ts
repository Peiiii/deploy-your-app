import * as path from 'path';
import * as fs from 'fs';
import {
  deployments,
  analysisSessions,
} from './state.js';
import { CONFIG } from './config.js';
import { slugify } from './utils.js';
import { applyFixesForDeployment } from './fixPipeline.js';
import { DEPLOY_TARGET } from './config.js';
import { deployToCloudflarePages } from './cloudflarePagesProvider.js';
import { deployToR2 } from './r2Provider.js';

import {
  appendLog,
  updateStatus,
  broadcastEvent,
} from './deployment/deploymentEvents.js';
import { materializeSourceForDeployment } from './deployment/sourceMaterialization.js';
import {
  copyDir,
  runCommand,
  deployToLocalStatic,
} from './deployment/deploymentBuild.js';
import {
  findAIClientFile,
  prepareAnalysisSession,
} from './deployment/analysisSession.js';

export {
  appendLog,
  updateStatus,
  broadcastEvent,
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

export async function runDeployment(id: string): Promise<void> {
  const deployment = deployments.get(id);
  if (!deployment) return;

  const project = deployment.project;
  const analysisId = project.analysisId;
  const slug = slugify(project.name);

  // Reuse an existing prepared repo when analysis has been run, otherwise create a fresh workdir.
  let workDir = deployment.workDir;
  if (!workDir) {
    workDir = path.join(CONFIG.paths.buildsRoot, id);
    deployment.workDir = workDir;
  }

  const isFromAnalysis =
    Boolean(analysisId) &&
    analysisSessions.has(analysisId!) &&
    deployment.workDir === analysisSessions.get(analysisId!)!.workDir;

  try {
    updateStatus(id, 'BUILDING');
    appendLog(id, `Starting deployment for "${project.name}"`, 'info');

    // If this deployment reuses a prepared repository from an analysis session,
    // keep that workdir as-is. Otherwise, materialize the source into workDir
    // by downloading a ZIP archive (GitHub codeload or direct .zip URL).
    if (isFromAnalysis) {
      appendLog(id, `Reusing prepared repository at ${workDir}`, 'info');
    } else {
      await materializeSourceForDeployment(id, project, workDir);
    }

    // Apply repository-level fixes (like injecting missing entry scripts)
    // before installing dependencies and building.
    await applyFixesForDeployment(id, workDir);

    const packageManager = detectPackageManager(workDir);
    appendLog(
      id,
      `Detected package manager: ${packageManager.name} (${packageManager.reason})`,
      'info',
    );

    // Ensure devDependencies (like Vite) are always installed, even if
    // the server runs with NODE_ENV=production or npm_config_production=true.
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

      appendLog(id, 'Building project (pnpm run build)', 'info');
      await runCommand(id, 'pnpm', ['run', 'build'], { cwd: workDir });
    } else if (packageManager.name === 'yarn') {
      appendLog(id, 'Installing dependencies with yarn', 'info');
      await runCommand(id, 'yarn', ['install'], {
        cwd: workDir,
      });

      appendLog(id, 'Building project (yarn build)', 'info');
      await runCommand(id, 'yarn', ['build'], { cwd: workDir });
    } else if (packageManager.name === 'bun') {
      appendLog(id, 'Installing dependencies with bun', 'info');
      await runCommand(id, 'bun', ['install'], {
        cwd: workDir,
      });

      appendLog(id, 'Building project (bun run build)', 'info');
      await runCommand(id, 'bun', ['run', 'build'], { cwd: workDir });
    } else {
      appendLog(id, 'Installing dependencies with npm', 'info');
      await runCommand(id, 'npm', ['install'], {
        cwd: workDir,
        env: installEnv,
      });

      appendLog(id, 'Building project (npm run build)', 'info');
      await runCommand(id, 'npm', ['run', 'build'], { cwd: workDir });
    }

    const candidates = ['dist', 'build', 'out'];
    let distPath: string | null = null;
    for (const candidate of candidates) {
      const full = path.join(workDir, candidate);
      if (fs.existsSync(full)) {
        distPath = full;
        break;
      }
    }

    if (!distPath) {
      throw new Error(
        'Could not find build output directory (tried dist/, build/, out/)',
      );
    }
    // Apply post-build fixes that operate on the output bundle (e.g. adjusting
    // asset paths for local preview).
    await applyFixesForDeployment(id, workDir, distPath);

    // Decide deployment target: prefer project-level setting, otherwise fall
    // back to global default.
    const target = project.deployTarget || DEPLOY_TARGET;

    updateStatus(id, 'DEPLOYING');

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
      // For debugging: show where in R2 this deployment lives.
      providerUrl = `r2://${result.storagePrefix}`;
    } else {
      finalUrl = await deployToLocalStatic({
        deploymentId: id,
        slug,
        distPath,
      });
    }

    // Update project metadata with the final URLs.
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

    updateStatus(id, 'SUCCESS');
  } catch (err: unknown) {
    const errorMessage =
      err && (err as Error).message ? (err as Error).message : String(err);
    appendLog(
      id,
      `Deployment failed: ${errorMessage}`,
      'error',
    );
    updateStatus(id, 'FAILED', { errorMessage });
  } finally {
    if (analysisId && analysisSessions.has(analysisId)) {
      analysisSessions.delete(analysisId);
    }
  }
}
