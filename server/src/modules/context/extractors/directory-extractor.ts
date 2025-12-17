import * as fs from 'fs/promises';
import * as path from 'path';
import { MAX_FILES } from '../context.types.js';

/**
 * Extract directory tree from a workDir.
 */
export const extractDirectoryTree = async (
    workDir: string,
): Promise<string[]> => {
    const files: string[] = [];
    const ignoreDirs = new Set([
        'node_modules',
        '.git',
        '.next',
        'dist',
        'build',
        '.cache',
        'coverage',
    ]);

    await walkDir(workDir, '', files, ignoreDirs);

    return files.slice(0, MAX_FILES);
};

/**
 * Recursively walk directory and collect file paths.
 */
const walkDir = async (
    baseDir: string,
    relativePath: string,
    files: string[],
    ignoreDirs: Set<string>,
): Promise<void> => {
    if (files.length >= MAX_FILES) return;

    const currentPath = path.join(baseDir, relativePath);

    try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            if (files.length >= MAX_FILES) break;

            const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                if (!ignoreDirs.has(entry.name)) {
                    files.push(`${entryRelPath}/`);
                    await walkDir(baseDir, entryRelPath, files, ignoreDirs);
                }
            } else {
                files.push(entryRelPath);
            }
        }
    } catch {
        // Directory not accessible, skip
    }
};
