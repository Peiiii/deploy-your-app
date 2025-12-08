export interface ApiWorkerEnv {
  PROJECTS_DB: D1Database;
  APPS_ROOT_DOMAIN?: string;
  DEPLOY_TARGET?: string;
  PLATFORM_AI_BASE_URL?: string;
  PLATFORM_AI_MODEL?: string;
  DASHSCOPE_API_KEY?: string;
  DEPLOY_SERVICE_BASE_URL?: string;
  // Auth / OAuth configuration
  PASSWORD_SALT?: string;
  AUTH_REDIRECT_BASE?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
