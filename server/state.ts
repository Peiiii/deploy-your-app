import type {
  Project,
  DeploymentRecord,
  AnalysisSession,
} from './types.js';

// Centralized in-memory state for the backend.

export const projects: Project[] = [];

export const deployments = new Map<string, DeploymentRecord>();

// Active SSE clients subscribed to a given deployment id.
// We keep the type minimal here to avoid importing Express types.
export type StreamClient = {
  write: (data: string) => void;
  end: () => void;
};

export const streams = new Map<string, Set<StreamClient>>();

// Analysis sessions created while scanning/cloning repos.
export const analysisSessions = new Map<string, AnalysisSession>();
