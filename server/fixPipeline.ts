import { appendLog } from './deploymentService.js';
import type { RepoFixContext } from './fixes/types.js';
import { FIXES } from './fixes/index.js';

export async function applyFixesForDeployment(
  deploymentId: string,
  workDir: string,
  distDir?: string,
): Promise<void> {
  const ctx: RepoFixContext = { deploymentId, workDir, distDir };

  for (const fix of FIXES) {
    try {
      const shouldApply = await fix.detect(ctx);
      if (!shouldApply) continue;

      appendLog(
        deploymentId,
        `Applying fix "${fix.id}": ${fix.description}`,
        'info',
      );
      await fix.apply(ctx);
      appendLog(
        deploymentId,
        `Fix "${fix.id}" applied successfully.`,
        'success',
      );
    } catch (err) {
      appendLog(
        deploymentId,
        `Fix "${fix.id}" failed: ${
          err && (err as Error).message ? (err as Error).message : String(err)
        }`,
        'warning',
      );
      // Continue with other fixes; a failed fix should not abort deployment.
    }
  }
}
