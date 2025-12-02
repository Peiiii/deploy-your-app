import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the monorepo (project root)
// - When running from TS in /server, __dirname is "<root>/server"
// - When running from compiled JS in /server/dist, __dirname is "<root>/server/dist"
// In both cases, going two levels up lands at the repo root.
export const rootDir = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Storage-related paths
// All of these are configurable via environment variables and default to
// directories at the repo root (not inside the server package).
//
//   DEPLOY_BUILDS_ROOT_DIR   : where user repos are cloned/built
//   STATIC_APPS_ROOT_DIR     : where built static apps are served from
//   DATA_DIR                 : base directory for persistent JSON data
//   PROJECTS_FILE            : projects JSON file path (relative to rootDir,
//                              or absolute)
// ---------------------------------------------------------------------------

function resolveFromRoot(relOrAbs: string): string {
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.join(rootDir, relOrAbs);
}

// Where we clone and build user projects
const buildsRootEnv = process.env.DEPLOY_BUILDS_ROOT_DIR || '.deploy-builds';
export const buildsRoot = resolveFromRoot(buildsRootEnv);

// Where built static assets are served from
const staticRootEnv = process.env.STATIC_APPS_ROOT_DIR || 'apps';
export const staticRoot = resolveFromRoot(staticRootEnv);

// Where backend JSON data is stored (projects, etc.)
const dataDirEnv = process.env.DATA_DIR || 'data';
export const dataDir = resolveFromRoot(dataDirEnv);

// Projects JSON file; can be overridden explicitly, otherwise lives under
// DATA_DIR/projects.json by default.
const projectsFileEnv = process.env.PROJECTS_FILE;
export const projectsFile =
  projectsFileEnv && projectsFileEnv.trim() !== ''
    ? resolveFromRoot(projectsFileEnv.trim())
    : path.join(dataDir, 'projects.json');

// Ensure required directories exist
fs.mkdirSync(buildsRoot, { recursive: true });
fs.mkdirSync(staticRoot, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
