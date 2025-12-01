export interface RepoFixContext {
  deploymentId: string;
  workDir: string;
  // Optional build output directory (e.g. "dist") for post-build fixes.
  distDir?: string;
}

export interface RepoFix {
  id: string;
  description: string;
  detect(ctx: RepoFixContext): Promise<boolean>;
  apply(ctx: RepoFixContext): Promise<void>;
}
