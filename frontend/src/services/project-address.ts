export interface ProjectAddressAvailability {
  available: boolean;
  domain: string;
  suggestion?: string;
}

export class ProjectAddressError extends Error {
  constructor(public readonly code: 'ADDRESS_TAKEN' | 'INVALID_ADDRESS' | 'ADDRESS_LOCKED') {
    super(code);
    this.name = 'ProjectAddressError';
  }
}

export async function throwProjectRequestError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null) as { code?: string } | null;
  if (body?.code === 'ADDRESS_TAKEN' || body?.code === 'INVALID_ADDRESS' || body?.code === 'ADDRESS_LOCKED') {
    throw new ProjectAddressError(body.code);
  }
  throw new Error(fallback);
}
