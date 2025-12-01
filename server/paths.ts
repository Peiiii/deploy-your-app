import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the monorepo (project root)
export const rootDir = path.resolve(__dirname, '..');

// Where we clone and build user projects
export const buildsRoot = path.join(rootDir, '.deploy-builds');

// Where built static assets are served from
export const staticRoot = path.join(rootDir, 'apps');

// Ensure required directories exist
fs.mkdirSync(buildsRoot, { recursive: true });
fs.mkdirSync(staticRoot, { recursive: true });

