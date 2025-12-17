import * as fs from 'fs/promises';
import * as path from 'path';
import { MAX_PACKAGE_DEPS, type PackageJsonInfo } from '../context.types.js';

/**
 * Extract and parse package.json from a directory.
 */
export const extractPackageJson = async (
    workDir: string,
): Promise<PackageJsonInfo | undefined> => {
    const filePath = path.join(workDir, 'package.json');

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content) as Record<string, unknown>;

        return {
            name: typeof parsed.name === 'string' ? parsed.name : undefined,
            description: typeof parsed.description === 'string' ? parsed.description : undefined,
            version: typeof parsed.version === 'string' ? parsed.version : undefined,
            dependencies: limitDeps(parsed.dependencies),
            devDependencies: limitDeps(parsed.devDependencies),
            scripts: limitScripts(parsed.scripts),
        };
    } catch {
        return undefined;
    }
};

/**
 * Limit dependencies to MAX_PACKAGE_DEPS entries.
 */
const limitDeps = (
    deps: unknown,
): Record<string, string> | undefined => {
    if (!deps || typeof deps !== 'object') return undefined;

    const entries = Object.entries(deps as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .slice(0, MAX_PACKAGE_DEPS) as [string, string][];

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * Limit scripts to common ones.
 */
const limitScripts = (
    scripts: unknown,
): Record<string, string> | undefined => {
    if (!scripts || typeof scripts !== 'object') return undefined;

    const commonScripts = ['dev', 'build', 'start', 'test', 'lint'];
    const result: Record<string, string> = {};

    for (const key of commonScripts) {
        const value = (scripts as Record<string, unknown>)[key];
        if (typeof value === 'string') {
            result[key] = value;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Detect framework from package.json dependencies.
 */
export const detectFramework = (
    packageJson: PackageJsonInfo | undefined,
): string | undefined => {
    if (!packageJson) return undefined;

    const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };

    if ('next' in allDeps) return 'next';
    if ('nuxt' in allDeps) return 'nuxt';
    if ('vue' in allDeps) return 'vue';
    if ('react' in allDeps) return 'react';
    if ('svelte' in allDeps) return 'svelte';
    if ('angular' in allDeps || '@angular/core' in allDeps) return 'angular';
    if ('astro' in allDeps) return 'astro';

    return undefined;
};
