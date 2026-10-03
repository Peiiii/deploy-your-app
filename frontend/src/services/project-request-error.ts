import { ProjectAddressError } from './project-address';

export class ProjectCreationLimitError extends Error {
  constructor(message: string, public readonly limit: number, public readonly resetAt: string) {
    super(message);
    this.name = 'ProjectCreationLimitError';
  }
}

export async function throwProjectRequestError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as {
    code?: string; error?: string; limit?: number; resetAt?: string;
  } | null;
  if (body?.code === 'ADDRESS_TAKEN' || body?.code === 'INVALID_ADDRESS' || body?.code === 'ADDRESS_LOCKED') {
    throw new ProjectAddressError(body.code);
  }
  if (body?.code === 'DAILY_PROJECT_LIMIT' && typeof body.limit === 'number' && typeof body.resetAt === 'string') {
    throw new ProjectCreationLimitError(body.error ?? fallback, body.limit, body.resetAt);
  }
  throw new Error(fallback);
}
