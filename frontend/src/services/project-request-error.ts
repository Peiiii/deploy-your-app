import { ProjectAddressError } from './project-address';

export class ProjectCreationLimitError extends Error {
  constructor(message: string, public readonly limit: number, public readonly upgradeRequired: boolean) {
    super(message);
    this.name = 'ProjectCreationLimitError';
  }
}

export async function throwProjectRequestError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as {
    code?: string; error?: string; limit?: number; upgradeRequired?: boolean;
  } | null;
  if (body?.code === 'ADDRESS_TAKEN' || body?.code === 'INVALID_ADDRESS' || body?.code === 'ADDRESS_LOCKED') {
    throw new ProjectAddressError(body.code);
  }
  if (body?.code === 'PROJECT_COUNT_LIMIT' && typeof body.limit === 'number' && typeof body.upgradeRequired === 'boolean') {
    throw new ProjectCreationLimitError(body.error ?? fallback, body.limit, body.upgradeRequired);
  }
  throw new Error(fallback);
}
