export const APP_CONFIG = {
  NAME: 'GeminiDeploy',
  DEPLOYMENT_DOMAIN: 'gemini-deploy.com',
  DEFAULT_AI_MODEL: 'gemini-2.5-flash',
  
  // =================================================================
  // 🔌 BACKEND CONNECTION CONFIGURATION
  // =================================================================
  
  // 1. MOCK MODE (Demo Mode)
  // Set to 'true' to use local browser storage and simulated deployment logs.
  // No backend server is required.
  //
  // 2. REAL BACKEND
  // Set to 'false' to connect to your deployed server.
  // The app will make real HTTP requests to API_BASE_URL.
  USE_MOCK_ADAPTER: false, 
  
  // The address of your real backend API.
  // Only used when USE_MOCK_ADAPTER is false.
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
  getDeploymentUrl: (subdomain: string) => {
    const slug = subdomain.toLowerCase();
    if (typeof window !== 'undefined') {
      // In dev, Vite proxies /apps to the backend so this stays same-origin.
      return `${window.location.origin}/apps/${encodeURIComponent(slug)}/`;
    }
    return `https://${slug}.${APP_CONFIG.DEPLOYMENT_DOMAIN}`;
  },
  getProxyUrl: (id: string) => `https://proxy-${id}.${APP_CONFIG.DEPLOYMENT_DOMAIN}/v1`,
};
