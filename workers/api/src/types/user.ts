export interface User {
  id: string;
  email: string | null;
  handle: string | null;
  passwordHash: string | null;
  googleSub: string | null;
  githubId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

export interface PublicUser {
  id: string;
  email: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  // Whether current session is admin (computed server-side, not user-settable)
  isAdmin: boolean;
  providers: {
    email: boolean;
    google: boolean;
    github: boolean;
  };
}
