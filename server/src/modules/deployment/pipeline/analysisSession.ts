import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { CONFIG } from '../../../common/config/config.js';
import { analysisSessions } from '../state.js';

export async function findAIClientFile(
  repoRoot: string,
): Promise<{ filePath: string; content: string } | null> {
  const candidates: string[] = ['src', ''];
  const seen = new Set<string>();
  const patterns = ['@google/genai', 'GoogleGenAI', '@google-ai/generativelanguage'];

  while (candidates.length > 0) {
    const rel = candidates.shift() as string;
    const dir = path.join(repoRoot, rel);
    if (seen.has(dir)) continue;
    seen.add(dir);

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryRel = path.join(rel, entry.name);
      const full = path.join(repoRoot, entryRel);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        candidates.push(entryRel);
      } else if (entry.isFile()) {
        if (!/\.(t|j)sx?$/.test(entry.name)) continue;
        let content: string;
        try {
          content = await fs.promises.readFile(full, 'utf8');
        } catch {
          continue;
        }
        if (patterns.some((p) => content.includes(p))) {
          return {
            filePath: entryRel.replace(/\\/g, '/'),
            content,
          };
        }
      }
    }
  }

  return null;
}

export async function prepareAnalysisSession(repoUrl: string): Promise<{
  analysisId: string;
  filePath: string;
  sourceCode: string;
}> {
  const analysisId = randomUUID();
  const workDir = path.join(CONFIG.paths.buildsRoot, `analysis-${analysisId}`);

  await fs.promises.mkdir(workDir, { recursive: true });

  const cloneArgs = ['clone', '--depth=1', repoUrl, workDir];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', cloneArgs, {
      cwd: CONFIG.paths.buildsRoot,
      shell: false,
      env: { ...process.env },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone exited with code ${code}`));
    });
  });

  const aiFile = await findAIClientFile(workDir);
  if (!aiFile) {
    throw new Error(
      'Could not find any AI client file in the repo (looked for @google/genai / GoogleGenAI).',
    );
  }

  analysisSessions.set(analysisId, {
    workDir,
    repoUrl,
    filePath: aiFile.filePath,
  });

  return {
    analysisId,
    filePath: aiFile.filePath,
    sourceCode: aiFile.content,
  };
}
