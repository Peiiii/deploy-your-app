export interface ApiWorkerEnv {
  PROJECTS_DB: D1Database;
  APPS_ROOT_DOMAIN?: string;
  DEPLOY_TARGET?: string;
  PLATFORM_AI_BASE_URL?: string;
  PLATFORM_AI_MODEL?: string;
  DASHSCOPE_API_KEY?: string;
  DEPLOY_SERVICE_BASE_URL?: string;
  /**
   * Comma-separated admin allowlist (emails, case-insensitive).
   * Example: "admin@example.com,ops@example.com"
   */
  ADMIN_EMAILS?: string;
  /**
   * Comma-separated admin allowlist (user ids).
   * Example: "uuid-1,uuid-2"
   */
  ADMIN_USER_IDS?: string;
  // Optional R2 bucket binding used for storing app assets like thumbnails
  // when DEPLOY_TARGET === 'r2'.
  ASSETS?: R2Bucket;
  // Auth / OAuth configuration
  PASSWORD_SALT?: string;
  AUTH_REDIRECT_BASE?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  /**
   * Controls audit/debug logging for Gemigo Cloud endpoints.
   * Values: "off" | "error" | "info" | "debug"
   * Default: "error" (only log failures)
   */
  SDK_CLOUD_LOG_LEVEL?: string;

  /**
   * Secret used to sign short-lived upload/download URLs for `cloud.blob`.
   * Set via `wrangler secret put SDK_CLOUD_BLOB_SIGNING_SECRET`.
   */
  SDK_CLOUD_BLOB_SIGNING_SECRET?: string;
}
