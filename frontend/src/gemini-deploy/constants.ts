export const APP_CONFIG = {
  NAME: 'GeminiDeploy',
  DEFAULT_AI_MODEL: 'gemini-2.5-flash',

  // The address of your backend API.
  API_BASE_URL: '/api/v1',
};

export const API_ROUTES = {
  PROJECTS: '/projects',
  DEPLOY: '/deploy',
  ANALYZE: '/analyze',
  STATUS: '/status',
};

export const SECURITY_CONSTANTS = {
  PROXY_KEY_PLACEHOLDER: "PROXY_SECURED_KEY",
  SYSTEM_PROMPT_ROLE: "You are a Senior DevOps Engineer and Security Expert.",
};

export const URLS = {
  GITHUB_BASE: 'https://github.com/',
};
