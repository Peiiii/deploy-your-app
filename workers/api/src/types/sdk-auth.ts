export type SdkAuthScope = 'identity:basic' | 'storage:rw' | string;

export interface SdkAuthCodeRecord {
  code: string;
  appId: string;
  userId: string;
  scopes: string[];
  codeChallenge: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface SdkAccessTokenRecord {
  token: string;
  appId: string;
  appUserId: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
}

export interface SdkConsentRecord {
  appId: string;
  userId: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
}

export interface SdkAppUserRecord {
  appId: string;
  userId: string;
  appUserId: string;
  createdAt: string;
}

export interface SdkAuthorizeResponse {
  code: string;
  expiresIn: number;
}

export interface SdkTokenResponse {
  accessToken: string;
  expiresIn: number;
  appId: string;
  appUserId: string;
  scopes: string[];
}

export interface SdkMeResponse {
  appId: string;
  appUserId: string;
  scopes: string[];
}

