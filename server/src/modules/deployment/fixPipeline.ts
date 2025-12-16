import { appendLog } from './pipeline/deploymentEvents.js';
import type { RepoFixContext } from './fixes/types.js';
import { FIXES } from './fixes/index.js';

const executedFixesByDeployment = new Map<string, Set<string>>();

export async function applyFixesForDeployment(
  deploymentId: string,
  workDir: string,
  distDir?: string,
): Promise<void> {
  const ctx: RepoFixContext = { deploymentId, workDir, distDir };
  const executed = executedFixesByDeployment.get(deploymentId) ?? new Set<string>();

  for (const fix of FIXES) {
    if (executed.has(fix.id)) continue;
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
      executed.add(fix.id);
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
  executedFixesByDeployment.set(deploymentId, executed);
}
