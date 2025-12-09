export const APP_CONFIG = {
  NAME: 'GeminiDeploy',
  DEFAULT_AI_MODEL: 'gemini-2.5-flash',

  // The address of your backend API (always proxied via Pages/_worker.js).
  API_BASE_URL: '/api/v1',
};

export const API_ROUTES = {
  PROJECTS: '/projects',
  PROJECT_BY_REPO: '/projects/by-repo',
  EXPLORE_PROJECTS: '/projects/explore',
  DEPLOY: '/deploy',
  ANALYZE: '/analyze',
  STATUS: '/status',
  PROJECT_STATS: (id: string) => `/projects/${encodeURIComponent(id)}/stats`,
  PROJECT_REACTIONS: (id: string) =>
    `/projects/${encodeURIComponent(id)}/reactions`,
  PROJECT_REACTIONS_BULK: '/projects/reactions',
  PROJECT_LIKE: (id: string) => `/projects/${encodeURIComponent(id)}/like`,
  PROJECT_FAVORITE: (id: string) =>
    `/projects/${encodeURIComponent(id)}/favorite`,
  MY_FAVORITES: '/me/favorites',
};

export const SECURITY_CONSTANTS = {
  PROXY_KEY_PLACEHOLDER: "PROXY_SECURED_KEY",
  SYSTEM_PROMPT_ROLE: "You are a Senior DevOps Engineer and Security Expert.",
};

export const URLS = {
  GITHUB_BASE: 'https://github.com/',
};
