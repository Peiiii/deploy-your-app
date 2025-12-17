import * as fs from 'fs/promises';
import * as path from 'path';
import { MAX_README_LENGTH } from '../context.types.js';

/**
 * Extract README content from a directory.
 */
export const extractReadme = async (
    workDir: string,
): Promise<string | undefined> => {
    const candidates = [
        'README.md',
        'readme.md',
        'Readme.md',
        'README.txt',
        'README',
    ];

    for (const candidate of candidates) {
        const filePath = path.join(workDir, candidate);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return truncateContent(content, MAX_README_LENGTH);
        } catch {
            // File not found, try next
        }
    }

    return undefined;
};

/**
 * Truncate content to max length, adding indicator if truncated.
 */
const truncateContent = (content: string, maxLength: number): string => {
    if (content.length <= maxLength) {
        return content;
    }
    return content.slice(0, maxLength) + '\n\n... (truncated)';
};
