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

    appendLog(id, 'Installing dependencies with npm', 'info');
    await runCommand(id, 'npm', ['install'], {
      cwd: workDir,
      // Ensure devDependencies (like Vite) are always installed, even if
      // the server runs with NODE_ENV=production or npm_config_production=true.
      env: {
        npm_config_production: 'false',
      },
    });

    appendLog(id, 'Building project (npm run build)', 'info');
    await runCommand(id, 'npm', ['run', 'build'], { cwd: workDir });

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
    appendLog(
      id,
      `Deployment failed: ${
        err && (err as Error).message ? (err as Error).message : String(err)
      }`,
      'error',
    );
    updateStatus(id, 'FAILED');
  } finally {
    if (analysisId && analysisSessions.has(analysisId)) {
      analysisSessions.delete(analysisId);
    }
  }
}
