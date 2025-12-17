import * as fs from 'fs/promises';
import * as path from 'path';
import { MAX_HTML_LENGTH } from '../context.types.js';

/**
 * Extract and truncate index.html content from a directory.
 */
export const extractHtmlContent = async (
    workDir: string,
): Promise<string | undefined> => {
    const candidates = [
        'index.html',
        'public/index.html',
        'src/index.html',
        'dist/index.html',
    ];

    for (const candidate of candidates) {
        const filePath = path.join(workDir, candidate);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return truncateContent(content, MAX_HTML_LENGTH);
        } catch {
            // File not found, try next
        }
    }

    return undefined;
};

/**
 * Extract HTML from inline content (for HTML source type).
 */
export const extractInlineHtml = (
    htmlContent: string | undefined,
): string | undefined => {
    if (!htmlContent) return undefined;
    return truncateContent(htmlContent, MAX_HTML_LENGTH);
};

/**
 * Truncate content to max length, adding indicator if truncated.
 */
const truncateContent = (content: string, maxLength: number): string => {
    if (content.length <= maxLength) {
        return content;
    }
    return content.slice(0, maxLength) + '\n<!-- ... truncated -->';
};
